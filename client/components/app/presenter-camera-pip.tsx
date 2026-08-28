'use client';

import { useEffect, useMemo } from 'react';
import { Track } from 'livekit-client';
import {
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useSessionContext,
} from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';

const FLOATING_SQUARE =
  'rounded-xl border bg-[oklch(0.18_0.015_260)] shadow-[8px_8px_18px_oklch(0.08_0.02_260/70%),-6px_-6px_14px_oklch(0.28_0.02_260/45%)]';

export function PresenterCameraPiP() {
  const session = useSessionContext();
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(Track.Source.Camera);
  const cameraTrack = useMemo<TrackReference | undefined>(
    () =>
      publication
        ? {
            source: Track.Source.Camera,
            participant: localParticipant,
            publication,
          }
        : undefined,
    [publication, localParticipant]
  );

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted;

  useEffect(() => {
    if (!session.isConnected) return;
    void localParticipant.setCameraEnabled(true).catch((error) => {
      console.error('Failed to enable camera', error);
    });
  }, [session.isConnected, localParticipant]);

  const width = cameraTrack?.publication.dimensions?.width ?? 0;
  const height = cameraTrack?.publication.dimensions?.height ?? 0;

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-4 bottom-28 z-45 md:right-8 md:bottom-36',
        'w-32 md:w-44'
      )}
      aria-label="Presenter camera preview"
    >
      <div
        className={cn(
          FLOATING_SQUARE,
          'border-primary/45 relative aspect-video w-full overflow-hidden'
        )}
      >
        {isCameraEnabled ? (
          <VideoTrack
            trackRef={cameraTrack}
            width={width}
            height={height}
            className="size-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center px-2 text-center text-[10px] leading-tight md:text-xs">
            Camera off
          </div>
        )}
      </div>
    </div>
  );
}
