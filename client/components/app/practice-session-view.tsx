'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { PresenterCameraPiP } from '@/components/app/presenter-camera-pip';
import { SlideViewer } from '@/components/app/slide-viewer';
import { Button } from '@/components/ui/button';
import { usePodiumControls, usePodiumSpeaker } from '@/hooks/use-podium-room';
import type { AudiencePersonaId, SessionPhase } from '@/lib/podium';
import { formatPersonaLabels } from '@/lib/podium';

interface PracticeSessionViewProps {
  appConfig: AppConfig;
  phase: Extract<SessionPhase, 'present' | 'qa'>;
  personas: AudiencePersonaId[];
  deckId: string | null;
  onPhaseChange: (phase: Extract<SessionPhase, 'present' | 'qa'>) => void;
  onRequestFeedback: () => void;
}

export function PracticeSessionView({
  appConfig,
  phase,
  personas,
  deckId,
  onPhaseChange,
  onRequestFeedback,
  ...motionProps
}: React.ComponentProps<'section'> & PracticeSessionViewProps) {
  const { resolvedTheme } = useTheme();
  const { endPresentation, endSession, sending } = usePodiumControls();
  const { activePersonaId } = usePodiumSpeaker(personas[0] ?? null);
  const [localBusy, setLocalBusy] = useState(false);
  const personaLabel = formatPersonaLabels(personas);

  async function handleEndPresentation() {
    setLocalBusy(true);
    try {
      await endPresentation();
      onPhaseChange('qa');
    } catch (error) {
      console.error(error);
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleGetFeedback() {
    setLocalBusy(true);
    try {
      await endSession();
      onRequestFeedback();
    } catch (error) {
      console.error(error);
      onRequestFeedback();
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <div className="relative h-full min-h-svh w-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start p-4 md:px-8 md:pt-5">
        <div className="bg-background/90 border-hair pointer-events-auto w-full max-w-md border px-4 py-3 backdrop-blur md:max-w-lg">
          <p className="kicker">
            {phase === 'present' ? 'Presenting' : 'Q&A'} · {personaLabel}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-5">
            {phase === 'present'
              ? 'Start Q&A when you are ready.'
              : 'Answer one question at a time. When finished, request your feedback report.'}
          </p>
          <div className="mt-3 flex justify-start">
            {phase === 'present' ? (
              <Button
                size="sm"
                disabled={sending || localBusy}
                onClick={() => void handleEndPresentation()}
              >
                I&apos;m done — ask me questions
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={sending || localBusy}
                onClick={() => void handleGetFeedback()}
              >
                End Q&A & get feedback
              </Button>
            )}
          </div>
        </div>
      </div>

      <PresenterCameraPiP />

      <AgentSessionView_01
        {...motionProps}
        supportsChatInput={appConfig.supportsChatInput}
        supportsVideoInput={appConfig.supportsVideoInput}
        supportsScreenShare={appConfig.supportsScreenShare}
        isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
        audioVisualizerType={appConfig.audioVisualizerType}
        audioVisualizerColor={
          resolvedTheme === 'dark'
            ? appConfig.audioVisualizerColorDark
            : appConfig.audioVisualizerColor
        }
        audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
        audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
        audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
        audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
        audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
        presentationLayout
        panelPersonas={personas}
        activePersonaId={activePersonaId}
        mainContent={
          deckId ? (
            <SlideViewer deckId={deckId} className="h-full min-h-0" />
          ) : (
            <p className="text-muted-foreground text-sm">No deck selected.</p>
          )
        }
        preConnectMessage={
          phase === 'present'
            ? 'Your audience will welcome you — we will begin shortly'
            : 'Answer the audience questions'
        }
        className="absolute inset-0"
      />
    </div>
  );
}
