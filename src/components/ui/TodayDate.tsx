'use client';

import { useEffect, useState } from 'react';

export function TodayDate() {
  const [dateStr, setDateStr] = useState<string | null>(null);

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }));
  }, []);

  return <>{dateStr}</>;
}
