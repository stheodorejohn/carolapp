'use client';

/**
 * Signup Page
 *
 * Clean, accessible account creation experience.
 * Includes real-time password strength meter and requirements checklist.
 * Uses Supabase Auth to create new users (default role: 'leader').
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TreePine, Mail, Eye, EyeOff, AlertCircle, Check, X,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// ─── Password validation helpers ────────────────────────────────────────────

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

type StrengthLevel = 'none' | 'weak' | 'fair' | 'good' | 'strong';

interface PasswordStrength {
  level: StrengthLevel;
  label: string;
  score: number; // 0–5
  color: string;
  barColor: string;
}

function assessPasswordStrength(password: string): PasswordStrength {
  if (!password) return { level: 'none', label: '', score: 0, color: 'text-slate-400', barColor: 'bg-slate-200' };

  const metCount = PASSWORD_REQUIREMENTS.filter(r => r.test(password)).length;
  const longBonus = password.length >= 12 ? 1 : 0;
  const totalScore = Math.min(5, metCount + longBonus);

  if (totalScore <= 1) return { level: 'weak',   label: 'Weak',   score: 1, color: 'text-red-600',    barColor: 'bg-red-500'    };
  if (totalScore <= 2) return { level: 'fair',   label: 'Fair',   score: 2, color: 'text-orange-600', barColor: 'bg-orange-500' };
  if (totalScore <= 3) return { level: 'good',   label: 'Good',   score: 3, color: 'text-amber-600',  barColor: 'bg-amber-500'  };
  if (totalScore <= 4) return { level: 'strong', label: 'Good',   score: 4, color: 'text-green-600',  barColor: 'bg-green-500'  };
  return                      { level: 'strong', label: 'Strong', score: 5, color: 'text-green-700',  barColor: 'bg-green-600'  };
}

function allRequirementsMet(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every(r => r.test(password));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const { signUp, user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '', confirm: '' });

  const strength = assessPasswordStrength(password);
  const requirementsMet = allRequirementsMet(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // If already authenticated, redirect to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  function validateFields(): boolean {
    const errors = { email: '', password: '', confirm: '' };
    if (!email.trim()) errors.email = 'Please enter your email address.';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Please enter a valid email address.';
    if (!password) errors.password = 'Please enter a password.';
    else if (!requirementsMet) errors.password = 'Please make sure your password meets all the requirements below.';
    if (!confirmPassword) errors.confirm = 'Please confirm your password.';
    else if (password !== confirmPassword) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    return !errors.email && !errors.password && !errors.confirm;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateFields()) return;

    setLoading(true);
    try {
      const { needsConfirmation: nc } = await signUp(email.trim(), password);
      setSuccess(true);
      setNeedsConfirmation(nc);
      if (!nc) {
        // Auto signed in — redirect after a brief success message
        setTimeout(() => router.replace('/'), 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already registered') || msg.includes('already in use') || msg.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (msg.includes('Password should be at least')) {
        setError('Your password is too short. Please use at least 8 characters.');
      } else {
        setError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <TreePine size={40} className="text-green-600 animate-pulse" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  // ── Success screen ──
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-50 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-6">
          <CheckCircle2 size={40} className="text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">
          {needsConfirmation ? 'Check your email!' : 'Welcome to Let\'s Carol! 🎄'}
        </h2>
        {needsConfirmation ? (
          <p className="text-slate-500 text-sm mt-3 max-w-xs">
            We sent a confirmation link to <strong>{email}</strong>. Please check your email and click the link to activate your account.
          </p>
        ) : (
          <p className="text-slate-500 text-sm mt-3">
            Your account has been created. Redirecting you now…
          </p>
        )}
        {needsConfirmation && (
          <Link
            href="/login"
            className="mt-6 text-sm font-semibold text-green-700 underline underline-offset-2"
          >
            Go to Sign In
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}>
      {/* ── Hero header ── */}
      <div className="hero-gradient relative overflow-hidden flex items-center justify-center" style={{ minHeight: 200 }}>
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="text-center px-6 z-10">
          <div className="flex justify-center mb-3">
            <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm">
              <TreePine size={32} className="text-white" aria-hidden="true" />
            </span>
          </div>
          <h1 className="text-white text-2xl font-bold">Create Your Account</h1>
          <p className="text-green-200 text-sm mt-1">Join the carol team</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="flex-1 px-5 -mt-6 relative z-10 pb-10">
        <div className="carol-card p-6">
          {/* Global error */}
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-5">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="signup-email"
                  type="email"
                  className={`carol-input !pl-11 ${fieldErrors.email ? 'border-red-400' : ''}`}
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  autoComplete="email"
                  autoCapitalize="none"
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  aria-invalid={!!fieldErrors.email}
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`carol-input !pr-14 ${fieldErrors.password && !password ? 'border-red-400' : ''}`}
                  placeholder="Create a password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  autoComplete="new-password"
                  aria-describedby="password-requirements"
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
                <div className="mt-3" aria-live="polite" aria-atomic="true">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Password strength</span>
                    <span className={cn('text-xs font-semibold', strength.color)}>
                      {strength.label}
                    </span>
                  </div>
                  {/* 5-segment bar */}
                  <div className="flex gap-1" role="progressbar" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={5} aria-label={`Password strength: ${strength.label}`}>
                    {[1, 2, 3, 4, 5].map(segment => (
                      <div
                        key={segment}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-all duration-300',
                          segment <= strength.score ? strength.barColor : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements checklist */}
              <div id="password-requirements" className="mt-3 space-y-1.5">
                <p className="text-xs text-slate-400 font-medium">Your password must include:</p>
                {PASSWORD_REQUIREMENTS.map(req => {
                  const met = req.test(password);
                  return (
                    <div key={req.id} className="flex items-center gap-2">
                      {met ? (
                        <Check size={13} className="text-green-600 flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <X size={13} className="text-slate-300 flex-shrink-0" aria-hidden="true" />
                      )}
                      <span className={cn('text-xs', met ? 'text-green-700' : 'text-slate-500')}>
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  className={cn(
                    'carol-input !pr-14',
                    passwordsMismatch && 'border-red-400',
                    passwordsMatch && 'border-green-400'
                  )}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirm) setFieldErrors(prev => ({ ...prev, confirm: '' }));
                  }}
                  autoComplete="new-password"
                  aria-describedby={
                    passwordsMatch ? 'confirm-match' :
                    passwordsMismatch ? 'confirm-mismatch' : undefined
                  }
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

              {/* Live match feedback */}
              {confirmPassword.length > 0 && (
                <p
                  id={passwordsMatch ? 'confirm-match' : 'confirm-mismatch'}
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
              {fieldErrors.confirm && !confirmPassword && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.confirm}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account…
                </>
              ) : (
                <>
                  Create Account <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Sign in link ── */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">Already have an account?</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-green-700 hover:text-green-800 underline underline-offset-2"
          >
            Sign in instead
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          🎄 Stay connected. Spread the joy.
        </p>
      </div>
    </div>
  );
}

