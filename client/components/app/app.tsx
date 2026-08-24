'use client';

import { useMemo, useRef } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import type { AudiencePersonaId, ParsedDeck, PodiumJobMetadata } from '@/lib/podium';
import { truncateDeckText } from '@/lib/podium';
import { getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const metadataRef = useRef<PodiumJobMetadata | null>(null);

  const tokenSource = useMemo(() => {
    if (typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string') {
      return getSandboxTokenSource(appConfig, () => metadataRef.current);
    }

    return TokenSource.custom(async () => {
      const metadata = metadataRef.current;
      const roomConfig = appConfig.agentName
        ? {
            agents: [
              {
                agent_name: appConfig.agentName,
                metadata: metadata ? JSON.stringify(metadata) : '{}',
              },
            ],
          }
        : undefined;
      console.log('roomConfig', roomConfig);

      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_config: roomConfig }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch connection details');
      }

      return response.json();
    });
  }, [appConfig]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  function handlePrepareSession(args: { persona: AudiencePersonaId; deck: ParsedDeck }) {
    metadataRef.current = {
      persona: args.persona,
      deckPlainText: truncateDeckText(args.deck.plainText),
      slideCount: args.deck.slideCount,
      fileName: args.deck.fileName,
    };
  }

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} onPrepareSession={handlePrepareSession} />
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
