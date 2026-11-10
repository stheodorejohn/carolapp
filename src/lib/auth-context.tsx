'use client';

/**
 * Auth Context for Let's Carol
 *
 * Provides authentication state (user, role, session) and church tenancy
 * (currentChurch, churchMembership, authorizedRoles) to all client components.
 *
 * Source of truth for roles is church_members.role in the database,
 * preventing any client-side privilege escalation.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getAppURL } from './utils';
import { normalizeSlug } from './slug';
import type { UserRole, AppRole, ChurchRole, Church, ChurchMember } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  authorizedRoles: AppRole[];
  activeRole: AppRole;
  full_name: string | null;
  churchRole: ChurchRole | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  activeRole: AppRole;
  authorizedRoles: AppRole[];
  currentChurch: Church | null;
  churchMembership: ChurchMember | null;
  hasChurch: boolean;
  /** Switch user's active UI role. Rejects if role is not authorized. */
  switchRole: (role: AppRole) => boolean;
  /** Sign in with email + password. Throws on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Create a new account with optional invite token. */
  signUp: (email: string, password: string, fullName?: string, inviteToken?: string) => Promise<{ needsConfirmation: boolean }>;
  /** Create a new church with caller as initial admin. */
  createChurch: (name: string, slug?: string) => Promise<Church>;
  /** Accept an invite token to join a church. */
  joinChurchWithInvite: (token: string) => Promise<{ success: boolean; church_name?: string; error?: string }>;
  /** Refresh church and membership data from server. */
  refreshChurch: () => Promise<void>;
  /** Send password reset email. Throws on failure. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Update the password for the current or recovering user. Throws on failure. */
  updatePassword: (newPassword: string) => Promise<void>;
  /** Sign out the current user. */
  signOut: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_ACTIVE_ROLE = 'carol_active_role';
const STORAGE_KEY_ACTIVE_CHURCH = 'carol_active_church_id';

