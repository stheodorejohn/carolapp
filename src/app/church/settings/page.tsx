'use client';

/**
 * Church Settings & Member Management
 *
 * Dedicated administrative interface for:
 * - Church details & name update
 * - Church member management (roles, status)
 * - Secure invitation link generation, sharing, and deactivation
 * Designed for users aged 14–70: low cognitive load, 44px+ touch targets,
 * human terms, no database jargon.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Church as ChurchIcon, Users, Link2, Copy, Check, Shield,
  UserCheck, AlertCircle, Trash2, Plus, RefreshCw, ChevronLeft,
  Share2, Edit2, X, CheckCircle2, UserCog, Clock, Power
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ChurchMember, ChurchRole } from '@/types/database';

interface InviteItem {
  id: string;
  role: ChurchRole;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

interface MemberWithUser extends ChurchMember {
  full_name?: string | null;
  email?: string | null;
}

export default function ChurchSettingsPage() {
  const { currentChurch, user, activeRole, refreshChurch } = useAuth();

  const [activeTab, setActiveTab] = useState<'church' | 'members' | 'invites'>('members');

  // ── Church Details State ──
  const [churchName, setChurchName] = useState(currentChurch?.name ?? '');
  const [savingChurch, setSavingChurch] = useState(false);
  const [churchSuccess, setChurchSuccess] = useState('');
  const [churchError, setChurchError] = useState('');

  // ── Members State ──
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [editingMember, setEditingMember] = useState<MemberWithUser | null>(null);
  const [targetRole, setTargetRole] = useState<ChurchRole>('team_member');
  const [roleSaving, setRoleSaving] = useState(false);
  const [memberMsg, setMemberMsg] = useState('');

  // ── Invites State ──
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<ChurchRole>('team_member');
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(30);
  const [inviteMaxUses, setInviteMaxUses] = useState<string>('');
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const isAdmin = activeRole === 'admin' || user?.churchRole === 'admin';

  useEffect(() => {
    if (currentChurch?.name) {
      setChurchName(currentChurch.name);
    }
  }, [currentChurch?.name]);

  // Load Members
  const loadMembers = useCallback(async () => {
    if (!currentChurch?.id) return;
    setMembersLoading(true);
    try {
      const { data: memberRows, error } = await supabase
        .from('church_members')
        .select('id, church_id, user_id, role, status, created_at, updated_at, profiles:profiles(full_name, email)')
        .eq('church_id', currentChurch.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ChurchSettings] members fetch error:', error);
      } else if (memberRows) {
        const mapped: MemberWithUser[] = memberRows.map((m: any) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return {
            id: m.id,
            church_id: m.church_id,
            user_id: m.user_id,
            role: m.role as ChurchRole,
            status: m.status as 'active' | 'inactive',
            created_at: m.created_at,
            updated_at: m.updated_at,
            full_name: profile?.full_name ?? null,
            email: profile?.email ?? null,
          };
        });
        setMembers(mapped);
      }
    } catch (err) {
      console.error('[ChurchSettings] error loading members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [currentChurch?.id]);

  // Load Invites
  const loadInvites = useCallback(async () => {
    if (!currentChurch?.id) return;
    setInvitesLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_invites')
        .select('id, role, expires_at, max_uses, use_count, is_active, created_at')
        .eq('church_id', currentChurch.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ChurchSettings] invites fetch error:', error);
      } else if (data) {
        setInvites(data as InviteItem[]);
      }
    } catch (err) {
      console.error('[ChurchSettings] error loading invites:', err);
    } finally {
      setInvitesLoading(false);
    }
  }, [currentChurch?.id]);

  useEffect(() => {
    loadMembers();
    loadInvites();
  }, [loadMembers, loadInvites]);

  // Update Church Name
  async function handleUpdateChurch(e: React.FormEvent) {
    e.preventDefault();
    if (!currentChurch?.id) return;
    const trimmed = churchName.trim();
    if (!trimmed) {
      setChurchError('Church name cannot be empty.');
      return;
    }

    setSavingChurch(true);
    setChurchError('');
    setChurchSuccess('');

    try {
      const { error } = await supabase
        .from('churches')
        .update({ name: trimmed })
        .eq('id', currentChurch.id);

      if (error) throw error;
      setChurchSuccess('Church details updated successfully.');
      await refreshChurch();
    } catch (err: unknown) {
      console.error('[ChurchSettings] update error:', err);
      setChurchError('Failed to update church details. You must be an administrator.');
    } finally {
      setSavingChurch(false);
    }
  }

  // Change Member Role
  async function handleSaveRole() {
    if (!editingMember || !currentChurch?.id) return;
    setRoleSaving(true);
    setMemberMsg('');

    try {
      const { error } = await supabase
        .from('church_members')
        .update({ role: targetRole })
        .eq('id', editingMember.id);

      if (error) throw error;

      setMemberMsg(`Role updated for ${editingMember.full_name ?? editingMember.email ?? 'member'}.`);
      setEditingMember(null);
      await loadMembers();
      await refreshChurch();
    } catch (err) {
      console.error('[ChurchSettings] change role error:', err);
      setMemberMsg('Failed to update member role.');
    } finally {
      setRoleSaving(false);
    }
  }

  // Toggle Member Status (Active/Inactive)
  async function handleToggleStatus(member: MemberWithUser) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('church_members')
        .update({ status: newStatus })
        .eq('id', member.id);

      if (error) throw error;
      await loadMembers();
    } catch (err) {
      console.error('[ChurchSettings] toggle status error:', err);
    }
  }

  // Generate Invite Link
  async function handleGenerateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentChurch?.id) return;
    setGeneratingInvite(true);
    setNewInviteUrl(null);
    setCopiedUrl(false);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const res = await fetch('/api/invites/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          church_id: currentChurch.id,
          role: inviteRole,
          expires_in_days: inviteExpiryDays > 0 ? inviteExpiryDays : null,
          max_uses: inviteMaxUses ? Number(inviteMaxUses) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to generate link');
      }

      const fullUrl = `${window.location.origin}${json.url}`;
      setNewInviteUrl(fullUrl);
      await loadInvites();
    } catch (err) {
      console.error('[ChurchSettings] generate invite error:', err);
      alert('Unable to generate invitation link. Ensure you are an administrator.');
    } finally {
      setGeneratingInvite(false);
    }
  }

  // Deactivate Invite
  async function handleDeactivateInvite(inviteId: string) {
    setDeactivatingId(inviteId);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const res = await fetch('/api/invites/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ invite_id: inviteId }),
      });

      if (res.ok) {
        await loadInvites();
      }
    } catch (err) {
      console.error('[ChurchSettings] deactivate error:', err);
    } finally {
      setDeactivatingId(null);
    }
  }

  // Copy Link to Clipboard
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  const filteredMembers = members.filter(m => {
    const q = memberSearch.toLowerCase();
    return (
      (m.full_name && m.full_name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const roleBadgeStyle: Record<ChurchRole, string> = {
    admin: 'bg-purple-50 text-purple-700 border-purple-200',
    team_member: 'bg-green-50 text-green-700 border-green-200',
    driver: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  const roleLabel: Record<ChurchRole, string> = {
    admin: 'Administrator',
    team_member: 'Carol Team Member',
    driver: 'Driver / Sharer',
  };

  return (
    <div className="page-container bg-slate-50">
      {/* ── Top Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-3">
          <Link
            href="/admin/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Back to More"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Church Administration</h1>
            <p className="text-xs text-slate-500">{currentChurch?.name ?? 'Church Settings'}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-slate-100 -mb-px">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users size={15} />
            <span>Members ({members.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'invites'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Link2 size={15} />
            <span>Invitations</span>
          </button>
          <button
            onClick={() => setActiveTab('church')}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'church'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <ChurchIcon size={15} />
            <span>Church Info</span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-12 space-y-5">
        {/* ════════════════ TAB 1: MEMBERS ════════════════ */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {memberMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>{memberMsg}</span>
              </div>
            )}

            {/* Search and invite CTA */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search church members…"
                className="carol-input flex-1 py-2.5 px-3.5 text-xs rounded-xl bg-white border border-slate-200"
              />
              <button
                onClick={() => setActiveTab('invites')}
                className="btn-primary py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>Invite</span>
              </button>
            </div>

            {/* Member List */}
            {membersLoading ? (
              <div className="carol-card p-8 text-center text-slate-400 text-xs">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-green-600" />
                <span>Loading church members…</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="carol-card p-8 text-center space-y-2">
                <Users size={32} className="mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No members found</p>
                <p className="text-xs text-slate-400">
                  {memberSearch ? 'Try a different search term.' : 'Invite team members to join this church.'}
                </p>
              </div>
            ) : (
              <div className="carol-card divide-y divide-slate-100">
                {filteredMembers.map(m => {
                  const initial = (m.full_name?.[0] ?? m.email?.[0] ?? 'M').toUpperCase();
                  const isCurrentCaller = m.user_id === user?.id;

                  return (
                    <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {m.full_name ?? m.email?.split('@')[0] ?? 'Church Member'}
                            </p>
                            {isCurrentCaller && (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">{m.email ?? 'No email'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeStyle[m.role]}`}>
                              {roleLabel[m.role]}
                            </span>
                            {m.status === 'inactive' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isAdmin && !isCurrentCaller && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMember(m);
                              setTargetRole(m.role);
                            }}
                            className="p-2 text-slate-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            title="Change Role"
                            aria-label={`Change role for ${m.full_name ?? 'member'}`}
                          >
                            <UserCog size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(m)}
                            className={`p-2 rounded-lg transition-colors ${
                              m.status === 'active'
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={m.status === 'active' ? 'Deactivate member' : 'Reactivate member'}
                            aria-label="Toggle active status"
                          >
                            <Power size={17} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TAB 2: INVITATIONS ════════════════ */}
        {activeTab === 'invites' && (
          <div className="space-y-5">
            {/* Generate Invite Card */}
            <div className="carol-card p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-700">
                  <Link2 size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Generate Team Invite Link</h2>
                  <p className="text-xs text-slate-400">Invite new team members, leaders, or drivers</p>
                </div>
              </div>

              <form onSubmit={handleGenerateInvite} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Role to Invited User
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as ChurchRole)}
                    className="carol-input w-full py-2.5 px-3 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="team_member">Carol Team Member (Recommended)</option>
                    <option value="driver">Driver / Location Sharer</option>
                    <option value="admin">Church Administrator</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Link Expiration
                    </label>
                    <select
                      value={inviteExpiryDays}
                      onChange={e => setInviteExpiryDays(Number(e.target.value))}
                      className="carol-input w-full py-2.5 px-3 text-xs bg-white border border-slate-200 rounded-xl"
                    >
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={90}>90 Days</option>
                      <option value={0}>Never Expires</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Uses (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={inviteMaxUses}
                      onChange={e => setInviteMaxUses(e.target.value)}
                      className="carol-input w-full py-2.5 px-3 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingInvite || !isAdmin}
                  className="btn-primary w-full py-3.5 text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generatingInvite ? (
                    'Generating Secure Link…'
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Invitation Link</span>
                    </>
                  )}
                </button>
              </form>

              {/* Newly Generated Invite Banner */}
              {newInviteUrl && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-2xl space-y-3 mt-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-green-800 font-bold text-xs">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span>Invitation Link Ready to Share</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-green-200 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 font-mono truncate select-all">
                      {newInviteUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(newInviteUrl)}
                      className="btn-primary py-1.5 px-3 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1"
                    >
                      {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-green-700">
                    Share this link with your Carol team. When they open it, they will see your church name before signing up.
                  </p>
                </div>
              )}
            </div>

            {/* Active Invitations List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Existing Invitations ({invites.length})
              </h3>

              {invitesLoading ? (
                <div className="carol-card p-6 text-center text-slate-400 text-xs">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-green-600" />
                  <span>Loading invitations…</span>
                </div>
              ) : invites.length === 0 ? (
                <div className="carol-card p-6 text-center text-xs text-slate-400">
                  No invitation links generated yet.
                </div>
              ) : (
                <div className="carol-card divide-y divide-slate-100">
                  {invites.map(inv => {
                    const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                    const isMaxed = inv.max_uses != null && inv.use_count >= inv.max_uses;
                    const isValid = inv.is_active && !isExpired && !isMaxed;

                    return (
                      <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeStyle[inv.role]}`}>
                              {roleLabel[inv.role]}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isValid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isValid ? 'Active' : !inv.is_active ? 'Deactivated' : isExpired ? 'Expired' : 'Max Uses Reached'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-1">
                            Uses: <strong>{inv.use_count}</strong> {inv.max_uses ? `/ ${inv.max_uses}` : ''}
                            {inv.expires_at && ` • Expires: ${new Date(inv.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>

                        {isAdmin && inv.is_active && !isExpired && (
                          <button
                            type="button"
                            onClick={() => handleDeactivateInvite(inv.id)}
                            disabled={deactivatingId === inv.id}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-1.5 px-3 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                          >
                            {deactivatingId === inv.id ? 'Deactivating…' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ TAB 3: CHURCH INFO ════════════════ */}
        {activeTab === 'church' && (
          <div className="carol-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-700">
                <ChurchIcon size={18} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Church Identity</h2>
                <p className="text-xs text-slate-400">Configure church name and organization info</p>
              </div>
            </div>

            {churchSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <span>{churchSuccess}</span>
              </div>
            )}

            {churchError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{churchError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateChurch} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Church Name
                </label>
                <input
                  type="text"
                  value={churchName}
                  onChange={e => setChurchName(e.target.value)}
                  disabled={!isAdmin || savingChurch}
                  className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
                  placeholder="e.g. St. Mary's Church"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Appears in your team header, invitation links, and live tracking.
                </p>
              </div>

              {isAdmin && (
                <button
                  type="submit"
                  disabled={savingChurch || churchName.trim() === currentChurch?.name}
                  className="btn-primary w-full py-3.5 text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {savingChurch ? 'Saving Changes…' : 'Save Church Details'}
                </button>
              )}
            </form>
          </div>
        )}
      </div>

      {/* ── Role Change Modal ── */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Change Member Role</h3>
              <button
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select the church role for{' '}
              <strong>{editingMember.full_name ?? editingMember.email ?? 'this member'}</strong>:
            </p>

            <div className="space-y-2">
              {(['team_member', 'driver', 'admin'] as ChurchRole[]).map(r => (
                <label
                  key={r}
                  onClick={() => setTargetRole(r)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    targetRole === r
                      ? 'border-green-600 bg-green-50/60 ring-2 ring-green-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{roleLabel[r]}</p>
                    <p className="text-[11px] text-slate-400">
                      {r === 'admin'
                        ? 'Full church and member management'
                        : r === 'driver'
                        ? 'Navigation and location sharing'
                        : 'View route and complete carol visits'}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="role"
                    checked={targetRole === r}
                    onChange={() => setTargetRole(r)}
                    className="accent-green-700"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={roleSaving || targetRole === editingMember.role}
                className="btn-primary py-3 px-4 rounded-xl text-xs font-bold flex-1 disabled:opacity-50"
              >
                {roleSaving ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

