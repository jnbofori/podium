'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { FeedbackView } from '@/components/app/feedback-view';
import { PracticeSessionView } from '@/components/app/practice-session-view';
import { SetupView } from '@/components/app/setup-view';
import { usePodiumRoomEvents } from '@/hooks/use-podium-room';
import type { AudiencePersonaId, FeedbackReport, ParsedDeck, SessionPhase } from '@/lib/podium';

const MotionSetupView = motion.create(SetupView);
const MotionPracticeSessionView = motion.create(PracticeSessionView);
const MotionFeedbackView = motion.create(FeedbackView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  onPrepareSession: (args: { persona: AudiencePersonaId; deck: ParsedDeck }) => void;
}

export function ViewController({ appConfig, onPrepareSession }: ViewControllerProps) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [persona, setPersona] = useState<AudiencePersonaId>('executive');
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const phaseBoundarySecRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);

  const handleFeedback = useCallback(
    (next: FeedbackReport) => {
      setReport(next);
      setAwaitingFeedback(false);
      setPhase('feedback');
      void session.end();
    },
    [session]
  );

  const handlePhaseFromAgent = useCallback((next: SessionPhase) => {
    if (next === 'qa') {
      if (phaseBoundarySecRef.current == null && sessionStartedAtRef.current != null) {
        phaseBoundarySecRef.current = (Date.now() - sessionStartedAtRef.current) / 1000;
      }
      setPhase('qa');
    } else if (next === 'present') {
      setPhase('present');
    }
  }, []);

  usePodiumRoomEvents({
    onFeedback: handleFeedback,
    onPhase: handlePhaseFromAgent,
  });

  useEffect(() => {
    if (session.isConnected && phase === 'setup') {
      setPhase('present');
      sessionStartedAtRef.current = Date.now();
      phaseBoundarySecRef.current = null;
    }
  }, [session.isConnected, phase]);

  useEffect(() => {
    if (
      !session.isConnected &&
      (phase === 'present' || phase === 'qa') &&
      !awaitingFeedback &&
      !report
    ) {
      setPhase('setup');
    }
  }, [session.isConnected, phase, awaitingFeedback, report]);

  async function requestFallbackEvaluation() {
    if (!deck) return;
    const startedAt = sessionStartedAtRef.current ?? Date.now();
    const transcript = messages.map((message, index) => ({
      role: message.from?.isLocal ? 'user' : 'assistant',
      content: message.message,
      timestampSec: Math.max(0, (Date.now() - startedAt) / 1000 - (messages.length - index) * 8),
    }));

    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona,
        deckPlainText: deck.plainText,
        transcript,
        phaseBoundarySec: phaseBoundarySecRef.current ?? undefined,
      }),
    });
    if (!response.ok) {
      throw new Error('Fallback evaluation failed');
    }
    const payload = (await response.json()) as FeedbackReport;
    setReport(payload);
    setPhase('feedback');
    setAwaitingFeedback(false);
    if (session.isConnected) {
      void session.end();
    }
  }

  useEffect(() => {
    if (!awaitingFeedback) return;
    const timer = window.setTimeout(() => {
      void requestFallbackEvaluation().catch((error) => {
        console.error(error);
        setAwaitingFeedback(false);
      });
    }, 8000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingFeedback]);

  async function handleStart(args: { persona: AudiencePersonaId; deck: ParsedDeck }) {
    setPersona(args.persona);
    setDeck(args.deck);
    setReport(null);
    onPrepareSession(args);
    await session.start();
  }

  function handlePracticeAgain() {
    setReport(null);
    setDeck(null);
    setAwaitingFeedback(false);
    setPhase('setup');
    phaseBoundarySecRef.current = null;
    sessionStartedAtRef.current = null;
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && !session.isConnected && (
        <MotionSetupView
          key="setup"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStart={handleStart}
        />
      )}

      {(phase === 'present' || phase === 'qa') && session.isConnected && (
        <MotionPracticeSessionView
          key="practice"
          {...VIEW_MOTION_PROPS}
          appConfig={appConfig}
          phase={phase}
          persona={persona}
          onPhaseChange={(next) => {
            if (
              next === 'qa' &&
              phaseBoundarySecRef.current == null &&
              sessionStartedAtRef.current
            ) {
              phaseBoundarySecRef.current = (Date.now() - sessionStartedAtRef.current) / 1000;
            }
            setPhase(next);
          }}
          onRequestFeedback={() => setAwaitingFeedback(true)}
        />
      )}

      {phase === 'feedback' && report && (
        <MotionFeedbackView
          key="feedback"
          {...VIEW_MOTION_PROPS}
          report={report}
          onPracticeAgain={handlePracticeAgain}
        />
      )}

      {awaitingFeedback && phase !== 'feedback' && (
        <motion.div
          key="awaiting-feedback"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <p className="text-foreground font-mono text-sm tracking-wide">
            Evaluating your presentation…
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
