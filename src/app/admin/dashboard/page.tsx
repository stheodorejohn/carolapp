'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import type { DashboardStats, Route } from '@/types/database';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_families: 0,
    visited: 0,
    pending: 0,
    in_progress: 0,
  });
  const [inProgress, setInProgress] = useState<Route | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { count: total },
        { count: visited },
        { count: inProg },
        { count: pending },
      ] = await Promise.all([
        supabase.from('families').select('*', { count: 'exact', head: true }),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'visited'),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        total_families: total ?? 0,
        visited: visited ?? 0,
        in_progress: inProg ?? 0,
        pending: pending ?? 0,
      });

      // Fetch active group ID for tracking link
      const { data: activeGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setGroupId(activeGroup?.id ?? null);

      const { data: inProgData } = await supabase
        .from('routes')
        .select('*, family:families(*)')
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle();

      setInProgress(inProgData as Route | null);
    } catch (err) {
      console.error('[AdminDashboardPage] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const visitedPct =
    stats.total_families > 0
      ? Math.round((stats.visited / stats.total_families) * 100)
      : 0;

  return (
    <div className="page-container bg-slate-50">
      {/* ── Header ── */}
      <div className="hero-gradient px-5 pt-14 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-300 text-sm">Welcome back</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Good morning, Admin</h1>
          </div>
          <button
            onClick={loadData}
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 text-white"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* ── Date strip ── */}
        <div className="carol-card flex items-center gap-3 px-4 py-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50">
            <CalendarDays size={18} className="text-green-700" />
          </span>
          <div className="flex-1">
            <p className="text-xs text-slate-400">Today&apos;s Carol Day</p>
            <p className="text-sm font-semibold text-slate-700">{dateStr}</p>
          </div>
          <ChevronRight size={15} className="text-slate-300" />
        </div>

        {/* ── Stats ── */}
        <div className="carol-card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-600">Family Progress</p>
            <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-1 rounded-full">
              {visitedPct}% done
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all"
              style={{ width: `${visitedPct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Families"
              value={stats.total_families}
              icon="🏠"
              color="text-slate-700"
              bg="bg-slate-50"
            />
            <StatCard
              label="Visited"
              value={stats.visited}
              icon="✅"
              color="text-green-700"
              bg="bg-green-50"
            />
            <StatCard
              label="Pending"
              value={stats.pending}
              icon="⏳"
              color="text-orange-600"
              bg="bg-orange-50"
            />
          </div>
        </div>

        {/* ── Live status ── */}
        {inProgress?.family && (
          <div className="carol-card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status="live" />
              <p className="text-xs text-slate-500 font-medium">Currently Visiting</p>
            </div>
            <p className="font-semibold text-slate-800">{inProgress.family.name}</p>
            <p className="text-xs text-slate-400">{inProgress.family.address}</p>
            {inProgress.eta && (
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                <Clock3 size={11} />
                <span>ETA: {formatTime(inProgress.eta)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Quick actions ── */}
        <div>
          <p className="text-sm font-semibold text-slate-500 mb-3">Quick Actions</p>
          <div className="space-y-3">
            <ActionRow href={groupId ? `/tracking/${groupId}` : '/tracking'} emoji="📍" label="Live Tracking" sub="View team location and progress" />
            <ActionRow href="/share" emoji="🔗" label="Generate / Share Link" sub="Create daily link for congregation" />
            <ActionRow href="/families" emoji="👥" label="Manage Families" sub="View and update family details" />
            <ActionRow href="/songs" emoji="🎵" label="Carol Songs" sub="Manage songs for the day" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }: {
  label: string; value: number; icon: string; color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-3 text-center`}>
      <span className="text-xl">{icon}</span>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function ActionRow({ href, emoji, label, sub }: {
  href: string; emoji: string; label: string; sub: string;
}) {
  return (
    <Link href={href} className="carol-card carol-card-hover flex items-center gap-4 p-4 block">
      <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-green-50 text-xl flex-shrink-0">
        {emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300" />
    </Link>
  );
}