function syncSessionCookie(s: Session | null) {
  if (typeof document === 'undefined') return;
  if (s?.access_token) {
    const maxAge = s.expires_in ?? 60 * 60 * 24 * 7;
    document.cookie = `sb-access-token=${s.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    document.cookie = 'sb-access-token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }
}

export function deriveAuthorizedRoles(membershipRole: ChurchRole | null): AppRole[] {
  if (membershipRole === 'admin') {
    return ['admin', 'team_member', 'driver'];
  }
  if (membershipRole === 'driver') {
    return ['driver', 'team_member'];
  }
  if (membershipRole === 'team_member') {
    return ['team_member', 'driver'];
  }
  return ['team_member'];
}

function resolveActiveRole(authorizedRoles: AppRole[]): AppRole {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) as AppRole | null;
    if (saved && authorizedRoles.includes(saved)) {
      return saved;
    }
  }
  return authorizedRoles[0] ?? 'team_member';
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [churchMembership, setChurchMembership] = useState<ChurchMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch church membership for a given Supabase user
  const loadChurchData = useCallback(async (supabaseUser: User | null): Promise<{
    church: Church | null;
    membership: ChurchMember | null;
    role: ChurchRole | null;
  }> => {
    if (!supabaseUser) {
      return { church: null, membership: null, role: null };
    }

    try {
      const { data: members, error } = await supabase
        .from('church_members')
        .select('id, church_id, user_id, role, status, created_at, updated_at, churches(*)')
        .eq('user_id', supabaseUser.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error || !members || members.length === 0) {
        return { church: null, membership: null, role: null };
      }

      // If user saved an active church, try to find it, otherwise pick first
      let chosen = members[0];
      if (typeof window !== 'undefined') {
        const savedChurchId = localStorage.getItem(STORAGE_KEY_ACTIVE_CHURCH);
        if (savedChurchId) {
          const matched = members.find(m => m.church_id === savedChurchId);
          if (matched) chosen = matched;
        }
      }

      const rawChurch = Array.isArray(chosen.churches)
        ? chosen.churches[0]
        : chosen.churches;

      const church: Church | null = rawChurch ?? null;
      const membership: ChurchMember = {
        id: chosen.id,
        church_id: chosen.church_id,
        user_id: chosen.user_id,
        role: chosen.role as ChurchRole,
        status: chosen.status as 'active' | 'inactive',
        created_at: chosen.created_at,
        updated_at: chosen.updated_at,
        church: church ?? undefined,
      };

      return {
        church,
        membership,
        role: chosen.role as ChurchRole,
      };
    } catch (err) {
      console.error('[Auth] Failed to load church data:', err);
      return { church: null, membership: null, role: null };
    }
  }, []);

  const buildAuthUser = useCallback((
    supabaseUser: User,
    membershipRole: ChurchRole | null
  ): AuthUser => {
    const meta = supabaseUser.user_metadata ?? {};
    const authorizedRoles = deriveAuthorizedRoles(membershipRole);
    const activeRole = resolveActiveRole(authorizedRoles);
    const role: UserRole = membershipRole === 'admin' ? 'admin' : 'leader';

    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      role,
      authorizedRoles,
      activeRole,
      full_name: meta.full_name ?? meta.name ?? null,
      churchRole: membershipRole,
    };
  }, []);

  const refreshChurch = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) {
      setCurrentChurch(null);
      setChurchMembership(null);
      return;
    }

    const { church, membership, role } = await loadChurchData(currentSession.user);
    setCurrentChurch(church);
    setChurchMembership(membership);
    setUser(buildAuthUser(currentSession.user, role));
  }, [loadChurchData, buildAuthUser]);

  // Load initial session and church membership
  useEffect(() => {
    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        syncSessionCookie(s);

        if (s?.user) {
          const { church, membership, role } = await loadChurchData(s.user);
          setCurrentChurch(church);
          setChurchMembership(membership);
          setUser(buildAuthUser(s.user, role));
        } else {
          setUser(null);
          setCurrentChurch(null);
          setChurchMembership(null);
        }
      } catch (err) {
        console.error('[Auth] init error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        syncSessionCookie(s);
        if (s?.user) {
          const { church, membership, role } = await loadChurchData(s.user);
          setCurrentChurch(church);
          setChurchMembership(membership);
          setUser(buildAuthUser(s.user, role));
        } else {
          setUser(null);
          setCurrentChurch(null);
          setChurchMembership(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadChurchData, buildAuthUser]);

  const switchRole = useCallback((newRole: AppRole): boolean => {
    if (!user) return false;

    // Strict Authorization Check: target role must be in user's authorizedRoles
    if (!user.authorizedRoles.includes(newRole)) {
      console.warn(`[Auth] Attempted unauthorized role switch to: ${newRole}`);
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, newRole);
    } catch {
      // Ignore localStorage errors (e.g. private mode)
    }

    setUser(prev => prev ? { ...prev, activeRole: newRole } : null);
    return true;
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const joinChurchWithInvite = useCallback(async (token: string): Promise<{
    success: boolean;
    church_name?: string;
    error?: string;
  }> => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error ?? 'Failed to accept invitation' };
      }

      await refreshChurch();
      return { success: true, church_name: json.church_name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error accepting invite';
      return { success: false, error: msg };
    }
  }, [refreshChurch]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName?: string,
    inviteToken?: string
  ): Promise<{ needsConfirmation: boolean }> => {
    const redirectTo = getAppURL(inviteToken ? `/join/${inviteToken}` : '/login');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          role: 'team_member',
          full_name: fullName ?? null,
        },
      },
    });
    if (error) throw error;

    const needsConfirmation =
      data.user != null && (data.session == null || data.user.identities?.length === 0);

    // If an active session was created and inviteToken was provided, auto-join church
    if (data.session && inviteToken) {
      await joinChurchWithInvite(inviteToken);
    }

    return { needsConfirmation };
  }, [joinChurchWithInvite]);

  const createChurch = useCallback(async (name: string, slug?: string): Promise<Church> => {
    const churchName = name.trim();
    if (!churchName) throw new Error('Church name cannot be empty');
    const cleanSlug = slug ? normalizeSlug(slug) : null;

    // Authoritative atomic church creation: creates church record + admin membership in a single transaction
    const { data, error } = await supabase.rpc('create_church_with_admin', {
      church_name: churchName,
      church_slug: cleanSlug,
    });

    if (error) {
      console.error('[Auth] create_church_with_admin error:', error);
      throw new Error(error.message || 'Failed to create church record');
    }

    if (!data) {
      throw new Error('Failed to create church record');
    }

    const createdChurch = data as Church;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CHURCH, createdChurch.id);
    }
    await refreshChurch();
    return createdChurch;
  }, [refreshChurch]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = getAppURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ROLE);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CHURCH);
    } catch {
      // Ignore
    }
    syncSessionCookie(null);
    await supabase.auth.signOut();
    setUser(null);
    setCurrentChurch(null);
    setChurchMembership(null);
  }, []);

  const activeRole: AppRole = user?.activeRole ?? 'team_member';
  const authorizedRoles: AppRole[] = user?.authorizedRoles ?? ['team_member'];
  const hasChurch = currentChurch !== null && churchMembership !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        activeRole,
        authorizedRoles,
        currentChurch,
        churchMembership,
        hasChurch,
        switchRole,
        signIn,
        signUp,
        createChurch,
        joinChurchWithInvite,
        refreshChurch,
        requestPasswordReset,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
