'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Copy, Check, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';

const DURATION_OPTIONS = [
  { label: '1 hour',  value: 60  },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Custom',  value: -1  },
];

export default function ShareLocationPage() {
  const [group, setGroup] = useState<Group | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadGroup() {
      try {
        const { data } = await supabase
          .from('groups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data) setGroup(data as Group);
      } catch (err) {
        console.error('[ShareLocationPage] error loading group:', err);
      }
    }
    loadGroup();
  }, []);

  const groupId = group?.id ?? '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const shareUrl = `${origin}/live/${groupId}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: "Let's Carol – Live Tracking", url: shareUrl });
    } else {
      handleCopy();
    }
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800">Share Location</h1>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Info banner */}
        <div className="carol-card p-5 text-center">
          <span className="text-4xl">📍</span>
          <h2 className="text-lg font-bold text-slate-800 mt-3">Live Location Sharing</h2>
          <p className="text-sm text-slate-500 mt-2">
            Share your live location with the congregation or team members for the selected duration.
          </p>
        </div>

        {/* Duration picker */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Sharing Duration
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                id={`share-duration-${opt.value}`}
                onClick={() => setDuration(opt.value)}
                className={`py-3 rounded-2xl text-xs font-semibold border-2 transition-all ${
                  duration === opt.value
                    ? 'bg-green-700 text-white border-green-700 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Link preview */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Tracking Link
          </p>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="flex-1 text-xs text-slate-600 truncate font-mono">{shareUrl}</p>
            <button
              id="copy-link-btn"
              onClick={handleCopy}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 flex-shrink-0"
              aria-label="Copy link"
            >
              {copied
                ? <Check size={14} className="text-green-600" />
                : <Copy size={14} className="text-slate-400" />
              }
            </button>
          </div>
        </div>

        {/* CTA */}
        <button
          id="start-sharing-btn"
          onClick={handleShare}
          className="btn-primary gap-2"
        >
          <Share2 size={18} />
          🟢 Start Sharing
        </button>

        <p className="text-xs text-slate-400 text-center">
          Location will be shared with the live tracking page. You can stop it anytime.
        </p>
      </div>
    </div>
  );
}
