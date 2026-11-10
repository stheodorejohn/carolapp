'use client';

/**
 * Church Invitation Landing Page
 *
 * Designed for users aged 14–70:
 * - Prominently displays Church Name before signup/join
 * - Clean, reassuring, accessible UI
 * - Handles non-logged-in users (Sign Up / Sign In) and logged-in users (One-click Join)
 * - Clear friendly error messages without technical jargon
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Church as ChurchIcon, TreePine, ArrowRight, AlertCircle, CheckCircle2, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface JoinPageProps {
  params: Promise<{ token: string }>;
}

export default function JoinChurchPage({ params }: JoinPageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { user, joinChurchWithInvite, refreshChurch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [churchName, setChurchName] = useState('');
  const [role, setRole] = useState('team_member');
  const [errorMsg, setErrorMsg] = useState('');

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setErrorMsg('Invalid invitation link. No invitation code provided.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/invites/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setValid(true);
          setChurchName(data.church_name ?? 'Carol Church');
          setRole(data.role ?? 'team_member');
        } else {
          setValid(false);
          setErrorMsg(data.error ?? 'This invitation link is invalid or expired.');
        }
      } catch (err) {
        console.error('[JoinPage] validation error:', err);
        setErrorMsg('Unable to verify invitation link. Please check your network connection.');
      } finally {
        setLoading(false);
      }
    }

    validate();
  }, [token]);

  async function handleJoinForLoggedInUser() {
    setJoining(true);
    setErrorMsg('');
    try {
      const res = await joinChurchWithInvite(token);
      if (res.success) {
        setJoined(true);
        await refreshChurch();
        setTimeout(() => {
          router.replace('/');
        }, 1200);
      } else {
        setErrorMsg(res.error ?? 'Failed to join church. Please try again.');
      }
    } catch (err) {
      console.error('[JoinPage] join error:', err);
      setErrorMsg('Failed to join church. Please check your connection.');
    } finally {
      setJoining(false);
    }
  }

  const roleDisplay = role === 'driver' ? 'Driver / Sharer' : 'Carol Team Member';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <TreePine size={40} className="text-green-600 animate-pulse" />
        <p className="text-slate-500 text-sm">Verifying invitation…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}
    >
      {/* ── Top Header ── */}
      <div className="hero-gradient px-6 pt-14 pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-md mx-auto relative z-10 flex items-center justify-center">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 text-white">
              <TreePine size={22} />
            </span>
            <span className="text-white font-bold text-lg">Let&apos;s Carol</span>
          </div>
        </div>
      </div>

      {/* ── Card Content ── */}
      <div className="flex-1 px-4 -mt-12 pb-12 flex items-start justify-center">
        <div className="w-full max-w-md carol-card p-6 shadow-xl space-y-6">
          {valid ? (
            !joined ? (
              <>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 text-green-700 mx-auto shadow-sm">
                    <ChurchIcon size={28} />
                  </div>
                  <p className="text-xs uppercase tracking-wider font-bold text-green-700">
                    Welcome to
                  </p>
                  <h1 className="text-2xl font-bold text-slate-800 leading-tight">
                    {churchName}
                  </h1>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    You have been invited to join the <strong>{churchName}</strong> Carol team as a <strong>{roleDisplay}</strong>.
                  </p>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Case 1: User is already signed in */}
                {user ? (
                  <div className="space-y-4 pt-2">
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(user.full_name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          Signed in as {user.full_name ?? user.email}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleJoinForLoggedInUser}
                      disabled={joining}
                      className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {joining ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Joining {churchName}…</span>
                        </>
                      ) : (
                        <>
                          <span>Join {churchName}</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Case 2: User is not signed in */
                  <div className="space-y-3 pt-2">
                    <Link
                      href={`/signup?invite=${encodeURIComponent(token)}`}
                      className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 text-center"
                    >
                      <span>Create Account & Join</span>
                      <ArrowRight size={16} />
                    </Link>

                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-500">
                        Already have an account?{' '}
                        <Link
                          href={`/login?invite=${encodeURIComponent(token)}`}
                          className="font-bold text-green-700 hover:underline"
                        >
                          Sign In
                        </Link>
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-green-100 text-green-700 mx-auto shadow-sm">
                  <CheckCircle2 size={36} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">You&apos;re All Set!</h2>
                <p className="text-xs text-slate-500">
                  Welcome to <strong>{churchName}</strong>! Redirecting you to your team dashboard…
                </p>
              </div>
            )
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 text-red-600 mx-auto">
                <AlertCircle size={28} />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Invalid Invitation</h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                {errorMsg}
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="btn-primary inline-flex items-center justify-center py-3.5 px-6 text-xs font-bold shadow-sm"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

