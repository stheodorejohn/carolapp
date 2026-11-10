'use client';

/**
 * Public Live Entrance by Church Slug
 *
 * Resolves the church's active carol group and redirects to the public live page.
 * If no live group is currently active, displays a friendly status notice.
 */

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TreePine, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  params: Promise<{ churchSlug: string }>;
}

export default function ChurchLiveIndexPage({ params }: Props) {
  const { churchSlug } = use(params);
  const router = useRouter();
  const [noActiveEvent, setNoActiveEvent] = useState(false);
  const [churchName, setChurchName] = useState('');

  useEffect(() => {
    async function findLiveGroup() {
      try {
        const cleanSlug = churchSlug.trim().toLowerCase();

        // 1. Get church
        const { data: church } = await supabase
          .from('churches')
          .select('id, name')
          .eq('slug', cleanSlug)
          .maybeSingle();

        if (!church) {
          setNoActiveEvent(true);
          return;
        }

        setChurchName(church.name);

        // 2. Get active group for this church
        const { data: group } = await supabase
          .from('groups')
          .select('id, slug')
          .eq('church_id', church.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (group) {
          const groupTarget = group.slug || group.id;
          router.replace(`/${cleanSlug}/live/${groupTarget}`);
        } else {
          setNoActiveEvent(true);
        }
      } catch (err) {
        console.error('[ChurchLiveIndexPage] error:', err);
        setNoActiveEvent(true);
      }
    }

    findLiveGroup();
  }, [churchSlug, router]);

  if (noActiveEvent) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-white/10 text-amber-400 mb-4 shadow-lg">
          <AlertCircle size={32} />
        </span>
        <h1 className="text-xl font-bold">
          {churchName ? `${churchName} Live Tracking` : 'Live Tracking Unavailable'}
        </h1>
        <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
          There is no live caroling group currently broadcasting location for this church.
          Please check back when the carol event begins.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white gap-3">
      <TreePine size={36} className="text-green-500 animate-pulse" />
      <p className="text-xs text-slate-400">Connecting to live caroling tracking…</p>
    </div>
  );
}

