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
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-24 pb-16">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Continue practicing or review past sessions.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/practice">New practice</Link>
        </Button>
      </div>
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Recent decks</h2>
          <Link href="/decks" className="text-muted-foreground text-xs underline">
            View all
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {decks.length === 0 ? (
            <li className="text-muted-foreground text-sm">No decks yet.</li>
          ) : (
            decks.map((deck) => (
              <li
                key={deck.id}
                className="border-border flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{deck.file_name}</p>
                  <p className="text-muted-foreground text-xs">{deck.slide_count} slides</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/practice?deck=${deck.id}`}>Practice</Link>
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Recent sessions</h2>
          <Link href="/history" className="text-muted-foreground text-xs underline">
            View all
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <li className="text-muted-foreground text-sm">No sessions yet.</li>
          ) : (
            sessions.map((session) => (
              <li key={session.id} className="border-border rounded-lg border px-4 py-3">
                <Link href={`/history/${session.id}`} className="block">
                  <p className="text-sm font-medium">
                    {session.deck_file_name ?? 'Deck'} · {session.persona.replaceAll('_', ' ')}
                  </p>
                  <p className="text-muted-foreground text-xs">
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
