'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChurchAdminIndexPage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${churchSlug}/admin/dashboard`);
  }, [churchSlug, router]);

  return null;
}

