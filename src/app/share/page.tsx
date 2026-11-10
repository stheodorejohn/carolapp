'use client';

/**
 * Share Tracking Link Page
 *
 * Provides a clean, honest link-sharing interface for the congregation:
 * - Direct share to WhatsApp, SMS, or native share
 * - Quick copy tracking link
 * - Direct link to GPS broadcasting controls
 * - No fake/non-functional duration timer (resolves UX-006)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Copy, Check, Share2, Navigation, Users, Shield, QrCode } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group } from '@/types/database';

export default function ShareLocationPage() {
  const { currentChurch } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadGroup() {
      try {
        let query = supabase
          .from('groups')
          .select('*')
          .eq('is_active', true);

        if (currentChurch?.id) {
          query = query.eq('church_id', currentChurch.id);
        }

        const { data } = await query
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data) setGroup(data as Group);
      } catch (err) {
        console.error('[ShareLocationPage] error loading group:', err);
      }
    }
    loadGroup();
  }, [currentChurch?.id]);

  const groupId = group?.slug || group?.id || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const shareUrl = `${origin}/live/${groupId}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Let's Carol – Live Tracking",
          text: `Follow our church carol team live as we visit homes today:`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  }

  return (
    <div className="page-container bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100" aria-label="Back to Home">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800">Share Live Tracking</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 pb-10">
        {/* ── Info Banner ── */}
        <div className="carol-card p-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-green-50 mx-auto mb-3 text-green-700">
            <Share2 size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Congregation Live Link</h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Send this public link to your church WhatsApp group or congregation. Families can open it in any browser to watch the carol team approach their neighborhood in real time.
          </p>
        </div>

        {/* ── Link Preview & Actions ── */}
        <div className="carol-card p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Public Web Link
          </p>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="flex-1 text-xs text-slate-700 truncate font-mono font-medium">{shareUrl}</p>
            <button
              id="copy-link-btn"
              onClick={handleCopy}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 flex-shrink-0 text-slate-600 hover:text-green-700 transition-colors"
              aria-label="Copy tracking link"
              title="Copy link"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>

          <button
            id="start-sharing-btn"
            onClick={handleShare}
            className="btn-primary py-3.5 text-sm font-bold shadow-md gap-2 flex items-center justify-center"
          >
            <Share2 size={18} />
            {copied ? 'Link Copied to Clipboard!' : 'Share Link with Congregation'}
          </button>
        </div>

        {/* ── Driver GPS Broadcast Shortcut ── */}
        <div className="carol-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">
              <Navigation size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">Are you the team driver?</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Remember to start GPS broadcasting from your phone so this link shows your current position.
              </p>
              <Link
                href="/location"
                className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Open Live GPS Controls →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Privacy Guarantee ── */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs">
          <Shield size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Congregation Privacy:</strong> Public tracking shows only the vehicle location and stop names. Family contact phone numbers, notes, and member names are protected and visible only to signed-in team members.
          </p>
        </div>
      </div>
    </div>
  );
}
