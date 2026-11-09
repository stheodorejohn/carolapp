'use client';

import { useState, useRef, useCallback, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, User, MapPin, Phone, StickyNote,
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  Plus, Trash2, X, Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberDraft {
  id: string;
  name: string;
  type: 'adult' | 'child';
  age: string;
  phone: string;
  relation: string;
}

interface FamilyDraft {
  name: string;
  address: string;
  phone: string;
  notes: string;
  mapsLink: string;
  latitude: string;
  longitude: string;
}

interface ImportRow {
  name: string;
  address: string;
  phone: string;
  notes: string;
  status: 'ok' | 'error';
  error?: string;
}

type Tab = 'manual' | 'import';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Extracts latitude & longitude from common Google Maps URL formats:
 * - https://www.google.com/maps/place/.../@13.0827,80.2707,17z/...
 * - https://maps.google.com/?q=13.0827,80.2707
 * - https://www.google.com/maps?q=13.0827,80.2707
 * - https://www.google.com/maps/search/?api=1&query=13.0827,80.2707
 * Returns { lat, lng } or null if not parseable.
 */
function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  try {
    // Pattern 1: /@lat,lng,zoom
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // Pattern 2: ?q=lat,lng or &q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // Pattern 3: query=lat,lng
    const queryMatch = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (queryMatch) return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };

    // Pattern 4: ll=lat,lng
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  } catch {
    // ignore
  }
  return null;
}

const TEMPLATE_HEADERS = ['Name *', 'Address *', 'Phone', 'Notes'];

