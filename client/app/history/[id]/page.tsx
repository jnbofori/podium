'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { FeedbackView } from '@/components/app/feedback-view';
import { Button } from '@/components/ui/button';
import { getSession, type ApiSession } from '@/lib/api';
import type { FeedbackReport } from '@/lib/podium';

export default function HistoryDetailPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<ApiSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  useEffect(() => {
    if (!user || !params.id) return;
    getSession(params.id)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [user, params.id]);

  if (!ready || !user) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 md:px-10">
        <p className="text-destructive text-sm">{error}</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/history">Back</Link>
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center font-mono text-xs tracking-wide uppercase">
        Loading session…
      </div>
    );
  }

  if (!session.feedback) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 md:px-10">
        <p className="text-muted-foreground text-sm">
          This session has no feedback report yet ({session.status}).
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/history">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <FeedbackView
        report={session.feedback as unknown as FeedbackReport}
        onPracticeAgain={() => router.push(`/practice?deck=${session.deck_id}`)}
      />
    </div>
  );
}
