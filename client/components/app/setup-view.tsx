'use client';

import { useEffect, useRef, useState } from 'react';
import { FilePptIcon, SpinnerGapIcon, UploadSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { listDecks, uploadDeck, type ApiDeck } from '@/lib/api';
import {
  AUDIENCE_PERSONAS,
  type AudiencePersonaId,
  formatPersonaLabels,
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
    personas: AudiencePersonaId[];
    deck: PracticeDeckSelection;
  }) => void | Promise<void>;
}

type SetupStep = 1 | 2 | 3;

const REQUIRED_PERSONA_COUNT = 2;

export function SetupView({
  startButtonText,
  initialDeckId,
  onStart,
  ref,
}: React.ComponentProps<'div'> & SetupViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<SetupStep>(1);
  const [personas, setPersonas] = useState<AudiencePersonaId[]>([
    'executive',
    'technical_lead',
  ]);
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

  const selectedDeck =
    uploaded && uploaded.id === selectedDeckId
      ? uploaded
      : library.find((d) => d.id === selectedDeckId) ?? null;

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
    if (!selectedDeck) {
      setError('Upload or select a PowerPoint deck to begin');
      return;
    }
    if (personas.length !== REQUIRED_PERSONA_COUNT) {
      setError('Pick exactly two audience members');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await onStart({
        personas,
        deck: {
          id: selectedDeck.id,
          fileName: selectedDeck.file_name,
          plainText: selectedDeck.plain_text,
          slideCount: selectedDeck.slide_count,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStarting(false);
    }
  }

  function togglePersona(id: AudiencePersonaId) {
    setPersonas((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= REQUIRED_PERSONA_COUNT) {
        return [...current.slice(1), id];
      }
      return [...current, id];
    });
  }

  const personaLabel = formatPersonaLabels(personas);
  const canContinueAudience = personas.length === REQUIRED_PERSONA_COUNT;

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Practice session — made to order</p>
          <h1 className="font-display text-foreground mt-3 max-w-[12ch] text-3xl leading-[0.95] font-extrabold tracking-tight uppercase md:text-4xl">
            Your deck, your audience.
          </h1>
        </div>
        <p className="text-faint font-mono text-[9.5px] tracking-[0.16em] uppercase">
          3 steps · ~2 min · live feedback
        </p>
      </header>

      <p className="text-muted-foreground mt-4 max-w-[42ch] text-sm leading-relaxed">
        Upload a deck, pick who you&apos;re pitching to, then present. The room listens first —
        questions come when you&apos;re ready.
      </p>

      <ol className="border-hair mt-8 grid border-t sm:grid-cols-3">
        {(
          [
            { n: 1, title: 'Choose your deck' },
            { n: 2, title: 'Pick your panel' },
            { n: 3, title: 'Start practice' },
          ] as const
        ).map((item, index) => (
          <li
            key={item.n}
            className={cn(
              'border-hair px-0 py-4 sm:px-5 sm:py-5',
              index > 0 && 'sm:border-l',
              step === item.n && 'opacity-100',
              step !== item.n && 'opacity-50'
            )}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => {
                if (
                  item.n === 1 ||
                  (item.n === 2 && selectedDeckId) ||
                  (item.n === 3 && selectedDeckId && canContinueAudience)
                ) {
                  setStep(item.n);
                }
              }}
            >
              <div className="font-mono text-2xl text-primary">
                {String(item.n).padStart(2, '0')}
              </div>
              <div className="mt-1.5 text-sm font-semibold">{item.title}</div>
            </button>
          </li>
        ))}
      </ol>

      <div className="border-hair mt-2 border-t pt-6">
        {step === 1 && (
          <section>
            <p className="kicker">01 — Deck</p>
            {library.length > 0 && (
              <div className="mt-3 max-h-[28vh] space-y-0 overflow-y-auto">
                {library.slice(0, 8).map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeckId(deck.id);
                      setUploaded(null);
                    }}
                    className={cn(
                      'border-hair hover:bg-primary/5 flex w-full items-center justify-between border-b px-1 py-3 text-left text-sm transition-colors',
                      selectedDeckId === deck.id && 'bg-primary/5 text-foreground'
                    )}
                  >
                    <div>
                      <div className="font-medium">{deck.file_name}</div>
                      <div className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-wide uppercase">
                        {deck.slide_count} slides
                      </div>
                    </div>
                    {selectedDeckId === deck.id && (
                      <span className="text-primary font-mono text-[10px] tracking-[0.16em] uppercase">
                        Selected
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-hair hover:border-primary/40 mt-4 flex w-full flex-col items-center justify-center gap-1.5 border border-dashed px-6 py-6 transition-colors',
                uploaded && 'border-primary/50 bg-primary/5'
              )}
            >
              {parsing ? (
                <SpinnerGapIcon className="text-muted-foreground size-6 animate-spin" />
              ) : uploaded ? (
                <FilePptIcon className="text-primary size-6" weight="duotone" />
              ) : (
                <UploadSimpleIcon className="text-muted-foreground size-6" />
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
            {error && (
              <p className="text-destructive mt-3 text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                disabled={!selectedDeckId || parsing}
                onClick={() => setStep(2)}
              >
                <span className="stitch" aria-hidden />
                Continue →
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="kicker">02 — Audience</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Pick exactly two audience members for your practice panel.
            </p>
            <div className="mt-3 grid gap-0 sm:grid-cols-2">
              {AUDIENCE_PERSONAS.map((option) => {
                const selected = personas.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => togglePersona(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      'border-hair hover:bg-primary/5 border-b px-1 py-3 text-left transition-colors sm:odd:border-r sm:px-4',
                      selected && 'bg-primary/10 ring-2 ring-inset ring-primary'
                    )}
                  >
                    <div className="text-foreground text-sm font-semibold">{option.label}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs leading-snug">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-faint mt-3 font-mono text-[10px] tracking-[0.16em] uppercase">
              Selected {personas.length}/{REQUIRED_PERSONA_COUNT}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button size="lg" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!canContinueAudience}
                onClick={() => setStep(3)}
              >
                <span className="stitch" aria-hidden />
                Continue →
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="kicker">03 — Confirm</p>
            <div className="border-hair mt-3 border-y py-5">
              <dl className="space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-faint font-mono text-[10px] tracking-[0.16em] uppercase">
                    Deck
                  </dt>
                  <dd className="text-sm font-medium">
                    {selectedDeck?.file_name ?? '—'}
                    {selectedDeck ? (
                      <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                        {selectedDeck.slide_count} slides
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-faint font-mono text-[10px] tracking-[0.16em] uppercase">
                    Audience
                  </dt>
                  <dd className="text-sm font-medium">{personaLabel}</dd>
                </div>
              </dl>
            </div>
            {error && (
              <p className="text-destructive mt-3 text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button size="lg" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!selectedDeckId || parsing || starting}
                onClick={() => void handleStart()}
              >
                <span className="stitch" aria-hidden />
                {starting ? 'Connecting…' : startButtonText}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
