'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { Button } from '@/components/ui/button';
import { usePodiumControls } from '@/hooks/use-podium-room';
import type { AudiencePersonaId, SessionPhase } from '@/lib/podium';
import { AUDIENCE_PERSONAS } from '@/lib/podium';

interface PracticeSessionViewProps {
  appConfig: AppConfig;
  phase: Extract<SessionPhase, 'present' | 'qa'>;
  persona: AudiencePersonaId;
  onPhaseChange: (phase: Extract<SessionPhase, 'present' | 'qa'>) => void;
  onRequestFeedback: () => void;
}

export function PracticeSessionView({
  appConfig,
  phase,
  persona,
  onPhaseChange,
  onRequestFeedback,
  ...motionProps
}: React.ComponentProps<'section'> & PracticeSessionViewProps) {
  const { resolvedTheme } = useTheme();
  const { endPresentation, endSession, sending } = usePodiumControls();
  const [localBusy, setLocalBusy] = useState(false);
  const personaLabel = AUDIENCE_PERSONAS.find((item) => item.id === persona)?.label ?? 'Audience';

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
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-4 md:p-6">
        <div className="bg-background/90 border-border pointer-events-auto max-w-xl rounded-lg border px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-center font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
            {phase === 'present' ? 'Presenting' : 'Q&A'} · {personaLabel}
          </p>
          <p className="text-muted-foreground mt-1 text-center text-xs leading-5">
            {phase === 'present'
              ? 'Your audience is listening silently. Present your deck, then start Q&A when ready.'
              : 'Answer one question at a time. When finished, request your feedback report.'}
          </p>
          <div className="mt-3 flex justify-center">
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
        preConnectMessage={
          phase === 'present'
            ? 'Audience is listening — start your presentation'
            : 'Answer the audience questions'
        }
        className="fixed inset-0"
      />
    </div>
  );
}
