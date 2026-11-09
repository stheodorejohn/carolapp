'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarDays, MapPin, Link2, Users, Music,
  ChevronRight, TreePine, CheckCircle2, Clock3, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TodayDate } from '@/components/ui/TodayDate';
import type { DashboardStats, Route } from '@/types/database';

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nextStop, setNextStop] = useState<Route | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── Stats: aggregate counts from families & routes ──────────────
      const [
        { count: total },
        { count: visited },
        { count: inProgress },
        { count: pending },
      ] = await Promise.all([
        supabase.from('families').select('*', { count: 'exact', head: true }),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'visited'),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        total_families: total ?? 0,
        visited:        visited ?? 0,
        in_progress:    inProgress ?? 0,
        pending:        pending ?? 0,
      });

      // ── Fetch first active group ──────────────────────────────────────
      const { data: activeGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const resolvedGroupId = activeGroup?.id ?? null;
      setGroupId(resolvedGroupId);

      // ── Next stop: first non-visited route for the active group ──────
      if (resolvedGroupId) {
        const { data: nextRouteData } = await supabase
          .from('routes')
          .select('*, family:families(*)')
          .eq('group_id', resolvedGroupId)
          .neq('status', 'visited')
          .order('order_index', { ascending: true })
          .limit(1)
          .single();

        setNextStop(nextRouteData as Route ?? null);
      }
    } catch (err) {
      console.error('[HomePage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container bg-slate-50">
      {/* ── Hero ── */}
      <div className="hero-gradient px-5 pt-14 pb-28 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-green-300 text-sm font-medium">Good morning, Admin</p>
            <h1 className="text-white text-2xl font-bold mt-1">Let&apos;s Carol 🎄</h1>
            <p className="text-green-200 text-xs mt-1">May the joy of Christmas fill every home.</p>
          </div>
          <button
            onClick={load}
            className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10"
            aria-label="Refresh"
          >
            <RefreshCw size={20} className={`text-green-200 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3 mt-4">
          <CalendarDays size={16} className="text-green-200" />
          <span className="text-white text-sm font-medium">Today&apos;s Carol Day — <TodayDate /></span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="relative z-10 -mt-14 px-4 mb-5">
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Overview</p>
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <StatItem
              label="Total"
              value={stats?.total_families ?? 0}
              color="text-slate-700"
              loading={loading}
            />
            <StatItem
              label="Visited"
              value={stats?.visited ?? 0}
              color="text-green-600"
              icon={<CheckCircle2 size={14} className="text-green-500" />}
              loading={loading}
            />
            <StatItem
              label="Pending"
              value={stats?.pending ?? 0}
              color="text-orange-500"
              icon={<Clock3 size={14} className="text-orange-400" />}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* ── Next stop banner ── */}
      {nextStop?.family && (
        <div className="px-4 mb-5">
          <div className="carol-card p-4 border-l-4 border-l-green-600">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Next Stop</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50">
                <MapPin size={18} className="text-green-700" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{nextStop.family.name}</p>
                <p className="text-xs text-slate-400 truncate">{nextStop.family.address}</p>
              </div>
              <Link
                href={`/route/${nextStop.id}`}
                className="flex-shrink-0 flex items-center justify-center bg-green-700 hover:bg-green-800 active:scale-95 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
              >
                Go →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="px-4">
        <p className="text-sm font-semibold text-slate-500 mb-3">Quick Actions</p>
        <div className="space-y-3">
          <QuickAction
            href={groupId ? `/tracking/${groupId}` : '/tracking'}
            icon={<MapPin size={20} className="text-green-700" />}
            iconBg="bg-green-50"
            title="Live Tracking"
            sub="View team location and progress"
          />
          <QuickAction
            href="/share"
            icon={<Link2 size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            title="Generate / Share Link"
            sub="Create daily link for congregation"
          />
          <QuickAction
            href="/families"
            icon={<Users size={20} className="text-purple-600" />}
            iconBg="bg-purple-50"
            title="Manage Families"
            sub="View and update family details"
          />
          <QuickAction
            href="/songs"
            icon={<Music size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            title="Carol Songs"
            sub="Manage songs for the day"
          />
        </div>
      </div>
    </div>
  );
}

function StatItem({
  label, value, color, icon, loading,
}: { label: string; value: number; color: string; icon?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div className="flex items-center justify-center gap-1 mb-1 h-7">
        {icon ?? <span className="w-3.5 h-3.5" />}
        {loading
          ? <span className="w-10 h-6 rounded bg-slate-200 animate-pulse" />
          : <span className={`text-2xl font-bold leading-none ${color}`}>{value}</span>
        }
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function QuickAction({
  href, icon, iconBg, title, sub,
}: { href: string; icon: React.ReactNode; iconBg: string; title: string; sub: string }) {
  return (
    <Link href={href} className="carol-card carol-card-hover flex items-center gap-4 p-4 block">
      <span className={`flex items-center justify-center w-11 h-11 rounded-2xl ${iconBg}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </Link>
  );
}
