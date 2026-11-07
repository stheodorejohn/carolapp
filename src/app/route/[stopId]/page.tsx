'use client';

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, Phone, MessageSquare, Navigation, Users, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime, formatDate } from '@/lib/utils';
import type { Route } from '@/types/database';

interface Props {
  params: Promise<{ stopId: string }>;
}

function RouteStopContent({ params }: Props) {
  const { stopId } = use(params);
  const [route, setRoute]         = useState<Route | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [visitNotes, setVisitNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [nextRoute, setNextRoute] = useState<Route | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('routes')
          .select('*, family:families(*)')
          .eq('id', stopId)
          .single();
        if (error) throw error;
        const r = data as Route;
        setRoute(r);
        setVisitNotes(r.visit_notes ?? '');

        // Prefetch the next stop (next order_index in same group)
        const { data: nextData } = await supabase
          .from('routes')
          .select('*, family:families(*)')
          .eq('group_id', r.group_id)
          .gt('order_index', r.order_index)
          .neq('status', 'visited')
          .order('order_index', { ascending: true })
          .limit(1)
          .single();
        setNextRoute(nextData as Route ?? null);
      } catch (err) {
        console.error('[RouteStop] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [stopId]);

  async function handleCheckIn() {
    if (!route || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('routes')
      .update({ status: 'in_progress', checked_in_at: now })
      .eq('id', stopId)
      .select('*, family:families(*)')
      .single();
    if (!error && data) setRoute(data as Route);
    setSaving(false);
  }

  async function handleCheckOut() {
    if (!route || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('routes')
      .update({ status: 'visited', checked_out_at: now, visit_notes: visitNotes || null })
      .eq('id', stopId)
      .select('*, family:families(*)')
      .single();
    if (!error && data) {
      setRoute(data as Route);
      setShowSuccess(true);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="page-container bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/route" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse flex-1" />
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="carol-card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-slate-500 text-sm">Stop not found</p>
        <Link href="/route" className="text-green-700 font-semibold text-sm mt-3">← Back to Route</Link>
      </div>
    );
  }

  if (showSuccess) {
    return <CheckInSuccess route={route} nextRoute={nextRoute} />;
  }

  const family = route.family!;
  const checkedIn  = route.status === 'in_progress' || route.status === 'visited';
  const checkedOut = route.status === 'visited';

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/route" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1">Check In / Out</h1>
          <StatusBadge status={route.status} />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {/* Family info */}
        <div className="carol-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-50 flex-shrink-0">
              <Users size={22} className="text-green-700" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-800 text-base">{family.name}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{family.address}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {family.phone && (
              <>
                <a href={`tel:${family.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium">
                  <Phone size={15} /> Call
                </a>
                <a href={`https://wa.me/${family.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  <MessageSquare size={15} /> WhatsApp
                </a>
              </>
            )}
            {(family.latitude !== 0 || family.longitude !== 0) && (
              <a href={`https://maps.google.com/?q=${family.latitude},${family.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                <Navigation size={15} /> Directions
              </a>
            )}
          </div>
        </div>

        {/* ETA */}
        {route.eta && (
          <div className="carol-card p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">ETA</p>
                <p className="text-xl font-bold text-slate-800">{formatTime(route.eta)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Visit Status */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Visit Status</p>

          <div className="flex gap-2 mb-4">
            {(['Arrived', 'Checked In', 'Checked Out'] as const).map((step) => (
              <div key={step} className={`flex-1 py-2 rounded-full text-xs font-semibold border text-center transition-colors ${
                (step === 'Arrived'     && checkedIn)  ? 'bg-green-700 text-white border-green-700' :
                (step === 'Checked In'  && checkedIn)  ? 'bg-green-700 text-white border-green-700' :
                (step === 'Checked Out' && checkedOut) ? 'bg-green-700 text-white border-green-700' :
                'bg-white text-slate-500 border-slate-200'
              }`}>
                {step}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="space-y-3 relative">
            <TimelineEvent label="Arrived"     time={formatTime(route.checked_in_at)}  done={checkedIn}  />
            <TimelineEvent label="Checked In"  time={formatTime(route.checked_in_at)}  done={checkedIn}  />
            <TimelineEvent label="Checked Out" time={formatTime(route.checked_out_at)} done={checkedOut} />
          </div>

          {/* Notes */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Notes (Optional)</p>
            <textarea
              id="visit-notes"
              className="carol-input resize-none"
              rows={2}
              placeholder="Add visit notes…"
              value={visitNotes}
              onChange={e => setVisitNotes(e.target.value)}
              maxLength={300}
              disabled={checkedOut}
            />
            <p className="text-xs text-slate-300 text-right">{visitNotes.length}/300</p>
          </div>
        </div>

        {/* Family details link */}
        <Link href={`/families/${family.id}`} className="carol-card carol-card-hover flex items-center gap-3 p-4 block">
          <Users size={18} className="text-green-700" />
          <span className="flex-1 text-sm font-medium text-slate-700">Family Details</span>
          <ChevronDown size={16} className="text-slate-300 rotate-[-90deg]" />
        </Link>

        {/* Check In / Out button */}
        {!checkedIn ? (
          <button
            id="check-in-btn"
            onClick={handleCheckIn}
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving…' : '✅ Check In'}
          </button>
        ) : !checkedOut ? (
          <button
            id="check-out-btn"
            onClick={handleCheckOut}
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving…' : '🚪 Check Out & Next'}
          </button>
        ) : (
          <div className="carol-card p-4 text-center text-green-700 font-semibold">
            ✅ Visit Complete
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ label, time, done }: { label: string; time: string | null; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'bg-green-700 border-green-700' : 'border-slate-200 bg-white'
      }`}>
        {done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
      </span>
      <p className="flex-1 text-sm text-slate-700">{label}</p>
      {time && <span className="text-xs text-slate-400">{time}</span>}
    </div>
  );
}

function CheckInSuccess({ route, nextRoute }: { route: Route; nextRoute: Route | null }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 px-5 pb-24">
      <div className="carol-card p-8 text-center max-w-sm w-full">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-700 mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 32 32"><path d="M8 16l5 5 11-11" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800">Checked Out! 🎄</h2>
        <p className="text-slate-500 text-sm mt-2">Visit at <strong>{route.family?.name}</strong> is complete.</p>

        <div className="carol-card p-4 mt-5 text-left">
          <p className="font-semibold text-slate-800 text-sm">{route.family?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{route.family?.address}</p>
          <p className="text-xs text-slate-400 mt-1">
            {formatTime(route.checked_in_at)} – {formatTime(route.checked_out_at)} · {formatDate(route.checked_out_at)}
          </p>
        </div>

        {nextRoute?.family ? (
          <Link href={`/route/${nextRoute.id}`} className="btn-primary mt-5">
            View Next Stop →
          </Link>
        ) : (
          <Link href="/route" className="btn-primary mt-5">
            ← Back to Route
          </Link>
        )}
      </div>
    </div>
  );
}

export default function RouteStopPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
          <div className="skeleton w-full rounded-2xl h-14" />
          <div className="skeleton w-full rounded-2xl h-48" />
        </div>
      }
    >
      <RouteStopContent {...props} />
    </Suspense>
  );
}
