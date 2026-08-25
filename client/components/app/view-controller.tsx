'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import { useRouter } from 'next/navigation';
import type { AppConfig } from '@/app-config';
import { FeedbackView } from '@/components/app/feedback-view';
import { PracticeSessionView } from '@/components/app/practice-session-view';
import { SetupView, type PracticeDeckSelection } from '@/components/app/setup-view';
import { usePodiumRoomEvents } from '@/hooks/use-podium-room';
import { evaluateFallback, patchSession } from '@/lib/api';
import type { AudiencePersonaId, FeedbackReport, SessionPhase } from '@/lib/podium';

const MotionSetupView = motion.create(SetupView);
const MotionPracticeSessionView = motion.create(PracticeSessionView);
const MotionFeedbackView = motion.create(FeedbackView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden' as const,
  animate: 'visible' as const,
  exit: 'hidden' as const,
  transition: { duration: 0.5, ease: 'linear' as const },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  initialDeckId?: string | null;
  practiceSessionId: string | null;
  onPrepareSession: (args: {
    persona: AudiencePersonaId;
    deck: PracticeDeckSelection;
  }) => Promise<string>;
}

export function ViewController({
  appConfig,
  initialDeckId,
  practiceSessionId,
  onPrepareSession,
}: ViewControllerProps) {
  const router = useRouter();
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [persona, setPersona] = useState<AudiencePersonaId>('executive');
  const [deck, setDeck] = useState<PracticeDeckSelection | null>(null);
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const phaseBoundarySecRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const practiceSessionIdRef = useRef<string | null>(practiceSessionId);

  useEffect(() => {
    practiceSessionIdRef.current = practiceSessionId;
  }, [practiceSessionId]);

  const persistFeedback = useCallback(async (next: FeedbackReport) => {
    const id = practiceSessionIdRef.current;
    if (!id) return;
    try {
      await patchSession(id, { feedback: next, status: 'completed' });
    } catch (error) {
      console.error('Failed to save feedback', error);
    }
  }, []);

  const handleFeedback = useCallback(
    (next: FeedbackReport) => {
      setReport(next);
      setAwaitingFeedback(false);
      setPhase('feedback');
      void persistFeedback(next);
      void session.end();
    },
    [session, persistFeedback]
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

    const payload = (await evaluateFallback({
      persona,
      deckPlainText: deck.plainText,
      transcript,
      phaseBoundarySec: phaseBoundarySecRef.current ?? undefined,
    })) as FeedbackReport;

    setReport(payload);
    setPhase('feedback');
    setAwaitingFeedback(false);
    await persistFeedback(payload);
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

  async function handleStart(args: {
    persona: AudiencePersonaId;
    deck: PracticeDeckSelection;
  }) {
    setPersona(args.persona);
    setDeck(args.deck);
    setReport(null);
    const sessionId = await onPrepareSession(args);
    practiceSessionIdRef.current = sessionId;
    await session.start();
  }

  function handlePracticeAgain() {
    setReport(null);
    setDeck(null);
    setAwaitingFeedback(false);
    setPhase('setup');
    phaseBoundarySecRef.current = null;
    sessionStartedAtRef.current = null;
    router.push('/practice');
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && !session.isConnected && (
        <MotionSetupView
          key="setup"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          initialDeckId={initialDeckId}
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
