'use client';

import { useEffect, useRef, useState } from 'react';
import { FilePptIcon, SpinnerGapIcon, UploadSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { listDecks, uploadDeck, type ApiDeck } from '@/lib/api';
import {
  AUDIENCE_PERSONAS,
  type AudiencePersonaId,
  isAudiencePersonaId,
} from '@/lib/podium';
import { cn } from '@/lib/shadcn/utils';

export type PracticeDeckSelection = {
  id: string;
  fileName: string;
  plainText: string;
  slideCount: number;
};

interface SetupViewProps {
  startButtonText: string;
  initialDeckId?: string | null;
  onStart: (args: {
    persona: AudiencePersonaId;
    deck: PracticeDeckSelection;
  }) => void | Promise<void>;
}

export function SetupView({
  startButtonText,
  initialDeckId,
  onStart,
  ref,
}: React.ComponentProps<'div'> & SetupViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [persona, setPersona] = useState<AudiencePersonaId>('executive');
  const [library, setLibrary] = useState<ApiDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId ?? null);
  const [uploaded, setUploaded] = useState<ApiDeck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    listDecks()
      .then((decks) => {
        setLibrary(decks);
        if (initialDeckId && decks.some((d) => d.id === initialDeckId)) {
          setSelectedDeckId(initialDeckId);
        }
      })
      .catch(() => {
        // Library optional at setup if API unreachable; upload can still work after auth.
      });
  }, [initialDeckId]);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setParsing(true);
    setUploaded(null);
    try {
      const deck = await uploadDeck(file);
      setUploaded(deck);
      setSelectedDeckId(deck.id);
      setLibrary((prev) => [deck, ...prev.filter((d) => d.id !== deck.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PowerPoint');
    } finally {
      setParsing(false);
    }
  }

  async function handleStart() {
    const deck =
      uploaded && uploaded.id === selectedDeckId
        ? uploaded
        : library.find((d) => d.id === selectedDeckId);
    if (!deck) {
      setError('Upload or select a PowerPoint deck to begin');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await onStart({
        persona,
        deck: {
          id: deck.id,
          fileName: deck.file_name,
          plainText: deck.plain_text,
          slideCount: deck.slide_count,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStarting(false);
    }
  }

  return (
    <div ref={ref} className="mx-auto w-full max-w-2xl px-4 py-16 md:py-24">
      <section className="flex flex-col items-center text-center">
        <p className="text-primary font-mono text-xs font-bold tracking-[0.2em] uppercase">Podium</p>
        <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Practice your presentation
        </h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-6 md:text-base">
          Choose a saved deck or upload a new one, pick an audience, then present.
        </p>
      </section>

      <div className="mt-10 space-y-8 text-left">
        <div>
          <label className="text-foreground text-sm font-medium">1. Deck</label>
          {library.length > 0 && (
            <div className="mt-2 space-y-2">
              {library.slice(0, 8).map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => {
                    setSelectedDeckId(deck.id);
                    setUploaded(null);
                  }}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                    selectedDeckId === deck.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className="font-medium">{deck.file_name}</div>
                  <div className="text-muted-foreground text-xs">{deck.slide_count} slides</div>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-border bg-background hover:bg-muted/40 mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 transition-colors',
              uploaded && 'border-primary/40 bg-primary/5'
            )}
          >
            {parsing ? (
              <SpinnerGapIcon className="text-muted-foreground size-8 animate-spin" />
            ) : uploaded ? (
              <FilePptIcon className="text-primary size-8" weight="duotone" />
            ) : (
              <UploadSimpleIcon className="text-muted-foreground size-8" />
            )}
            <span className="text-foreground text-sm font-medium">
              {parsing
                ? 'Uploading & extracting…'
                : uploaded
                  ? uploaded.file_name
                  : 'Upload a new .pptx'}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
          />
        </div>

        <div>
          <label className="text-foreground text-sm font-medium">2. Choose your audience</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {AUDIENCE_PERSONAS.map((option) => {
              const selected = persona === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPersona(option.id)}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className="text-foreground text-sm font-medium">{option.label}</div>
                  <div className="text-muted-foreground mt-1 text-xs leading-5">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <select
            className="sr-only"
            value={persona}
            onChange={(event) => {
              if (isAudiencePersonaId(event.target.value)) {
                setPersona(event.target.value);
              }
            }}
            aria-hidden
            tabIndex={-1}
          >
            {AUDIENCE_PERSONAS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
          disabled={!selectedDeckId || parsing || starting}
          onClick={() => void handleStart()}
        >
          {starting ? 'Connecting…' : startButtonText}
        </Button>
      </div>
    </div>
  );
}
