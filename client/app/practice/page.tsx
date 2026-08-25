import { headers } from 'next/headers';
import { Suspense } from 'react';
import { PracticeApp } from '@/components/app/practice-app';
import { getAppConfig } from '@/lib/utils';

export default async function PracticePage() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
          Loading…
        </div>
      }
    >
      <PracticeApp appConfig={appConfig} />
    </Suspense>
  );
}
