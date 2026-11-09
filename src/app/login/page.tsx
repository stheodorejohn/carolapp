'use client';

/**
 * Login Page
 *
 * Clean, accessible sign-in experience using Supabase Auth.
 * Designed for users aged 14–70. No jargon, clear feedback,
 * keyboard-navigable, adequate touch targets.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TreePine, Mail, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  // If already authenticated, redirect to home or return URL
  useEffect(() => {
    if (!authLoading && user) {
      const returnTo = searchParams.get('redirect') ?? '/';
      router.replace(returnTo);
    }
  }, [user, authLoading, router, searchParams]);

  function validateFields(): boolean {
    const errors = { email: '', password: '' };
    if (!email.trim()) errors.email = 'Please enter your email address.';
    if (!password) errors.password = 'Please enter your password.';
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateFields()) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Auth state change will trigger the useEffect redirect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // Map Supabase error messages to user-friendly text
      if (
        msg.includes('Invalid login credentials') ||
        msg.includes('invalid_credentials') ||
        msg.includes('Email not confirmed')
      ) {
        setError('The email or password you entered is incorrect. Please try again.');
      } else if (msg.includes('Too many requests')) {
        setError('Too many sign-in attempts. Please wait a moment and try again.');
      } else {
        setError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Show full-screen loading while checking existing session
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <TreePine size={40} className="text-green-600 animate-pulse" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}>
      {/* ── Hero header ── */}
      <div className="hero-gradient relative overflow-hidden flex items-center justify-center" style={{ minHeight: 240 }}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />

        <div className="text-center px-6 z-10">
          <div className="flex justify-center mb-4">
            <span className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm">
              <TreePine size={40} className="text-white" aria-hidden="true" />
            </span>
          </div>
          <h1 className="text-white text-3xl font-bold leading-tight">
            Let&apos;s Carol
          </h1>
          <p className="text-green-200 text-sm mt-2 font-medium">
            Spread the joy. Share the love.
          </p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="flex-1 px-5 -mt-6 relative z-10 pb-10">
        <div className="carol-card p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in to your carol team account</p>

          {/* Global error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-5"
            >
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email / Username */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  className={`carol-input !pl-11 ${fieldErrors.email ? 'border-red-400 focus:border-red-400' : ''}`}
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
                <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-green-700 hover:text-green-800 underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`carol-input !pr-14 ${fieldErrors.password ? 'border-red-400 focus:border-red-400' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  autoComplete="current-password"
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  aria-invalid={!!fieldErrors.password}
                  disabled={loading}
                />
                {/* Show/hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword
                    ? <EyeOff size={18} aria-hidden="true" />
                    : <Eye size={18} aria-hidden="true" />
                  }
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.password}
                </p>
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
                  <svg
                    className="animate-spin h-4 w-4 text-white flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Create account link ── */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">New to the Carol application?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-green-700 hover:text-green-800 underline underline-offset-2"
          >
            Create a new account
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          🎄 Stay connected. Spread the joy.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
          <TreePine size={40} className="text-green-600 animate-pulse" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
