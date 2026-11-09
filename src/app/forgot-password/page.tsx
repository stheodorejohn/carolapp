'use client';

/**
 * Forgot Password Page
 *
 * Allows users (aged 14–70) to request a password reset email via Supabase Auth.
 * Clear copy, accessible inputs with correct icon padding, friendly error handling.
 */

import { useState } from 'react';
import Link from 'next/link';
import { TreePine, Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  function validate(): boolean {
    if (!email.trim()) {
      setFieldError('Please enter your email address.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Please enter a valid email address (e.g. name@example.com).');
      return false;
    }
    setFieldError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError('Too many reset requests. Please wait a few minutes before trying again.');
      } else {
        setError('Unable to send password reset email. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
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
            <TreePine size={28} className="text-green-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Let&apos;s Carol 🎄</h1>
          <p className="text-green-200 text-xs mt-1">Reset your account password</p>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="flex-1 px-4 py-6 max-w-md w-full mx-auto -mt-6 z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
          {submitted ? (
            /* ── Success state ── */
            <div className="text-center py-2">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-600 mx-auto mb-4 border border-green-100">
                <CheckCircle2 size={36} aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Check your email</h2>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                We sent a password reset link to <strong className="text-slate-800">{email}</strong>.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4 text-xs text-slate-500 text-left">
                💡 <span className="font-semibold text-slate-700">Didn&apos;t get the email?</span>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Check your spam or junk folder.</li>
                  <li>Verify that you entered the right email.</li>
                  <li>Wait 1–2 minutes for delivery.</li>
                </ul>
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  href="/login"
                  className="btn-primary"
                >
                  Return to Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); }}
                  className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 py-2"
                >
                  Try another email address
                </button>
              </div>
            </div>
          ) : (
            /* ── Input form state ── */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Forgot Password</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your email address and we&apos;ll send you a link to choose a new password.
                </p>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-5">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="reset-email"
                      type="email"
                      className={`carol-input !pl-11 ${fieldError ? 'border-red-400 focus:border-red-400' : ''}`}
                      placeholder="Enter your email address"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        if (fieldError) setFieldError('');
                      }}
                      autoComplete="email"
                      autoCapitalize="none"
                      aria-describedby={fieldError ? 'reset-email-error' : undefined}
                      aria-invalid={!!fieldError}
                      disabled={loading}
                    />
                  </div>
                  {fieldError && (
                    <p id="reset-email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                      {fieldError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending reset link…
                    </>
                  ) : (
                    <>
                      Send Reset Link <ArrowRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center border-t border-slate-100 pt-5">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-800"
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          🎄 Stay connected. Spread the joy.
        </p>
      </div>
    </div>
  );
}

