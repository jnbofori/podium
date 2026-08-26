'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import { useRouter } from 'next/navigation';
import type { AppConfig } from '@/app-config';
import { FeedbackView } from '@/components/app/feedback-view';
import { PracticeSessionView } from '@/components/app/practice-session-view';
import { SetupView, type PracticeDeckSelection } from '@/components/app/setup-view';
import { Button } from '@/components/ui/button';
import { usePodiumRoomEvents } from '@/hooks/use-podium-room';
import { patchSession } from '@/lib/api';
import type { AudiencePersonaId, FeedbackReport, SessionPhase } from '@/lib/podium';

const MotionSetupView = motion.create(SetupView);
const MotionPracticeSessionView = motion.create(PracticeSessionView);
const MotionFeedbackView = motion.create(FeedbackView);

const FEEDBACK_TIMEOUT_MS = 90_000;

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
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [persona, setPersona] = useState<AudiencePersonaId>('executive');
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const phaseBoundarySecRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const practiceSessionIdRef = useRef<string | null>(practiceSessionId);
  const reportRef = useRef<FeedbackReport | null>(null);

  useEffect(() => {
    practiceSessionIdRef.current = practiceSessionId;
  }, [practiceSessionId]);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

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
      setFeedbackError(null);
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
      !report &&
      !feedbackError
    ) {
      setPhase('setup');
    }
  }, [session.isConnected, phase, awaitingFeedback, report, feedbackError]);

  useEffect(() => {
    if (!awaitingFeedback) return;
    const timer = window.setTimeout(() => {
      if (reportRef.current) return;
      setAwaitingFeedback(false);
      setFeedbackError('Feedback timed out. Please try practicing again.');
    }, FEEDBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingFeedback]);

  useEffect(() => {
    if (!awaitingFeedback || session.isConnected || report) return;
    // Agent shuts down after publishing; allow a brief window for the data message.
    const timer = window.setTimeout(() => {
      if (reportRef.current) return;
      setAwaitingFeedback(false);
      setFeedbackError(
        'Connection closed before feedback arrived. Please try practicing again.'
      );
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [awaitingFeedback, session.isConnected, report]);

  async function handleStart(args: {
    persona: AudiencePersonaId;
    deck: PracticeDeckSelection;
  }) {
    setPersona(args.persona);
    setReport(null);
    setFeedbackError(null);
    const sessionId = await onPrepareSession(args);
    practiceSessionIdRef.current = sessionId;
    await session.start();
  }

  function handlePracticeAgain() {
    setReport(null);
    setAwaitingFeedback(false);
    setFeedbackError(null);
    setPhase('setup');
    phaseBoundarySecRef.current = null;
    sessionStartedAtRef.current = null;
    router.push('/practice');
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && !session.isConnected && !feedbackError && (
        <MotionSetupView
          key="setup"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          initialDeckId={initialDeckId}
          onStart={handleStart}
        />
      )}

      {(phase === 'present' || phase === 'qa') && session.isConnected && !feedbackError && (
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
          onRequestFeedback={() => {
            setFeedbackError(null);
            setAwaitingFeedback(true);
          }}
        />
      )}

      {phase === 'feedback' && report && !feedbackError && (
        <MotionFeedbackView
          key="feedback"
          {...VIEW_MOTION_PROPS}
          report={report}
          onPracticeAgain={handlePracticeAgain}
        />
      )}

      {feedbackError && (
        <motion.div
          key="feedback-error"
          className="mx-auto flex max-w-md flex-col items-center px-5 py-20 text-center"
          {...VIEW_MOTION_PROPS}
        >
          <p className="text-destructive text-sm font-medium" role="alert">
            {feedbackError}
          </p>
          <Button className="mt-6" onClick={handlePracticeAgain}>
            Practice again
          </Button>
        </motion.div>
      )}

      {awaitingFeedback && !feedbackError && phase !== 'feedback' && (
        <motion.div
          key="awaiting-feedback"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <p className="text-foreground font-mono text-xs tracking-[0.2em] uppercase">
            Evaluating your presentation…
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
