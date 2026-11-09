'use client';

/**
 * Auth Context for Let's Carol
 *
 * Provides authentication state (user, role, session) and actions
 * (signIn, signUp, signOut) to all client components via React context.
 *
 * Uses Supabase Auth with email+password. The user role is stored in
 * user_metadata.role (set during signup; defaults to 'leader').
 * Admins must have their role set to 'admin' via the Supabase dashboard
 * or server-side admin client.
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
import type { UserRole, AppRole } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  authorizedRoles: AppRole[];
  activeRole: AppRole;
  full_name: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  activeRole: AppRole;
  authorizedRoles: AppRole[];
  /** Switch user's active role. Rejects if role is not authorized. */
  switchRole: (role: AppRole) => boolean;
  /** Sign in with email + password. Throws on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Create a new account. New users get the 'leader' role by default.
   * Throws on failure.
   */
  signUp: (email: string, password: string, fullName?: string) => Promise<{ needsConfirmation: boolean }>;
  /** Send password reset email. Throws on failure. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Update the password for the current or recovering user. Throws on failure. */
  updatePassword: (newPassword: string) => Promise<void>;
  /** Sign out the current user. */
  signOut: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_ACTIVE_ROLE = 'carol_active_role';

export function getAuthorizedRoles(supabaseUser: User): AppRole[] {
  const meta = supabaseUser.user_metadata ?? {};
  // If user has 'admin' in user_metadata or app_metadata, allow all roles
  const isAdmin =
    meta.role === 'admin' ||
    supabaseUser.app_metadata?.role === 'admin' ||
    (Array.isArray(meta.roles) && meta.roles.includes('admin'));

  if (isAdmin) {
    return ['admin', 'team_member', 'driver'];
  }

  // Non-admins can switch between team member and driver, but NEVER admin
  return ['team_member', 'driver'];
}

function resolveActiveRole(authorizedRoles: AppRole[]): AppRole {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) as AppRole | null;
    if (saved && authorizedRoles.includes(saved)) {
      return saved;
    }
  }
  // Default fallback: first authorized role ('admin' for admins, 'team_member' for others)
  return authorizedRoles[0];
}

function mapSupabaseUser(supabaseUser: User, savedActiveRole?: AppRole): AuthUser {
  const meta = supabaseUser.user_metadata ?? {};
  const authorizedRoles = getAuthorizedRoles(supabaseUser);

  let activeRole: AppRole;
  if (savedActiveRole && authorizedRoles.includes(savedActiveRole)) {
    activeRole = savedActiveRole;
  } else {
    activeRole = resolveActiveRole(authorizedRoles);
  }

  const role: UserRole = authorizedRoles.includes('admin') ? 'admin' : 'leader';

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    role,
    authorizedRoles,
    activeRole,
    full_name: meta.full_name ?? meta.name ?? null,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null;
      setSession(s);
      setUser(s?.user ? mapSupabaseUser(s.user) : null);
      setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ? mapSupabaseUser(s.user) : null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const switchRole = useCallback((newRole: AppRole): boolean => {
    if (!user) return false;

    // SECURITY CHECK: Verify target role is authorized for this user
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

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ needsConfirmation: boolean }> => {
    const redirectTo = getAppURL('/login');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          role: 'leader',
          full_name: fullName ?? null,
        },
      },
    });
    if (error) throw error;

    const needsConfirmation =
      data.user != null && (data.session == null || data.user.identities?.length === 0);
    return { needsConfirmation };
  }, []);

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
    } catch {
      // Ignore
    }
    await supabase.auth.signOut();
  }, []);

  const activeRole: AppRole = user?.activeRole ?? 'team_member';
  const authorizedRoles: AppRole[] = user?.authorizedRoles ?? ['team_member'];

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        activeRole,
        authorizedRoles,
        switchRole,
        signIn,
        signUp,
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

/**
 * Access auth state and actions in any client component.
 *
 * @example
 * const { user, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

