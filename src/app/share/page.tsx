'use client';

/**
 * Share Tracking Link Page
 *
 * Implements the QR Share-Card & Native Share Experience:
 * - Deterministic, high-contrast Share Card image (church name, heading, large QR code, clear instructions)
 * - Canonical public URL: https://[domain]/[churchSlug]/live/[groupSlug]
 * - Standard share message text (appears below image in WhatsApp/SMS where supported)
 * - Single primary action: [ Share Live Tracking ]
 * - Secondary actions: Copy Link, Download Image, Download QR
 * - Progressive disclosure: driver controls only shown to authorized drivers/admins
 * - Designed for ages 14–70 with zero decorative clutter and high readability
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ChevronLeft, Copy, Check, Share2, Download, QrCode,
  Navigation, Shield, ChevronDown, ChevronUp, RefreshCw, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { generateShareCard, type ShareCardResult } from '@/lib/share-card';
import type { Group } from '@/types/database';

export default function ShareLocationPage() {
  const { currentChurch, authorizedRoles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [group, setGroup] = useState<Group | null>(null);
  const [cardResult, setCardResult] = useState<ShareCardResult | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);

  const isDriverOrAdmin = authorizedRoles.includes('driver') || authorizedRoles.includes('admin');

  // Canonical slug route redirection
  useEffect(() => {
    if (pathname === '/share' && currentChurch?.slug) {
      router.replace(`/${currentChurch.slug}/share`);
    }
  }, [pathname, currentChurch?.slug, router]);

  // Load active group and generate card
  const loadAndGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      let query = supabase
        .from('groups')
        .select('*')
        .eq('is_active', true);

      if (currentChurch?.id) {
        query = query.eq('church_id', currentChurch.id);
      }

      const { data: grp, error: grpErr } = await query
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (grpErr) throw grpErr;

      const activeGroup = grp as Group | null;
      setGroup(activeGroup);

      const churchName = currentChurch?.name ?? 'Our Church';
      const churchSlug = currentChurch?.slug ?? 'live';
      const groupSlug = activeGroup?.slug || activeGroup?.id || 'live';
      const teamName = activeGroup?.name;

      const result = await generateShareCard({
        churchName,
        teamName,
        churchSlug,
        groupSlug,
      });

      setCardResult(result);
    } catch (err: unknown) {
      console.error('[SharePage] Failed to generate card:', err);
      setError('Could not generate share card. Please check your internet connection.');
    } finally {
      setGenerating(false);
    }
  }, [currentChurch?.id, currentChurch?.name, currentChurch?.slug]);

  useEffect(() => {
    loadAndGenerate();
  }, [loadAndGenerate]);

  // Primary Action: Native Web Share
  async function handleNativeShare() {
    if (!cardResult) return;

    const { cardFile, canonicalUrl, shareText } = cardResult;

    // Check if platform supports sharing files (e.g. mobile Safari, Chrome Android)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [cardFile] })) {
      try {
        await navigator.share({
          files: [cardFile],
          title: "Follow our Carol Team Live",
          text: shareText,
          url: canonicalUrl,
        });
        return;
      } catch (err: unknown) {
        // If user cancelled, do nothing; if rejected, fallback below
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback 1: Text + URL native share without file attachment
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: "Follow our Carol Team Live",
          text: shareText,
          url: canonicalUrl,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback 2: Copy link to clipboard
    await handleCopyLink();
  }

  // Secondary Action: Copy canonical link
  async function handleCopyLink() {
    if (!cardResult) return;
    try {
      await navigator.clipboard.writeText(cardResult.canonicalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Ignore clipboard error
    }
  }

  // Secondary Action: Copy formatted message text
  async function handleCopyText() {
    if (!cardResult) return;
    try {
      await navigator.clipboard.writeText(cardResult.shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2200);
    } catch {
      // Ignore
    }
  }

  // Secondary Action: Download Full Share Card Image
  function handleDownloadCard() {
    if (!cardResult) return;
    const a = document.createElement('a');
    a.href = cardResult.cardDataUrl;
    a.download = `${currentChurch?.slug || 'carol'}-live-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Secondary Action: Download Standalone QR Code
  function handleDownloadQr() {
    if (!cardResult) return;
    const a = document.createElement('a');
    a.href = cardResult.qrDataUrl;
    a.download = `${currentChurch?.slug || 'carol'}-qr-code.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const backHref = currentChurch?.slug ? `/${currentChurch.slug}/home` : '/';

  return (
    <div className="page-container bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 truncate">Share Live Tracking</h1>
            <p className="text-xs text-slate-400">
              {currentChurch?.name ?? 'Let’s Carol'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-12 max-w-lg mx-auto">
        {/* ── Error Banner ── */}
        {error && (
          <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-800">Card Generation Notice</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => loadAndGenerate()}
              className="text-xs font-bold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Share Card Live Preview ── */}
        <div className="carol-card p-4 text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Share Card Preview
          </p>

          {generating ? (
            <div className="w-full aspect-[1080/1400] max-w-xs mx-auto rounded-2xl bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-green-600 mb-3" />
              <p className="text-xs font-medium">Generating high-contrast share card…</p>
            </div>
          ) : cardResult ? (
            <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              <img
                src={cardResult.cardDataUrl}
                alt="Carol Live Tracking Share Card"
                className="w-full h-auto block"
              />
            </div>
          ) : null}

          {/* Canonical Link Display */}
          {cardResult && (
            <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-left">
              <p className="text-xs font-mono font-medium text-slate-700 truncate flex-1">
                {cardResult.canonicalUrl}
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg text-slate-500 hover:text-green-700 active:scale-95 transition-all"
                title="Copy Link"
                aria-label="Copy Link"
              >
                {copiedLink ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* ── PRIMARY ACTION: Single Clear Share Button ── */}
        <button
          id="share-live-tracking-btn"
          type="button"
          onClick={handleNativeShare}
          disabled={generating || !cardResult}
          className="btn-primary w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2.5 shadow-md shadow-green-700/20 active:scale-98 transition-all disabled:opacity-50"
        >
          <Share2 size={20} />
          <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Share Live Tracking'}</span>
        </button>

        {/* ── SECONDARY ACTIONS ── */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={generating || !cardResult}
            className="btn-outline py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {copiedLink ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-slate-600" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCard}
            disabled={generating || !cardResult}
            className="btn-outline py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <Download size={16} className="text-slate-600" />
            <span>Download Card</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={generating || !cardResult}
            className="btn-outline py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <QrCode size={16} className="text-slate-600" />
            <span>QR Code Only</span>
          </button>
        </div>

        {/* ── PROGRESSIVE DISCLOSURE: Accompanying Text Message ── */}
        {cardResult && (
          <div className="carol-card p-3.5">
            <button
              type="button"
              onClick={() => setShowTextPreview(prev => !prev)}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 py-1"
            >
              <span>Accompanying Message Text</span>
              {showTextPreview ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showTextPreview && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <pre className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl whitespace-pre-wrap font-sans leading-relaxed border border-slate-200/60">
                  {cardResult.shareText}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                >
                  {copiedText ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copiedText ? 'Message Copied!' : 'Copy Message Text'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── DRIVER CONTROLS (Only visible to Driver or Admin) ── */}
        {isDriverOrAdmin && (
          <div className="carol-card p-4 border border-blue-100 bg-blue-50/40">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex-shrink-0 mt-0.5">
                <Navigation size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">Driver GPS Broadcast</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Remember to start live location sharing on your phone so families can see vehicle movement.
                </p>
                <Link
                  href={currentChurch?.slug ? `/${currentChurch.slug}/location` : '/location'}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <span>Open Driver GPS Controls →</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Privacy Guarantee ── */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs">
          <Shield size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Congregation Privacy:</strong> Public tracking shows only the vehicle location and stop names. Family contact phone numbers, notes, and member names are protected and visible only to signed-in team members.
          </p>
        </div>
      </div>
    </div>
  );
}
