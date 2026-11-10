'use client';

/**
 * Signup Page
 *
 * Clean, accessible account creation experience.
 * Includes real-time password strength meter and requirements checklist.
 * Supports church invitation signup (?invite=xyz).
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  TreePine, Mail, Eye, EyeOff, AlertCircle, Check, X,
  CheckCircle2, ArrowRight, Church as ChurchIcon, User,
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

// ─── Signup Form Component ───────────────────────────────────────────────────

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const { signUp, user, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ fullName: '', email: '', password: '', confirm: '' });

  // Church invitation banner state
  const [inviteChurchName, setInviteChurchName] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.valid) {
          setInviteChurchName(data.church_name);
        }
      })
      .catch(() => {});
  }, [inviteToken]);

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
    const errors = { fullName: '', email: '', password: '', confirm: '' };
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
      const { needsConfirmation: nc } = await signUp(
        email.trim(),
        password,
        fullName.trim() || undefined,
        inviteToken || undefined
      );
      setSuccess(true);
      setNeedsConfirmation(nc);
      if (!nc) {
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
          {needsConfirmation ? 'Check your email' : 'Account created!'}
        </h2>
        {inviteChurchName && (
          <p className="text-sm font-semibold text-green-700 mt-2">
            Joined {inviteChurchName}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2 max-w-xs">
          {needsConfirmation
            ? `We sent a confirmation link to ${email}. Click it to activate your account.`
            : 'Taking you to your carol dashboard…'}
        </p>
        {needsConfirmation && (
          <Link
            href="/login"
            className="btn-primary mt-8 inline-flex items-center justify-center py-3 px-6 text-sm font-semibold"
          >
            Back to Sign In
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}
    >
      {/* ── Hero header ── */}
      <div className="hero-gradient relative overflow-hidden flex items-center justify-center" style={{ minHeight: 210 }}>
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />

        <div className="text-center px-6 z-10">
          <div className="flex justify-center mb-3">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm">
              <TreePine size={30} className="text-white" aria-hidden="true" />
            </span>
          </div>
          <h1 className="text-white text-2xl font-bold leading-tight">Create Account</h1>
          <p className="text-green-200 text-xs mt-1 font-medium">Join the Carol team</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="flex-1 px-5 -mt-6 relative z-10 pb-10">
        <div className="carol-card p-6">
          {/* Church invitation callout banner */}
          {inviteChurchName && (
            <div className="flex items-center gap-3 p-3.5 mb-5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs">
              <ChurchIcon size={18} className="shrink-0 text-green-700" />
              <div>
                <p className="font-bold">Joining {inviteChurchName}</p>
                <p className="text-[11px] text-green-700">You will be automatically added to this church team.</p>
              </div>
            </div>
          )}

          {/* Global error */}
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-5">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Full Name (Optional)
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="signup-name"
                  type="text"
                  className="carol-input !pl-11"
                  placeholder="e.g. John Samuel"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="signup-email"
                  type="email"
                  className={`carol-input !pl-11 ${fieldErrors.email ? 'border-red-400' : ''}`}
                  placeholder="name@example.com"
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
                <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-bold text-slate-700 mb-1.5">
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
                  aria-invalid={!!fieldErrors.password && !requirementsMet}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Password strength</span>
                    <span className={cn('font-semibold', strength.color)}>{strength.label}</span>
                  </div>
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    {[1, 2, 3, 4, 5].map(step => (
                      <div
                        key={step}
                        className={cn(
                          'flex-1 h-full rounded-full transition-all duration-200',
                          step <= strength.score ? strength.barColor : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements checklist */}
              <div id="password-requirements" className="mt-3 space-y-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Password requirements:</p>
                {PASSWORD_REQUIREMENTS.map(req => {
                  const met = req.test(password);
                  return (
                    <div
                      key={req.id}
                      className={cn(
                        'flex items-center gap-2 text-xs transition-colors duration-150',
                        met ? 'text-green-700' : 'text-slate-400'
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 transition-colors',
                          met ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-400'
                        )}
                        aria-hidden="true"
                      >
                        {met ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={2} />}
                      </span>
                      <span>{req.label}</span>
                    </div>
                  );
                })}
              </div>

              {fieldErrors.password && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm-password" className="block text-xs font-bold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  className={cn(
                    'carol-input !pr-14',
                    passwordsMismatch ? 'border-red-400' : '',
                    passwordsMatch ? 'border-green-400' : ''
                  )}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirm) setFieldErrors(prev => ({ ...prev, confirm: '' }));
                  }}
                  autoComplete="new-password"
                  aria-invalid={passwordsMismatch}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {passwordsMatch && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1 font-medium">
                  <Check size={12} strokeWidth={3} /> Passwords match
                </p>
              )}
              {passwordsMismatch && (
                <p role="alert" className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
              {fieldErrors.confirm && !passwordsMismatch && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.confirm}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {loading ? (
                <span>Creating account…</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login'}
                className="font-bold text-green-700 hover:text-green-800 transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
          <TreePine size={40} className="text-green-600 animate-pulse" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
