'use client';

import { useRef, useState } from 'react';
import { FilePptIcon, SpinnerGapIcon, UploadSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import {
  AUDIENCE_PERSONAS,
  type AudiencePersonaId,
  type ParsedDeck,
  isAudiencePersonaId,
} from '@/lib/podium';
import { cn } from '@/lib/shadcn/utils';

interface SetupViewProps {
  startButtonText: string;
  onStart: (args: { persona: AudiencePersonaId; deck: ParsedDeck }) => void | Promise<void>;
}

export function SetupView({
  startButtonText,
  onStart,
  ref,
}: React.ComponentProps<'div'> & SetupViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [persona, setPersona] = useState<AudiencePersonaId>('executive');
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [starting, setStarting] = useState(false);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setParsing(true);
    setDeck(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/parse-pptx', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to parse PowerPoint');
      }
      setDeck(payload as ParsedDeck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PowerPoint');
    } finally {
      setParsing(false);
    }
  }

  async function handleStart() {
    if (!deck) {
      setError('Upload a PowerPoint deck to begin');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await onStart({ persona, deck });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStarting(false);
    }
  }

  return (
    <div ref={ref} className="mx-auto w-full max-w-2xl px-4 py-16 md:py-24">
      <section className="flex flex-col items-center text-center">
        <p className="text-primary font-mono text-xs font-bold tracking-[0.2em] uppercase">
          Podium
        </p>
        <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Practice your presentation
        </h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-6 md:text-base">
          Upload your deck, present to an AI audience, then get scored feedback on your delivery and
          answers.
        </p>
      </section>

      <div className="mt-10 space-y-8 text-left">
        <div>
          <label className="text-foreground text-sm font-medium">1. Upload PowerPoint</label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-border bg-background hover:bg-muted/40 mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 transition-colors',
              deck && 'border-primary/40 bg-primary/5'
            )}
          >
            {parsing ? (
              <SpinnerGapIcon className="text-muted-foreground size-8 animate-spin" />
            ) : deck ? (
              <FilePptIcon className="text-primary size-8" weight="duotone" />
            ) : (
              <UploadSimpleIcon className="text-muted-foreground size-8" />
            )}
            <span className="text-foreground text-sm font-medium">
              {parsing
                ? 'Extracting slides…'
                : deck
                  ? deck.fileName
                  : 'Drop a .pptx or click to browse'}
            </span>
            {deck && (
              <span className="text-muted-foreground text-xs">
                {deck.slideCount} slide{deck.slideCount === 1 ? '' : 's'} parsed
              </span>
            )}
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
          disabled={!deck || parsing || starting}
          onClick={() => void handleStart()}
        >
          {starting ? 'Connecting…' : startButtonText}
        </Button>
      </div>
    </div>
  );
}
