'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/practice', label: 'Practice' },
  { href: '/decks', label: 'Decks' },
  { href: '/history', label: 'History' },
];

export function AppHeader({
  companyName,
  logo,
  logoDark,
}: {
  companyName: string;
  logo: string;
  logoDark?: string;
}) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="border-border bg-background/80 fixed top-0 left-0 z-50 flex w-full items-center justify-between border-b px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={`${companyName} Logo`} className="block size-6 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDark ?? logo}
            alt={`${companyName} Logo`}
            className="hidden size-6 dark:block"
          />
          <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
            {companyName}
          </span>
        </Link>
        {ready && user && (
          <nav className="hidden items-center gap-3 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'font-mono text-[11px] font-bold tracking-wider uppercase',
                  pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        {ready && user ? (
          <>
            <span className="text-muted-foreground hidden text-xs sm:inline">{user.email}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                logout();
                router.push('/login');
              }}
            >
              Sign out
            </Button>
          </>
        ) : ready ? (
          <Button size="sm" onClick={() => router.push('/login')}>
            Sign in
          </Button>
        ) : null}
      </div>
    </header>
  );
}
