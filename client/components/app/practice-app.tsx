'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AppConfig } from '@/app-config';
import { useAuth } from '@/components/app/auth-provider';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { createSession, getLiveKitToken, getToken } from '@/lib/api';
import type { AudiencePersonaId } from '@/lib/podium';
import type { PracticeDeckSelection } from '@/components/app/setup-view';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface PracticeAppProps {
  appConfig: AppConfig;
}

export function PracticeApp({ appConfig }: PracticeAppProps) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDeckId = searchParams.get('deck');
  const sessionIdRef = useRef<string | null>(null);
  const [practiceSessionId, setPracticeSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        throw new Error('Practice session not created');
      }
      if (!getToken()) {
        throw new Error('Not authenticated');
      }
      const details = await getLiveKitToken(sessionId);
      return {
        serverUrl: details.server_url,
        roomName: details.room_name,
        participantName: details.participant_name,
        participantToken: details.participant_token,
      };
    });
  }, []);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  async function handlePrepareAndStart(args: {
    persona: AudiencePersonaId;
    deck: PracticeDeckSelection;
  }) {
    const created = await createSession({
      deck_id: args.deck.id,
      persona: args.persona,
    });
    sessionIdRef.current = created.id;
    setPracticeSessionId(created.id);
    return created.id;
  }

  if (!ready || !user) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          initialDeckId={initialDeckId}
          practiceSessionId={practiceSessionId}
          onPrepareSession={handlePrepareAndStart}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
