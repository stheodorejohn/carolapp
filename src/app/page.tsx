'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarDays, MapPin, Link2, Users, Music,
  ChevronRight, CheckCircle2, Clock3, RefreshCw, LogOut,
  Navigation, Shield, Car,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TodayDate } from '@/components/ui/TodayDate';
import { UserRoleBadge } from '@/components/auth/RoleSwitcherModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { DashboardStats, Route } from '@/types/database';

export default function HomePage() {
  const { user, activeRole, currentChurch, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nextStop, setNextStop] = useState<Route | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── Stats: aggregate counts from families & routes ──────────────
      let famQuery = supabase.from('families').select('*', { count: 'exact', head: true });
      let rVisited = supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'visited');
      let rProg = supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
      let rPend = supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      if (currentChurch?.id) {
        famQuery = famQuery.eq('church_id', currentChurch.id);
        rVisited = rVisited.eq('church_id', currentChurch.id);
        rProg = rProg.eq('church_id', currentChurch.id);
        rPend = rPend.eq('church_id', currentChurch.id);
      }

      const [
        { count: total },
        { count: visited },
        { count: inProgress },
        { count: pending },
      ] = await Promise.all([
        famQuery,
        rVisited,
        rProg,
        rPend,
      ]);

      setStats({
        total_families: total ?? 0,
        visited:        visited ?? 0,
        in_progress:    inProgress ?? 0,
        pending:        pending ?? 0,
      });

      // ── Fetch first active group ──────────────────────────────────────
      let groupQuery = supabase
        .from('groups')
        .select('id')
        .eq('is_active', true);

      if (currentChurch?.id) {
        groupQuery = groupQuery.eq('church_id', currentChurch.id);
      }

      const { data: activeGroup } = await groupQuery
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

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
          .maybeSingle();

        setNextStop(nextRouteData as Route ?? null);
      }
    } catch (err) {
      console.error('[HomePage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentChurch?.id]);

  useEffect(() => { load(); }, [load]);

  // Time-aware greeting
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';
  const displayName = user?.full_name ?? (user?.email ? user.email.split('@')[0] : null);
  const greeting = displayName ? `${timeGreeting}, ${displayName}!` : `${timeGreeting}!`;

  return (
    <div className="page-container bg-slate-50">
      {/* ── Hero ── */}
      <div className="hero-gradient px-5 pt-14 pb-28 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-green-300 text-sm font-medium">{greeting}</p>
              <UserRoleBadge />
            </div>
            {currentChurch?.name ? (
              <div className="mt-1">
                <p className="text-green-300 text-[11px] font-bold tracking-wider uppercase">{currentChurch.name}</p>
                <h1 className="text-white text-2xl font-bold">Carol Visits 🎄</h1>
              </div>
            ) : (
              <h1 className="text-white text-2xl font-bold mt-1">Let&apos;s Carol 🎄</h1>
            )}
            <p className="text-green-200 text-xs mt-1">May the joy of Christmas fill every home.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10"
              aria-label="Refresh"
            >
              <RefreshCw size={20} className={`text-green-200 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            {user && (
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} className="text-green-200" aria-hidden="true" />
              </button>
            )}
          </div>
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

      {/* ── Operational Next Stop Card ── */}
      {nextStop?.family && (
        <div className="px-4 mb-5">
          <div className="carol-card p-5 border-l-4 border-l-green-600 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {nextStop.status === 'in_progress' ? 'Visit In Progress' :
                 nextStop.status === 'arrived' ? 'Arrived at Home' :
                 'Next Stop'}
              </span>
              <StatusBadge status={nextStop.status} />
            </div>

            <div className="my-2">
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {nextStop.family.name}
              </h2>
              <p className="text-sm text-slate-500 mt-1 flex items-start gap-1.5">
                <MapPin size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{nextStop.family.address}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
              {(nextStop.family.latitude !== 0 || nextStop.family.longitude !== 0) && (
                <a
                  href={`https://maps.google.com/?q=${nextStop.family.latitude},${nextStop.family.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline flex-1 py-2.5 text-xs font-semibold gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-center justify-center inline-flex"
                  aria-label="Open directions in Google Maps"
                >
                  <Navigation size={14} className="text-blue-600" />
                  Directions
                </a>
              )}
              <Link
                href={`/route/${nextStop.id}`}
                className="btn-primary flex-1 py-2.5 text-xs font-bold gap-1 rounded-xl shadow-sm text-center justify-center inline-flex"
              >
                {nextStop.status === 'in_progress' ? 'Open Active Visit →' :
                 nextStop.status === 'arrived' ? 'Start Carol Visit →' :
                 'Open Stop →'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Role-Aware Quick Actions ── */}
      <div className="px-4">
        <p className="text-sm font-semibold text-slate-500 mb-3">Quick Actions</p>
        <div className="space-y-3">
          {activeRole === 'driver' ? (
            <>
              <QuickAction
                href="/location"
                icon={<Navigation size={20} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Live GPS Location"
                sub="Share and track vehicle location"
              />
              <QuickAction
                href="/route"
                icon={<MapPin size={20} className="text-green-700" />}
                iconBg="bg-green-50"
                title="Team Route"
                sub="View all stops and directions"
              />
              <QuickAction
                href="/share"
                icon={<Link2 size={20} className="text-amber-600" />}
                iconBg="bg-amber-50"
                title="Congregation Share Link"
                sub="Link for families to view live location"
              />
              <QuickAction
                href="/songs"
                icon={<Music size={20} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Carol Songs"
                sub="Lyrics and songs for the team"
              />
            </>
          ) : activeRole === 'admin' ? (
            <>
              <QuickAction
                href="/families"
                icon={<Users size={20} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Manage Families"
                sub="View, add, and organize family stops"
              />
              <QuickAction
                href={groupId ? `/tracking/${groupId}` : '/tracking'}
                icon={<MapPin size={20} className="text-green-700" />}
                iconBg="bg-green-50"
                title="Live Tracking Map"
                sub="Monitor carol team in real-time"
              />
              <QuickAction
                href="/share"
                icon={<Link2 size={20} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Generate / Share Link"
                sub="Create link for church congregation"
              />
              <QuickAction
                href="/admin/dashboard"
                icon={<Shield size={20} className="text-emerald-700" />}
                iconBg="bg-emerald-50"
                title="Carol Groups & Admin"
                sub="Manage groups, routes, and settings"
              />
            </>
          ) : (
            <>
              <QuickAction
                href="/route"
                icon={<MapPin size={20} className="text-green-700" />}
                iconBg="bg-green-50"
                title="Today's Route"
                sub="View stops and mark visits complete"
              />
              <QuickAction
                href="/songs"
                icon={<Music size={20} className="text-amber-600" />}
                iconBg="bg-amber-50"
                title="Carol Songs & Lyrics"
                sub="Lyrics for caroling visits"
              />
              <QuickAction
                href={groupId ? `/tracking/${groupId}` : '/tracking'}
                icon={<Navigation size={20} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Team Live Map"
                sub="View vehicle position and route"
              />
              <QuickAction
                href="/share"
                icon={<Link2 size={20} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Share Tracking Link"
                sub="Send live tracking to church members"
              />
            </>
          )}
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
