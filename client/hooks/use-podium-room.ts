'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type Room, RoomEvent } from 'livekit-client';
import { useSessionContext } from '@livekit/components-react';
import {
  CONTROL_TOPIC,
  FEEDBACK_TOPIC,
  type FeedbackReport,
  PHASE_TOPIC,
  SPEAKER_TOPIC,
  type AudiencePersonaId,
  type SessionPhase,
  isAudiencePersonaId,
} from '@/lib/podium';

function decodePayload(payload: Uint8Array): string {
  return new TextDecoder().decode(payload);
}

export function usePodiumRoomEvents(args: {
  onFeedback: (report: FeedbackReport) => void;
  onPhase: (phase: SessionPhase) => void;
}) {
  const session = useSessionContext();
  const room = session.room as Room | undefined;
  const onFeedbackRef = useRef(args.onFeedback);
  const onPhaseRef = useRef(args.onPhase);

  useEffect(() => {
    onFeedbackRef.current = args.onFeedback;
    onPhaseRef.current = args.onPhase;
  }, [args.onFeedback, args.onPhase]);

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string
    ) => {
      try {
        const text = decodePayload(payload);
        if (topic === FEEDBACK_TOPIC) {
          onFeedbackRef.current(JSON.parse(text) as FeedbackReport);
          return;
        }
        if (topic === PHASE_TOPIC) {
          const parsed = JSON.parse(text) as { phase?: SessionPhase };
          if (parsed.phase === 'present' || parsed.phase === 'qa') {
            onPhaseRef.current(parsed.phase);
          }
        }
      } catch (error) {
        console.error('Failed to parse podium data message', error);
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);
}

export function usePodiumSpeaker(initialPersonaId: AudiencePersonaId | null) {
  const session = useSessionContext();
  const room = session.room as Room | undefined;
  const [activePersonaId, setActivePersonaId] = useState<AudiencePersonaId | null>(
    initialPersonaId
  );

  useEffect(() => {
    setActivePersonaId(initialPersonaId);
  }, [initialPersonaId]);

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== SPEAKER_TOPIC) return;
      try {
        const parsed = JSON.parse(decodePayload(payload)) as { persona?: string };
        if (parsed.persona && isAudiencePersonaId(parsed.persona)) {
          setActivePersonaId(parsed.persona);
        }
      } catch (error) {
        console.error('Failed to parse speaker message', error);
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  return { activePersonaId };
}

export function usePodiumControls() {
  const session = useSessionContext();
  const room = session.room as Room | undefined;
  const [sending, setSending] = useState(false);

  const publishControl = useCallback(
    async (action: 'end_presentation' | 'end_session') => {
      if (!room?.localParticipant) {
        throw new Error('Not connected to a room');
      }
      setSending(true);
      try {
        const data = new TextEncoder().encode(JSON.stringify({ action }));
        await room.localParticipant.publishData(data, {
          reliable: true,
          topic: CONTROL_TOPIC,
        });
      } finally {
        setSending(false);
      }
    },
    [room]
  );

  return {
    endPresentation: () => publishControl('end_presentation'),
    endSession: () => publishControl('end_session'),
    sending,
  };
}
