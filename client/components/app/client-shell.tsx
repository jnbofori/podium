'use client';

import { usePathname } from 'next/navigation';
import { AppRail } from '@/components/app/app-rail';
import { AuthProvider } from '@/components/app/auth-provider';
import { ThemeProvider } from '@/components/app/theme-provider';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { cn } from '@/lib/shadcn/utils';

export function ClientShell({
  children,
  companyName,
  logo,
  logoDark,
}: {
  children: React.ReactNode;
  companyName: string;
  logo: string;
  logoDark?: string;
}) {
  const pathname = usePathname();
  const bare = pathname === '/login';

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <div className="atmosphere" aria-hidden />
        <div
          className={cn(
            'relative z-[1] flex min-h-dvh flex-col md:flex-row',
            bare && 'block'
          )}
        >
          <AppRail companyName={companyName} logo={logo} logoDark={logoDark} />
          <main className={cn('min-w-0 flex-1', !bare && 'md:min-h-dvh')}>{children}</main>
        </div>
        <div className="group fixed right-3 bottom-3 z-50 md:right-5 md:bottom-5">
          <ThemeToggle className="translate-y-16 opacity-40 transition-all delay-150 duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
