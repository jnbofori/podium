'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { Button } from '@/components/ui/button';
import { listDecks, listSessions, type ApiDeck, type ApiSession } from '@/lib/api';

export default function HubPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listDecks(), listSessions()])
      .then(([d, s]) => {
        setDecks(d.slice(0, 5));
        setSessions(s.slice(0, 5));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [user]);

  if (!ready || !user) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center font-mono text-xs tracking-wide uppercase">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full">
      <section className="px-5 pt-12 pb-10 md:px-10 md:pt-16 md:pb-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="kicker">Custom practice — made for the room</p>
          <p className="text-faint font-mono text-[9.5px] tracking-[0.16em] uppercase">
            Est. for presenters
          </p>
        </div>

        <h1 className="font-display text-primary mt-8 max-w-[11ch] text-5xl leading-[0.95] font-extrabold tracking-tight uppercase md:text-6xl lg:text-7xl">
          Step up. Speak. Get sharper.
        </h1>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-8">
          <p className="text-muted-foreground max-w-[38ch] text-[16px] leading-relaxed">
            Practice against a live audience persona. Present first, take questions second, then
            read a scored report of what landed and what didn&apos;t.
          </p>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Button size="lg" asChild>
              <Link href="/practice">
                <span className="stitch" aria-hidden />
                Start practice →
              </Link>
            </Button>
            <p className="text-faint text-right font-mono text-[9.5px] tracking-[0.16em] uppercase">
              Deck · audience · live room
            </p>
          </div>
        </div>
      </section>

      <section className="border-hair grid border-y sm:grid-cols-3">
        {[
          {
            n: '01',
            title: 'Upload a deck',
            desc: 'Bring a .pptx. We extract the narrative so the audience knows the story.',
          },
          {
            n: '02',
            title: 'Present, then Q&A',
            desc: 'The room listens silently until you say you are ready for questions.',
          },
          {
            n: '03',
            title: 'Get the report',
            desc: 'Scores, moments, and better approaches — not a generic pep talk.',
          },
        ].map((item, index) => (
          <div
            key={item.n}
            className={`border-hair px-5 py-8 md:px-8 ${index > 0 ? 'sm:border-l' : ''}`}
          >
            <div className="font-mono text-3xl text-primary md:text-4xl">{item.n}</div>
            <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      {error && <p className="text-destructive px-5 pt-6 text-sm md:px-10">{error}</p>}

      <section className="px-5 py-12 md:px-10 md:py-14">
        <div className="flex items-baseline justify-between gap-4">
          <p className="kicker">Recent decks</p>
          <Link
            href="/decks"
            className="text-muted-foreground hover:text-primary font-mono text-[10px] tracking-[0.16em] uppercase"
          >
            View all ↗
          </Link>
        </div>
        <ul className="mt-4">
          {decks.length === 0 ? (
            <li className="text-muted-foreground border-hair border-b py-4 text-sm">
              No decks yet — start a practice to upload one.
            </li>
          ) : (
            decks.map((deck) => (
              <li
                key={deck.id}
                className="border-hair flex items-center justify-between gap-4 border-b py-4"
              >
                <div>
                  <p className="text-sm font-medium">{deck.file_name}</p>
                  <p className="text-faint mt-0.5 font-mono text-[10px] tracking-wide uppercase">
                    {deck.slide_count} slides
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/practice?deck=${deck.id}`}>Practice</Link>
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="px-5 pb-16 md:px-10 md:pb-20">
        <div className="flex items-baseline justify-between gap-4">
          <p className="kicker">Recent sessions</p>
          <Link
            href="/history"
            className="text-muted-foreground hover:text-primary font-mono text-[10px] tracking-[0.16em] uppercase"
          >
            View all ↗
          </Link>
        </div>
        <ul className="mt-4">
          {sessions.length === 0 ? (
            <li className="text-muted-foreground border-hair border-b py-4 text-sm">
              No sessions yet.
            </li>
          ) : (
            sessions.map((session) => (
              <li key={session.id} className="border-hair border-b py-4">
                <Link href={`/history/${session.id}`} className="block hover:opacity-80">
                  <p className="text-sm font-medium">
                    {session.deck_file_name ?? 'Deck'} ·{' '}
                    {session.persona.replaceAll('_', ' ')}
                  </p>
                  <p className="text-faint mt-0.5 font-mono text-[10px] tracking-wide uppercase">
                    {new Date(session.started_at).toLocaleString()} · {session.status}
                    {session.overall_score != null ? ` · ${session.overall_score}/10` : ''}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
