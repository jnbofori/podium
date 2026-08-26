'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/app/auth-provider';
import { cn } from '@/lib/shadcn/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/practice', label: 'Practice' },
  { href: '/decks', label: 'Decks' },
  { href: '/history', label: 'History' },
];

export function AppRail({
  companyName,
  logo,
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
    <aside
      className={cn(
        'bg-rail text-rail-foreground border-hair z-40 flex border-b md:sticky md:top-0 md:h-dvh md:w-[min(238px,16.5vw)] md:min-w-[200px] md:flex-none md:flex-col md:border-r md:border-b-0 md:px-[22px] md:py-[26px]',
        'sticky top-0 w-full flex-row items-center gap-4 px-5 py-3.5'
      )}
    >
      <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 md:block md:w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={`${companyName} logo`}
          className="size-8 shrink-0 md:size-10"
        />
        <span className="font-display text-foreground text-xl font-extrabold tracking-tight uppercase md:mt-3 md:text-[1.65rem] md:leading-none">
          {companyName}
        </span>
        <p className="text-faint mt-3 hidden font-mono text-[9px] leading-[1.8] tracking-[0.16em] uppercase md:block">
          Practice decks
          <br />
          Live audience
          <br />
          Honest feedback
        </p>
      </Link>

      <div className="flex flex-1 items-center justify-end gap-4 md:flex-col md:items-stretch md:justify-center md:gap-0">
        {ready && user ? (
          <>
            <nav className="hidden flex-col md:flex">
              {NAV.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'border-hair flex items-center justify-between border-b py-3.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors',
                    index === 0 && 'border-t',
                    pathname === item.href
                      ? 'text-primary'
                      : 'text-foreground hover:text-primary'
                  )}
                >
                  <span>{item.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              ))}
            </nav>
            <nav className="flex items-center gap-3 md:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'font-mono text-[9px] font-bold tracking-[0.14em] uppercase',
                    pathname === item.href ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              className="text-muted-foreground hover:text-primary hidden border-0 bg-transparent p-0 text-left font-mono text-[10px] tracking-[0.18em] uppercase md:mt-6 md:block"
              onClick={() => {
                logout();
                router.push('/login');
              }}
            >
              Sign out
            </button>
          </>
        ) : ready ? (
          <Link
            href="/login"
            className="text-foreground hover:text-primary font-mono text-[10px] tracking-[0.18em] uppercase"
          >
            Sign in →
          </Link>
        ) : null}
      </div>

      <div className="text-faint mt-auto hidden font-mono text-[9px] leading-[2] tracking-[0.14em] uppercase md:block">
        {user?.email ? (
          <>
            {user.email}
            <br />
          </>
        ) : null}
        © {new Date().getFullYear()} {companyName}
      </div>
    </aside>
  );
}
