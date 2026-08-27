'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { listSessions, type ApiSession } from '@/lib/api';
import { formatPersonaLabels } from '@/lib/podium';

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
    <div className="mx-auto w-full max-w-3xl px-5 py-12 md:px-10 md:py-16">
      <p className="kicker">Archive</p>
      <h1 className="font-display text-foreground mt-3 text-4xl font-extrabold tracking-tight uppercase">
        History
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">Past practice sessions and scores.</p>
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      <ul className="border-hair mt-10 border-t">
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
                  {formatPersonaLabels(session.personas?.length ? session.personas : [session.persona])}
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
    </div>
  );
}
