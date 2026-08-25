'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { listSessions, type ApiSession } from '@/lib/api';

export default function HistoryPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    listSessions()
      .then(setSessions)
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
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <p className="text-muted-foreground mt-2 text-sm">Past practice sessions and scores.</p>
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      <ul className="mt-8 space-y-2">
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
    </div>
  );
}
