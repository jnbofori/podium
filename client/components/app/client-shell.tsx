'use client';

import { AppHeader } from '@/components/app/app-header';
import { AuthProvider } from '@/components/app/auth-provider';
import { ThemeProvider } from '@/components/app/theme-provider';
import { ThemeToggle } from '@/components/app/theme-toggle';

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
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <AppHeader companyName={companyName} logo={logo} logoDark={logoDark} />
        {children}
        <div className="group fixed bottom-0 left-1/2 z-50 mb-2 -translate-x-1/2">
          <ThemeToggle className="translate-y-20 transition-transform delay-150 duration-300 group-hover:translate-y-0" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