function downloadTemplate() {
  // Build a minimal CSV template for users to fill in
  const rows = [
    TEMPLATE_HEADERS,
    ['Mary & Joseph', '12, Greenwood Street, Chennai – 600 041', '+91 98765 43210', 'Active in church'],
    ['Abraham Family', '5, Palm Grove, Chennai – 600 034', '+91 98765 55000', ''],
  ];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'families_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddFamilyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/families"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-800">Add Family</h1>
            <p className="text-xs text-slate-400">Manual entry or bulk import</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex mt-4 bg-slate-100 rounded-xl p-1 gap-1">
          {(['manual', 'import'] as Tab[]).map(t => (
            <button
              key={t}
              id={`tab-${t}`}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${tab === t
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {t === 'manual' ? '✏️ Manual Entry' : '📊 Import Excel / CSV'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {tab === 'manual' ? (
          <ManualForm onSuccess={() => router.push('/families')} />
        ) : (
          <ImportForm onSuccess={() => router.push('/families')} />
        )}
      </div>
    </div>
  );
}

// ─── Manual Form ──────────────────────────────────────────────────────────────

function ManualForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<FamilyDraft>({
    name: '', address: '', phone: '', notes: '',
    mapsLink: '', latitude: '', longitude: '',
  });
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<FamilyDraft>>({});
  const [locationParsed, setLocationParsed] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');

  const set = (k: keyof FamilyDraft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Allow only digits, +, -, spaces in phone fields
  function handlePhone(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^0-9+\- ]/g, '');
    setForm(f => ({ ...f, phone: val }));
  }

  function phoneWarnMsg(val: string): string {
    const digits = val.replace(/\D/g, '').length;
    if (digits > 15) return 'Number seems too long — please double-check.';
    if (digits > 10) return 'More than 10 digits. If this is a landline, include STD code (e.g. 044-XXXXXXXX).';
    return '';
  }

  function handleMapsLink(e: ChangeEvent<HTMLInputElement>) {
    const url = e.target.value;
    setForm(f => ({ ...f, mapsLink: url }));
    setLocationError('');
    setLocationParsed(null);

    if (!url.trim()) return;

    // Short links (maps.app.goo.gl) — save the link but note coords can't be auto-parsed
    if (url.includes('goo.gl') || url.includes('maps.app')) {
      setLocationError('Short link saved ✓ — coordinates can\'t be auto-read from this URL. Enter lat/lng manually below if needed.');
      return;
    }

    const coords = parseGoogleMapsUrl(url);
    if (coords) {
      setLocationParsed(coords);
      setForm(f => ({
        ...f,
        mapsLink: url,
        latitude: coords.lat.toString(),
        longitude: coords.lng.toString(),
      }));
    } else {
      setLocationError('Could not read coordinates. Try: right-click a spot on Google Maps → "What\'s here?" → copy the lat,lng shown.');
    }
  }

  function addMember() {
    setMembers(m => [...m, { id: uid(), name: '', type: 'adult', age: '', phone: '', relation: '' }]);
  }

  function updateMember(id: string, k: keyof MemberDraft, v: string) {
    setMembers(m => m.map(x => x.id === id ? { ...x, [k]: v } : x));
  }

  function removeMember(id: string) {
    setMembers(m => m.filter(x => x.id !== id));
  }

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  function nextFromBasics() {
    if (!form.name.trim()) {
      setErrors({ name: 'Family name is required' });
      return;
    }
    setErrors({});
    setStep(2);
  }

  function nextFromLocation() {
    if (!form.address.trim()) {
      setErrors({ address: 'Address is required' });
      return;
    }
    setErrors({});
    setStep(3);
  }

  function validate() {
    const e: Partial<FamilyDraft> = {};
    if (!form.name.trim()) e.name = 'Family name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) {
      if (!form.name.trim()) setStep(1);
      else if (!form.address.trim()) setStep(2);
      return;
    }
    setSaving(true);

    try {
      // 1. Insert the family row
      const { data: familyRow, error: familyErr } = await supabase
        .from('families')
        .insert({
          name: form.name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          latitude: locationParsed?.lat ?? (form.latitude ? parseFloat(form.latitude) : 0),
          longitude: locationParsed?.lng ?? (form.longitude ? parseFloat(form.longitude) : 0),
        })
        .select('id')
        .single();

      if (familyErr) throw familyErr;

      // 2. Insert family members (if any)
      if (members.length > 0 && familyRow?.id) {
        const memberRows = members
          .filter(m => m.name.trim())
          .map(m => ({
            family_id: familyRow.id,
            name: m.name.trim(),
            type: m.type,
            age: m.type === 'child' && m.age ? parseInt(m.age) : null,
            phone: m.phone.trim() || null,
            relation: m.relation.trim() || null,
          }));

        if (memberRows.length > 0) {
          const { error: membersErr } = await supabase
            .from('family_members')
            .insert(memberRows);
          if (membersErr) console.warn('[Supabase] Members insert error:', membersErr);
        }
      }

      setSaved(true);
      setTimeout(onSuccess, 1200);
    } catch (err) {
      console.error('[Supabase] Family insert failed:', err);
      setErrors({ name: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <p className="font-semibold text-slate-800">Family added!</p>
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Step Progress Indicator ── */}
      <div className="flex items-center justify-between mb-5 px-1">
        {[
          { num: 1 as const, label: 'Basics' },
          { num: 2 as const, label: 'Location' },
          { num: 3 as const, label: 'Members' },
          { num: 4 as const, label: 'Review' },
        ].map((s, idx, arr) => (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => {
                if (s.num === 1) setStep(1);
                else if (s.num === 2 && form.name.trim()) setStep(2);
                else if (s.num === 3 && form.name.trim() && form.address.trim()) setStep(3);
                else if (s.num === 4 && form.name.trim() && form.address.trim()) setStep(4);
              }}
              className="flex flex-col items-center group"
            >
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  step === s.num
                    ? 'bg-green-700 text-white shadow-sm ring-2 ring-green-600 ring-offset-2'
                    : step > s.num
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <span className={`text-[10px] font-semibold mt-1 transition-colors ${
                step === s.num ? 'text-green-800' : 'text-slate-400'
              }`}>
                {s.label}
              </span>
            </button>
            {idx < arr.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 -mt-4 transition-all ${
                  step > s.num ? 'bg-green-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: BASICS ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="carol-card p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step 1 of 4: Family Basics</p>
              <p className="text-xs text-slate-500 mt-0.5">Enter the family name and primary phone number.</p>
            </div>

            <Field
              id="family-name"
              label="Family Name"
              required
              icon={<User size={15} className="text-slate-400" />}
              error={errors.name}
            >
              <input
                id="family-name"
                type="text"
                placeholder="e.g. Abraham Family"
                value={form.name}
                onChange={set('name')}
                className="carol-input !pl-9 py-3 text-sm"
                autoFocus
              />
            </Field>

            <Field
              id="family-phone"
              label="Phone Number"
              icon={<Phone size={15} className="text-slate-400" />}
              warn={phoneWarnMsg(form.phone)}
            >
              <input
                id="family-phone"
                type="tel"
                placeholder="+91 98765 43210 (optional)"
                value={form.phone}
                onChange={handlePhone}
                className="carol-input !pl-9 py-3 text-sm"
                inputMode="tel"
              />
            </Field>

            <Field
              id="family-notes"
              label="Special Notes"
              icon={<StickyNote size={15} className="text-slate-400" />}
            >
              <textarea
                id="family-notes"
                placeholder="Prayer requests, gate code, or special instructions (optional)…"
                value={form.notes}
                onChange={set('notes')}
                rows={2}
                className="carol-input !pl-9 py-3 text-sm resize-none"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={nextFromBasics}
            className="btn-primary py-3.5 text-sm font-bold shadow-md"
          >
            Next: Family Location →
          </button>
        </div>
      )}

      {/* ── STEP 2: LOCATION ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="carol-card p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step 2 of 4: Family Location</p>
              <p className="text-xs text-slate-500 mt-0.5">Where should the carol team travel?</p>
            </div>

            <Field
              id="family-address"
              label="Street Address"
              required
              icon={<MapPin size={15} className="text-slate-400" />}
              error={errors.address}
            >
              <textarea
                id="family-address"
                placeholder="e.g. 12, Church Road, Anna Nagar, Chennai – 600 040"
                value={form.address}
                onChange={set('address')}
                rows={2}
                className="carol-input !pl-9 py-3 text-sm resize-none"
                autoFocus
              />
            </Field>

            {/* Google Maps link */}
            <div>
              <label htmlFor="maps-link" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Google Maps Link <span className="text-slate-400 font-normal">(optional — auto-fills GPS)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">
                  <MapPin size={15} className="text-slate-400" />
                </div>
                <input
                  id="maps-link"
                  type="url"
                  placeholder="Paste Google Maps URL"
                  value={form.mapsLink}
                  onChange={handleMapsLink}
                  className="carol-input !pl-9 py-3 text-sm"
                />
              </div>
              {locationError && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> {locationError}
                </p>
              )}
              {locationParsed && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span>GPS detected: <strong>{locationParsed.lat.toFixed(6)}, {locationParsed.lng.toFixed(6)}</strong></span>
                </div>
              )}
            </div>

            {/* Progressive disclosure for raw GPS */}
            <details className="pt-2 border-t border-slate-100">
              <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-green-700 select-none py-1">
                ⚙️ Optional: Manual GPS Coordinates
              </summary>
              <div className="flex gap-3 mt-2">
                <div className="flex-1">
                  <label htmlFor="lat" className="block text-xs font-semibold text-slate-600 mb-1.5">Latitude</label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    placeholder="13.0827"
                    value={form.latitude}
                    onChange={e => {
                      setForm(f => ({ ...f, latitude: e.target.value }));
                      setLocationParsed(null);
                    }}
                    className="carol-input py-2 text-xs font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="lng" className="block text-xs font-semibold text-slate-600 mb-1.5">Longitude</label>
                  <input
                    id="lng"
                    type="number"
                    step="any"
                    placeholder="80.2707"
                    value={form.longitude}
                    onChange={e => {
                      setForm(f => ({ ...f, longitude: e.target.value }));
                      setLocationParsed(null);
                    }}
                    className="carol-input py-2 text-xs font-mono"
                  />
                </div>
              </div>
            </details>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-3 px-5 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={nextFromLocation}
              className="btn-primary flex-1 py-3 text-sm font-bold shadow-md"
            >
              Next: Family Members →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: MEMBERS ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="carol-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step 3 of 4: Family Members</p>
                <p className="text-xs text-slate-500 mt-0.5">Add names of family members (optional).</p>
              </div>
              <button
                type="button"
                id="add-member-btn"
                onClick={addMember}
                className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 px-2.5 py-1.5 rounded-full"
              >
                <Plus size={13} /> Add Member
              </button>
            </div>

            {members.length === 0 && (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-600 font-medium">No members added yet</p>
                <p className="text-xs text-slate-400 mt-0.5">You can add members now or skip to review</p>
                <button
                  type="button"
                  onClick={addMember}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-700 underline"
                >
                  + Add first member
                </button>
              </div>
            )}

            {members.map((m, i) => (
              <div key={m.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-600">Member {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    aria-label={`Remove member ${i + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Full name"
                  value={m.name}
                  onChange={e => updateMember(m.id, 'name', e.target.value)}
                  className="carol-input py-2.5 text-sm"
                />

                {/* Relation chips */}
                <RelationPicker
                  value={m.relation}
                  onChange={v => updateMember(m.id, 'relation', v)}
                />

                <div className="flex items-center gap-2">
                  {(['adult', 'child'] as const).map(type => (
                    <label
                      key={type}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors select-none ${
                        m.type === type
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`member-type-${m.id}`}
                        value={type}
                        checked={m.type === type}
                        onChange={() => updateMember(m.id, 'type', type)}
                        className="sr-only"
                      />
                      <span>{type === 'adult' ? '🧑' : '👶'}</span>
                      <span>{type === 'adult' ? 'Adult' : 'Child'}</span>
                    </label>
                  ))}
                  {m.type === 'child' && (
                    <input
                      type="number"
                      placeholder="Age"
                      value={m.age}
                      onChange={e => updateMember(m.id, 'age', e.target.value)}
                      className="carol-input py-2 text-sm w-20"
                      min={0}
                      max={17}
                    />
                  )}
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={m.phone}
                    onChange={e => updateMember(m.id, 'phone', e.target.value.replace(/[^0-9+\- ]/g, ''))}
                    className="carol-input py-2 text-sm"
                    inputMode="tel"
                  />
                  {phoneWarnMsg(m.phone) && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {phoneWarnMsg(m.phone)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-3 px-5 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="btn-primary flex-1 py-3 text-sm font-bold shadow-md"
            >
              Next: Review & Save →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: REVIEW & SAVE ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="carol-card p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step 4 of 4: Review Summary</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{form.name}</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-medium">Address</p>
                <p className="text-slate-800 font-medium mt-0.5">{form.address}</p>
              </div>

              {form.phone && (
                <div>
                  <p className="text-xs text-slate-400 font-medium">Phone</p>
                  <p className="text-slate-800 font-medium mt-0.5">{form.phone}</p>
                </div>
              )}

              {form.notes && (
                <div>
                  <p className="text-xs text-slate-400 font-medium">Notes</p>
                  <p className="text-slate-700 mt-0.5 bg-slate-50 p-2.5 rounded-xl text-xs">{form.notes}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400 font-medium">Location</p>
                <p className="text-xs text-slate-700 mt-0.5">
                  {locationParsed
                    ? `GPS: ${locationParsed.lat.toFixed(5)}, ${locationParsed.lng.toFixed(5)} ✓`
                    : form.latitude && form.longitude
                    ? `GPS: ${parseFloat(form.latitude).toFixed(5)}, ${parseFloat(form.longitude).toFixed(5)} ✓`
                    : 'Address only (no GPS coordinates)'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium">Family Members ({members.length})</p>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic mt-0.5">None listed</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {members.filter(m => m.name.trim()).map(m => (
                      <span key={m.id} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        {m.name} {m.relation ? `(${m.relation})` : ''} {m.type === 'child' ? '👶' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="py-3 px-5 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ← Back
            </button>
            <button
              id="save-family-btn"
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-3.5 text-sm font-bold shadow-md disabled:opacity-60"
            >
              {saving ? 'Creating Family…' : '✅ Confirm & Save Family'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
  );
}

// ─── Relation picker ──────────────────────────────────────────────────────────

const RELATION_CHIPS = [
  'Father', 'Mother', 'Son', 'Daughter',
  'Mother-in-law', 'Father-in-law',
  'Husband', 'Wife',
  'Brother', 'Sister',
  'Grandfather', 'Grandmother',
];

function RelationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalizedValue = (value || '').trim().toLowerCase();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500">
          Relation <span className="font-normal text-slate-400">(select or type)</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* Common relation chips */}
      <div className="flex flex-wrap gap-1.5">
        {RELATION_CHIPS.map(chip => {
          const isSelected = normalizedValue === chip.toLowerCase();
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(isSelected ? '' : chip)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-green-100 border-green-500 text-green-800 font-semibold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Direct text input for custom relation */}
      <input
        type="text"
        placeholder="e.g. Sam's father, Jerry's father, Uncle…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="carol-input py-2 text-sm"
      />
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  id, label, required, icon, error, warn, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
  warn?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 pointer-events-none flex items-center">
            {icon}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
      {!error && warn && (
        <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} /> {warn}
        </p>
      )}
    </div>
  );
}

// ─── Import Form ──────────────────────────────────────────────────────────────

function ImportForm({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [parseError, setParseError] = useState('');

  const parseFile = useCallback(async (file: File) => {
    setParseError('');
    setRows([]);
    setFileName(file.name);

    const isCSV = file.name.endsWith('.csv');
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCSV && !isXLSX) {
      setParseError('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (data.length < 2) {
        setParseError('The file appears to be empty or has no data rows.');
        return;
      }

      // Skip header row, parse remaining
      const parsed: ImportRow[] = data.slice(1).map((row): ImportRow => {
        const name = String(row[0] ?? '').trim();
        const address = String(row[1] ?? '').trim();
        const phone = String(row[2] ?? '').trim();
        const notes = String(row[3] ?? '').trim();

        if (!name) return { name, address, phone, notes, status: 'error', error: 'Name is required' };
        if (!address) return { name, address, phone, notes, status: 'error', error: 'Address is required' };
        return { name, address, phone, notes, status: 'ok' };
      }).filter(r => r.name || r.address); // drop completely blank rows

      setRows(parsed);
    } catch {
      setParseError('Could not read the file. Make sure it\'s a valid Excel or CSV file.');
    }
  }, []);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i));
  }

  const validRows = rows.filter(r => r.status === 'ok');
  const errorRows = rows.filter(r => r.status === 'error');

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);

    try {
      const rows_to_insert = validRows.map(r => ({
        name: r.name.trim(),
        address: r.address.trim(),
        phone: r.phone?.trim() || null,
        notes: r.notes?.trim() || null,
        latitude: 0,
        longitude: 0,
      }));

      const { error } = await supabase
        .from('families')
        .insert(rows_to_insert);

      if (error) throw error;

      setDone(true);
      setTimeout(onSuccess, 1400);
    } catch (err) {
      console.error('[Supabase] Bulk import failed:', err);
      setParseError('Import failed. Please check your Supabase connection and try again.');
    } finally {
      setImporting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <p className="font-semibold text-slate-800">{validRows.length} families imported!</p>
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="carol-card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Download Template</p>
          <p className="text-xs text-slate-400 mt-0.5">Fill it in, then upload below</p>
        </div>
        <button
          id="download-template-btn"
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-xs font-semibold text-green-700 border border-green-700 rounded-full px-3 py-2 hover:bg-green-50 transition-colors flex-shrink-0"
        >
          <Download size={13} /> CSV Template
        </button>
      </div>

      {/* Required columns hint */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
        <p className="text-xs font-semibold text-blue-700 mb-1">Expected columns (in order)</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_HEADERS.map(h => (
            <span key={h} className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        id="file-drop-zone"
        style={{
          border: `2px dashed ${dragging ? '#166534' : '#cbd5e1'}`,
          borderRadius: 16,
          padding: '32px 24px',
          background: dragging ? '#f0fdf4' : 'white',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileChange}
          className="hidden"
          id="file-upload-input"
        />

        {fileName ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet size={32} className="text-green-600" />
            <p className="text-sm font-semibold text-slate-700">{fileName}</p>
            <p className="text-xs text-slate-400">Tap to change file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Upload size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Drop your file here</p>
              <p className="text-xs text-slate-400 mt-0.5">or tap to browse · .xlsx, .xls, .csv</p>
            </div>
          </div>
        )}
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{parseError}</p>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="carol-card overflow-hidden">
          {/* Summary */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                ✓ {validRows.length} ready
              </span>
              {errorRows.length > 0 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  ✗ {errorRows.length} errors
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{rows.length} rows total</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 ${row.status === 'error' ? 'bg-red-50/60' : ''
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${row.status === 'error' ? 'text-red-700' : 'text-slate-800'
                    }`}>
                    {row.name || <span className="italic text-slate-400">No name</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{row.address || '—'}</p>
                  {row.error && (
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle size={10} /> {row.error}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                  aria-label="Remove row"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Import button */}
          <div className="px-4 py-3 border-t border-slate-100">
            <button
              id="import-families-btn"
              type="button"
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing
                ? `Importing ${validRows.length} families…`
                : `⬆️ Import ${validRows.length} ${validRows.length === 1 ? 'Family' : 'Families'}`}
            </button>
            {errorRows.length > 0 && (
              <p className="text-xs text-slate-400 text-center mt-2">
                {errorRows.length} row{errorRows.length > 1 ? 's' : ''} with errors will be skipped
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
