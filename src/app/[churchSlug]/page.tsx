'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChurchIndexPage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${churchSlug}/home`);
  }, [churchSlug, router]);

  return null;
}

