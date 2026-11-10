'use client';

/**
 * More / Account & Administration Page
 *
 * Serves as the central "More" hub for all user roles:
 * - View account identity and active role
 * - Switch between authorized roles
 * - Access role-specific administrative and operational tools
 * - Sign out securely
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, UsersRound, MapPin, Music, Link2, Shield,
  Navigation, LogOut, ChevronRight, Info, CheckCircle2,
  CalendarDays, RefreshCw, Car, User, Church as ChurchIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { RoleSwitcherModal } from '@/components/auth/RoleSwitcherModal';
import type { DashboardStats, Group } from '@/types/database';

export default function MorePage() {
  const { user, activeRole, authorizedRoles, currentChurch, signOut } = useAuth();
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const [
          { count: total },
          { count: visited },
          { count: inProgress },
          { count: pending },
          { data: groupData },
        ] = await Promise.all([
          supabase.from('families').select('*', { count: 'exact', head: true }),
          supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'visited'),
          supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
          supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('groups').select('*').eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]);

        setStats({
          total_families: total ?? 0,
          visited: visited ?? 0,
          in_progress: inProgress ?? 0,
          pending: pending ?? 0,
        });

        if (groupData) setActiveGroup(groupData as Group);
      } catch (err) {
        console.error('[MorePage] load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  const displayName = user?.full_name ?? (user?.email ? user.email.split('@')[0] : 'Carol Team');
  const initial = (displayName[0] ?? 'C').toUpperCase();
  const canSwitchRole = authorizedRoles.length > 1;

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    team_member: 'Carol Team Member',
    driver: 'Driver / Sharer',
  };

  return (
    <div className="page-container bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-slate-800">More</h1>
        <p className="text-xs text-slate-500 mt-0.5">Account, preferences, and team tools</p>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* ── User Profile & Role Card ── */}
        <div className="carol-card p-5">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-700 text-white text-lg font-bold shadow-sm">
              {initial}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-base truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email ?? 'Signed in'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                  {roleLabels[activeRole] ?? activeRole}
                </span>
              </div>
            </div>
          </div>

          {canSwitchRole && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">Multiple Roles Available</p>
                <p className="text-[11px] text-slate-400">Switch between authorized profiles</p>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(true)}
                className="btn-outline py-1.5 px-3.5 text-xs font-semibold rounded-full border-green-700 text-green-700 hover:bg-green-50"
              >
                Switch Role
              </button>
            </div>
          )}
        </div>

        {/* ── Church Identity Card ── */}
        <div className="carol-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 text-green-700">
                <ChurchIcon size={20} />
              </span>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Church Workspace</p>
                <p className="text-sm font-bold text-slate-800">{currentChurch?.name ?? 'Carol Church'}</p>
              </div>
            </div>
            <Link
              href="/church/settings"
              className="text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 transition-colors px-3 py-1.5 rounded-lg border border-green-200"
            >
              Settings &amp; Members
            </Link>
          </div>
        </div>

        {/* ── Active Group Status (if available) ── */}
        {activeGroup && (
          <div className="carol-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-700">
                  <Car size={18} />
                </span>
                <div>
                  <p className="text-xs text-slate-400">Active Carol Group</p>
                  <p className="text-sm font-bold text-slate-800">{activeGroup.name}</p>
                </div>
              </div>
              {activeGroup.vehicle_number && (
                <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {activeGroup.vehicle_number}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Admin Management Tools ── */}
        {activeRole === 'admin' && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              Administration
            </p>
            <div className="carol-card divide-y divide-slate-100">
              <MenuRow
                href="/church/settings"
                icon={<ChurchIcon size={18} className="text-emerald-700" />}
                iconBg="bg-emerald-50"
                title="Church Members & Invitations"
                subtitle="Manage members, change roles, and create invite links"
              />
              <MenuRow
                href="/settings/groups"
                icon={<UsersRound size={18} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Carol Groups & Route Stops"
                subtitle="Manage teams, vehicles, and order of visits"
              />
              <MenuRow
                href="/families"
                icon={<Users size={18} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Families Directory"
                subtitle={`${stats?.total_families ?? 0} families registered`}
              />
              <MenuRow
                href="/families/new"
                icon={<Users size={18} className="text-emerald-600" />}
                iconBg="bg-emerald-50"
                title="Add New Family"
                subtitle="Register a new family for carol visits"
              />
              <MenuRow
                href="/songs"
                icon={<Music size={18} className="text-amber-600" />}
                iconBg="bg-amber-50"
                title="Carol Songs Management"
                subtitle="Manage songs, lyrics, and order"
              />
            </div>
          </div>
        )}

        {/* ── Driver Tools ── */}
        {activeRole === 'driver' && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              Driver Operations
            </p>
            <div className="carol-card divide-y divide-slate-100">
              <MenuRow
                href="/location"
                icon={<Navigation size={18} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Live GPS Location Sharing"
                subtitle="Broadcast vehicle location to congregation"
              />
              <MenuRow
                href="/route"
                icon={<MapPin size={18} className="text-green-700" />}
                iconBg="bg-green-50"
                title="Team Route & Navigation"
                subtitle="View route sequence and open directions"
              />
              <MenuRow
                href="/share"
                icon={<Link2 size={18} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Share Tracking Link"
                subtitle="Share public tracking link with families"
              />
            </div>
          </div>
        )}

        {/* ── Team Member Tools ── */}
        {activeRole === 'team_member' && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              Carol Team Tools
            </p>
            <div className="carol-card divide-y divide-slate-100">
              <MenuRow
                href="/route"
                icon={<MapPin size={18} className="text-green-700" />}
                iconBg="bg-green-50"
                title="Today's Route & Stops"
                subtitle="View sequence and mark visits complete"
              />
              <MenuRow
                href="/songs"
                icon={<Music size={18} className="text-amber-600" />}
                iconBg="bg-amber-50"
                title="Carol Songs & Lyrics"
                subtitle="Browse lyrics and song order for today"
              />
              <MenuRow
                href="/tracking"
                icon={<Navigation size={18} className="text-blue-600" />}
                iconBg="bg-blue-50"
                title="Team Live Map"
                subtitle="View live team location on map"
              />
              <MenuRow
                href="/share"
                icon={<Link2 size={18} className="text-purple-600" />}
                iconBg="bg-purple-50"
                title="Congregation Share Link"
                subtitle="Send live map link to congregation"
              />
            </div>
          </div>
        )}

        {/* ── App Info ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
            Application
          </p>
          <div className="carol-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-500">
                <Info size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Let&apos;s Carol</p>
                <p className="text-xs text-slate-400">Version 1.0.0 · Community Carol Tracker</p>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-400">2026</span>
          </div>
        </div>

        {/* ── Secure Sign Out ── */}
        <button
          type="button"
          onClick={() => signOut()}
          className="carol-card carol-card-hover w-full flex items-center gap-3.5 p-4 text-left border-red-100 bg-white hover:bg-red-50/50 transition-colors"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600 flex-shrink-0">
            <LogOut size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-600">Sign Out</p>
            <p className="text-xs text-slate-400">End your current session safely</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>

      {/* Role Switcher Modal */}
      {canSwitchRole && (
        <RoleSwitcherModal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
        />
      )}
    </div>
  );
}

function MenuRow({
  href,
  icon,
  iconBg,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 p-4 hover:bg-slate-50/70 transition-colors block"
    >
      <span className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${iconBg}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </Link>
  );
}
