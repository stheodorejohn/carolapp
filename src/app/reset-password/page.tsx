'use client';

/**
 * Reset Password Page
 *
 * Allows users who clicked a password reset link to create a new password.
 * - Handles Supabase recovery session detection (hash tokens, PKCE code, PASSWORD_RECOVERY event)
 * - Clear password requirements checklist & strength meter
 * - Graceful handling of expired or invalid links
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TreePine, Eye, EyeOff, AlertCircle, Check, X,
  CheckCircle2, ArrowRight, RefreshCw, KeyRound
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ─── Password requirements ───────────────────────────────────────────────────

interface PasswordRequirement {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length',    label: 'At least 8 characters',         test: pw => pw.length >= 8 },
  { id: 'lowercase', label: 'At least one lowercase letter',  test: pw => /[a-z]/.test(pw) },
  { id: 'uppercase', label: 'At least one uppercase letter',  test: pw => /[A-Z]/.test(pw) },
  { id: 'number',    label: 'At least one number',            test: pw => /[0-9]/.test(pw) },
  { id: 'special',   label: 'At least one special character', test: pw => /[^a-zA-Z0-9]/.test(pw) },
];

function assessStrength(pw: string) {
  if (!pw) return { label: '', score: 0, color: 'text-slate-400', barColor: 'bg-slate-200' };
  const met = PASSWORD_REQUIREMENTS.filter(r => r.test(pw)).length;
  const longBonus = pw.length >= 12 ? 1 : 0;
  const score = Math.min(5, met + longBonus);

  if (score <= 1) return { label: 'Weak', score: 1, color: 'text-red-600', barColor: 'bg-red-500' };
  if (score <= 2) return { label: 'Fair', score: 2, color: 'text-orange-600', barColor: 'bg-orange-500' };
  if (score <= 3) return { label: 'Good', score: 3, color: 'text-amber-600', barColor: 'bg-amber-500' };
  if (score <= 4) return { label: 'Good', score: 4, color: 'text-green-600', barColor: 'bg-green-500' };
  return { label: 'Strong', score: 5, color: 'text-green-700', barColor: 'bg-green-600' };
}

function ResetPasswordForm() {
  const router = useRouter();
  const { updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  // Check whether we have a valid recovery session
  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      // 1. Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session) {
        setSessionValid(true);
        setVerifyingSession(false);
        return;
      }

      // 2. If no session yet, listen for PASSWORD_RECOVERY or auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY' || (s && event === 'SIGNED_IN')) {
          setSessionValid(true);
          setVerifyingSession(false);
        }
      });

      // 3. Fallback timeout: If no session after 2.5s, link is likely expired or invalid
      const timer = setTimeout(() => {
        if (!mounted) return;
        supabase.auth.getSession().then(({ data }) => {
          if (!mounted) return;
          if (data.session) {
            setSessionValid(true);
          } else {
            setSessionValid(false);
          }
          setVerifyingSession(false);
        });
      }, 2500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    checkRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const strength = assessStrength(password);
  const allMet = PASSWORD_REQUIREMENTS.every(r => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please create a new password.');
      return;
    }
    if (!allMet) {
      setError('Please make sure your password meets all requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      // Wait 3 seconds and redirect to login or home
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('different from the old password') || msg.includes('same password')) {
        setError('New password must be different from your old password.');
      } else {
        setError('Unable to update password. Your reset link may have expired.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Verifying session state ──
  if (verifyingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <TreePine size={40} className="text-green-600 animate-pulse mb-3" aria-hidden="true" />
        <h2 className="text-lg font-bold text-slate-800">Verifying reset link…</h2>
        <p className="text-xs text-slate-400 mt-1">Please wait a moment while we secure your session.</p>
      </div>
    );
  }

  // ── Invalid or Expired link state ──
  if (!sessionValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
          <AlertCircle size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Reset link expired or invalid</h2>
        <p className="text-slate-500 text-sm max-w-xs mt-2 leading-relaxed">
          For your security, password reset links expire after a short time or can only be used once.
        </p>
        <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/forgot-password"
            className="btn-primary"
          >
            Request a new reset link
          </Link>
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 py-2"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4 border border-green-100">
          <CheckCircle2 size={36} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Password updated!</h2>
        <p className="text-slate-600 text-sm max-w-xs mt-2 leading-relaxed">
          Your account password has been successfully reset. Redirecting you to sign in…
        </p>
        <Link
          href="/login"
          className="btn-primary mt-6 max-w-xs w-full"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}
    >
      {/* ── Hero header ── */}
      <div className="hero-gradient relative overflow-hidden flex items-center justify-center" style={{ minHeight: 180 }}>
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="text-center px-6 z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3 shadow-lg">
            <KeyRound size={28} className="text-green-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set New Password</h1>
          <p className="text-green-200 text-xs mt-1">Choose a secure password for your account</p>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="flex-1 px-4 py-6 max-w-md w-full mx-auto -mt-6 z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-5">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="carol-input !pr-14"
                  placeholder="Create a new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-3" aria-live="polite">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Strength:</span>
                    <span className={cn('text-xs font-semibold', strength.color)}>{strength.label}</span>
                  </div>
                  <div className="flex gap-1" role="progressbar" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={5}>
                    {[1, 2, 3, 4, 5].map(seg => (
                      <div
                        key={seg}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-all duration-300',
                          seg <= strength.score ? strength.barColor : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              <div id="password-rules" className="mt-3 space-y-1.5">
                <p className="text-xs text-slate-400 font-medium">Must include:</p>
                {PASSWORD_REQUIREMENTS.map(req => {
                  const met = req.test(password);
                  return (
                    <div key={req.id} className="flex items-center gap-2">
                      {met ? (
                        <Check size={13} className="text-green-600 flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <X size={13} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
                      )}
                      <span className={cn('text-xs', met ? 'text-slate-700 font-medium' : 'text-slate-400')}>
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirm ? 'text' : 'password'}
                  className={cn(
                    'carol-input !pr-14',
                    passwordsMismatch && 'border-red-400',
                    passwordsMatch && 'border-green-400'
                  )}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  role="status"
                  className={cn(
                    'mt-1.5 text-xs font-medium flex items-center gap-1',
                    passwordsMatch ? 'text-green-700' : 'text-red-600'
                  )}
                >
                  {passwordsMatch ? (
                    <><Check size={12} aria-hidden="true" /> Passwords match</>
                  ) : (
                    <><X size={12} aria-hidden="true" /> Passwords do not match</>
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading || !allMet || !passwordsMatch}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Updating password…
                </>
              ) : (
                <>
                  Save New Password <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          🎄 Stay connected. Spread the joy.
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
          <TreePine size={40} className="text-green-600 animate-pulse mb-3" aria-hidden="true" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

