'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TreePine, Users, Plus } from 'lucide-react';

export default function TrackingIndexPage() {
  const router = useRouter();
  const { currentChurch } = useAuth();
  const [noGroup, setNoGroup] = useState(false);

  useEffect(() => {
    async function redirect() {
      let query = supabase
        .from('groups')
        .select('id, slug')
        .eq('is_active', true);

      if (currentChurch?.id) {
        query = query.eq('church_id', currentChurch.id);
      }

      const { data } = await query
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data?.id) {
        const target = data.slug || data.id;
        if (currentChurch?.slug) {
          router.replace(`/${currentChurch.slug}/tracking/${target}`);
        } else {
          router.replace(`/tracking/${target}`);
        }
      } else {
        setNoGroup(true);
      }
    }
    redirect();
  }, [currentChurch?.id, currentChurch?.slug, router]);

  if (!noGroup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <TreePine size={40} className="text-green-600 animate-pulse" />
        <p className="text-slate-500 text-sm">Finding your carol group…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-slate-50 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center">
        <Users size={36} className="text-green-600" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-800">No Carol Group Yet</h2>
        <p className="text-sm text-slate-400 mt-1">
          Create a group first so the team can start tracking and sharing their location.
        </p>
      </div>
      <Link
        href="/settings/groups/new"
        className="flex items-center gap-2 bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform"
      >
        <Plus size={16} /> Create Carol Group
      </Link>
      <Link href="/settings/groups" className="text-sm text-slate-400 underline underline-offset-2">
        Manage existing groups
      </Link>
    </div>
  );
}

