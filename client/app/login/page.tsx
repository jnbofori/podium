'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, ready, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace('/');
    }
  }, [ready, user, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName || undefined);
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    'border-input bg-card text-foreground mt-2 w-full border px-4 py-3 text-sm outline-none focus:border-primary';

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-16">
      <p className="kicker text-center">Podium</p>
      <h1 className="font-display text-foreground mt-4 text-center text-4xl font-extrabold tracking-tight uppercase">
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </h1>
      <p className="text-muted-foreground mt-3 text-center text-sm leading-relaxed">
        Practice against a live audience. Scores stay with your account.
      </p>
      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        {mode === 'register' && (
          <div>
            <label className="kicker">Display name</label>
            <input
              className={fieldClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="kicker">Email</label>
          <input
            type="email"
            required
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="kicker">Password</label>
          <input
            type="password"
            required
            minLength={8}
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <span className="stitch" aria-hidden />
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
        </Button>
      </form>
      <button
        type="button"
        className="text-muted-foreground hover:text-primary mt-6 text-center font-mono text-[10px] tracking-[0.16em] uppercase"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
