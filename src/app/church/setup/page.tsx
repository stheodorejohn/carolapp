'use client';

/**
 * Church Setup / Onboarding Page
 *
 * Friendly, accessible first-time onboarding for church administrators.
 * Designed for users aged 14–70: plain language, no tech jargon,
 * clear feedback, high-contrast, large touch targets.
 * Features smart default church slug generation, debounced availability checking,
 * and friendly validation states.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Church as ChurchIcon, TreePine, ArrowRight, CheckCircle2,
  AlertCircle, Link2, LogOut, Check, RefreshCw, Globe, Edit2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { generateChurchSlug, normalizeSlug, validateSlug } from '@/lib/slug';

export default function ChurchSetupPage() {
  const router = useRouter();
  const { createChurch, user, signOut, joinChurchWithInvite } = useAuth();

  const [churchName, setChurchName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'>('idle');
  const [slugFeedback, setSlugFeedback] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const [createdChurch, setCreatedChurch] = useState<{ name: string; slug: string | null } | null>(null);

  // Alternative tab: enter an invite token
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check slug availability against the API
  const verifySlugAvailability = useCallback(async (candidate: string) => {
    const validation = validateSlug(candidate);
    if (!validation.valid) {
      setSlugStatus('invalid');
      setSlugFeedback(validation.error ?? 'Invalid URL format');
      setCheckingSlug(false);
      return;
    }

    setCheckingSlug(true);
    setSlugStatus('checking');

    try {
      const res = await fetch(`/api/churches/check-slug?slug=${encodeURIComponent(validation.normalized)}`);
      const data = await res.json();

      if (data.available) {
        setSlugStatus('available');
        setSlugFeedback(`${validation.normalized} is available`);
      } else {
        setSlugStatus('unavailable');
        setSlugFeedback(data.reason ?? 'This church URL is already in use. Try another name.');
      }
    } catch {
      // In case of network error, don't hard block user
      setSlugStatus('idle');
      setSlugFeedback('');
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Update slug candidate when church name changes (unless user manually edited the slug)
  const handleChurchNameChange = (val: string) => {
    setChurchName(val);
    if (error) setError('');

    if (!slugEdited) {
      const suggested = generateChurchSlug(val);
      setSlug(suggested);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (suggested && suggested.length >= 3) {
        setSlugStatus('checking');
        setCheckingSlug(true);
        debounceTimerRef.current = setTimeout(() => {
          verifySlugAvailability(suggested);
        }, 400);
      } else {
        setSlugStatus('idle');
        setSlugFeedback('');
        setCheckingSlug(false);
      }
    }
  };

  // Update slug when user directly edits the slug field
  const handleSlugChange = (val: string) => {
    setSlugEdited(true);
    const clean = normalizeSlug(val);
    setSlug(clean);
    if (error) setError('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!clean) {
      setSlugStatus('idle');
      setSlugFeedback('');
      setCheckingSlug(false);
      return;
    }

    if (clean.length < 3) {
      setSlugStatus('invalid');
      setSlugFeedback('Church URL must be at least 3 characters.');
      setCheckingSlug(false);
      return;
    }

    setSlugStatus('checking');
    setCheckingSlug(true);
    debounceTimerRef.current = setTimeout(() => {
      verifySlugAvailability(clean);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  async function handleCreateChurch(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = churchName.trim();
    if (!trimmed) {
      setError('Please enter the name of your church.');
      return;
    }

    if (trimmed.length < 3) {
      setError('Church name should be at least 3 characters.');
      return;
    }

    const cleanSlug = normalizeSlug(slug || generateChurchSlug(trimmed));
    const validation = validateSlug(cleanSlug);
    if (!validation.valid) {
      setError(validation.error ?? 'Please choose a valid church URL.');
      return;
    }

    if (slugStatus === 'unavailable') {
      setError('This church URL is already in use. Please choose another one.');
      return;
    }

    setLoading(true);
    try {
      const church = await createChurch(trimmed, cleanSlug);
      setCreatedChurch({ name: church.name, slug: church.slug ?? cleanSlug });
      setCreated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ChurchSetup] creation error:', err);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already in use')) {
        setError('This church URL was just taken. Please choose another one.');
        setSlugStatus('unavailable');
        setSlugFeedback('This church URL was just taken. Try another name.');
      } else {
        setError('Unable to create church. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');

    let token = inviteTokenInput.trim();
    if (!token) {
      setInviteError('Please enter your invitation code or link.');
      return;
    }

    // Extract token if user pasted full URL
    if (token.includes('/join/')) {
      const parts = token.split('/join/');
      token = parts[parts.length - 1].split('?')[0].trim();
    }

    setInviteLoading(true);
    try {
      const res = await joinChurchWithInvite(token);
      if (!res.success) {
        setInviteError(res.error ?? 'Invalid invitation. Please check the code.');
      } else {
        router.replace('/');
      }
    } catch {
      setInviteError('Failed to join church. Please verify the invitation code.');
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}
    >
      {/* ── Top Header ── */}
      <div className="hero-gradient px-6 pt-14 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-md mx-auto relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 text-white">
              <TreePine size={22} />
            </span>
            <span className="text-white font-bold text-lg">Let&apos;s Carol</span>
          </div>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-green-200 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-white/10"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── Main Setup Card ── */}
      <div className="flex-1 px-4 -mt-10 pb-12 flex items-start justify-center">
        <div className="w-full max-w-md carol-card p-6 shadow-xl space-y-6">
          {!created ? (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 text-green-700 mx-auto shadow-sm">
                  <ChurchIcon size={28} />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Set Up Your Church</h1>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Welcome{user?.full_name ? `, ${user.full_name}` : ''}! Create your church workspace to begin organizing carol visits, routes, and teams.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!showInviteBox ? (
                <form onSubmit={handleCreateChurch} className="space-y-4">
                  {/* Church Name Input */}
                  <div>
                    <label htmlFor="church-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Church Name
                    </label>
                    <input
                      id="church-name"
                      type="text"
                      value={churchName}
                      onChange={e => handleChurchNameChange(e.target.value)}
                      placeholder="e.g. St. Mary's Church"
                      required
                      autoFocus
                      disabled={loading}
                      className="carol-input w-full px-4 py-3.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Appears in your team header, invitation links, and live tracking.
                    </p>
                  </div>

                  {/* Church URL Identifier / Slug Field */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="church-slug" className="block text-xs font-bold text-slate-700">
                        Church URL
                      </label>
                      <span className="text-[11px] text-slate-400">Short &amp; memorable</span>
                    </div>

                    <div className="flex items-center rounded-xl bg-white border border-slate-200 overflow-hidden focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
                      <span className="pl-3 pr-1 text-xs text-slate-400 select-none font-mono">
                        /
                      </span>
                      <input
                        id="church-slug"
                        type="text"
                        value={slug}
                        onChange={e => handleSlugChange(e.target.value)}
                        placeholder="e.g. smc"
                        disabled={loading}
                        className="w-full py-2.5 pr-3 text-xs font-mono font-medium text-slate-800 bg-transparent outline-none"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                      {checkingSlug && (
                        <span className="pr-3 text-slate-400">
                          <RefreshCw size={13} className="animate-spin" />
                        </span>
                      )}
                    </div>

                    {/* Slug Real-Time Feedback */}
                    {slugFeedback && (
                      <div className="text-[11px] flex items-center gap-1.5 pt-0.5">
                        {slugStatus === 'available' && (
                          <span className="text-green-700 font-medium flex items-center gap-1">
                            <Check size={12} className="stroke-[3]" />
                            <span>✓ {slugFeedback}</span>
                          </span>
                        )}
                        {(slugStatus === 'unavailable' || slugStatus === 'invalid') && (
                          <span className="text-red-600 font-medium flex items-center gap-1">
                            <AlertCircle size={12} />
                            <span>{slugFeedback}</span>
                          </span>
                        )}
                        {slugStatus === 'checking' && (
                          <span className="text-slate-500">Checking URL availability…</span>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 leading-tight">
                      Your team and congregation will access tracking and songs via this link.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !churchName.trim() ||
                      !slug.trim() ||
                      slugStatus === 'unavailable' ||
                      slugStatus === 'invalid' ||
                      checkingSlug
                    }
                    className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      'Setting Up Church…'
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteBox(true);
                        setError('');
                      }}
                      className="text-xs text-green-700 font-semibold hover:underline inline-flex items-center gap-1.5"
                    >
                      <Link2 size={13} />
                      <span>Have an invitation link or code instead?</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleJoinWithCode} className="space-y-4">
                  <div>
                    <label htmlFor="invite-code" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Invitation Code or Link
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      value={inviteTokenInput}
                      onChange={e => {
                        setInviteTokenInput(e.target.value);
                        if (inviteError) setInviteError('');
                      }}
                      placeholder="Paste invite link or enter code"
                      required
                      autoFocus
                      disabled={inviteLoading}
                      className="carol-input w-full px-4 py-3.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all outline-none"
                    />
                    {inviteError && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={13} />
                        <span>{inviteError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteTokenInput.trim()}
                    className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {inviteLoading ? 'Joining Church…' : 'Join Church'}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteBox(false);
                        setInviteError('');
                      }}
                      className="text-xs text-slate-500 font-semibold hover:underline"
                    >
                      ← Back to create church
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="text-center space-y-5 py-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-green-100 text-green-700 mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  Church Created Successfully
                </span>
                <h2 className="text-2xl font-bold text-slate-800 mt-3">{createdChurch?.name}</h2>
                {createdChurch?.slug && (
                  <p className="text-xs font-mono text-green-700 font-semibold mt-1">
                    /{createdChurch.slug}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  You are now the initial administrator for this church.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Next recommended steps:</p>
                <div className="space-y-1.5 pl-1">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Invite your carol team members and drivers</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Add families and plan carol routes</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.replace(createdChurch?.slug ? `/${createdChurch.slug}/home` : '/')}
                className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2"
              >
                <span>Enter Church Workspace</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
