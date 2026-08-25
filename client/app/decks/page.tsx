'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { Button } from '@/components/ui/button';
import { deleteDeck, listDecks, type ApiDeck } from '@/lib/api';

export default function DecksPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  async function refresh() {
    const data = await listDecks();
    setDecks(data);
  }

  useEffect(() => {
    if (!user) return;
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Decks</h1>
          <p className="text-muted-foreground mt-2 text-sm">Your saved PowerPoint library.</p>
        </div>
        <Button asChild>
          <Link href="/practice">Upload & practice</Link>
        </Button>
      </div>
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      <ul className="mt-8 space-y-2">
        {decks.length === 0 ? (
          <li className="text-muted-foreground text-sm">No decks uploaded yet.</li>
        ) : (
          decks.map((deck) => (
            <li
              key={deck.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{deck.file_name}</p>
                <p className="text-muted-foreground text-xs">
                  {deck.slide_count} slides · {new Date(deck.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/practice?deck=${deck.id}`}>Practice</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === deck.id}
                  onClick={() => {
                    setBusyId(deck.id);
                    deleteDeck(deck.id)
                      .then(refresh)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : 'Delete failed')
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
