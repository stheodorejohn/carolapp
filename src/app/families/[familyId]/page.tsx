'use client';

import {
  useEffect, useState, use, Suspense, useRef,
  type ChangeEvent, type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Phone, MessageSquare, Navigation, User,
  MapPin, StickyNote, CheckCircle2, AlertCircle,
  Plus, Trash2, Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Family } from '@/types/database';

interface Props { params: Promise<{ familyId: string }> }

interface MemberDraft {
  id: string;
  isNew?: boolean;
  name: string;
  type: 'adult' | 'child';
  age: string;
  phone: string;
  _deleted?: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  try {
    const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
    const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
    const qr = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qr) return { lat: parseFloat(qr[1]), lng: parseFloat(qr[2]) };
    const ll = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };
  } catch { /* ignore */ }
  return null;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function FamilyEditContent({ params }: Props) {
  const router = useRouter();
  const { familyId } = use(params);

  const originalRef = useRef<{
    name: string; address: string; phone: string; spouse: string;
    children: string; notes: string; latitude: string; longitude: string;
    members: MemberDraft[];
  } | null>(null);

  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [spouse, setSpouse] = useState('');
  const [children, setChildren] = useState('');
  const [notes, setNotes] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationParsed, setLocationParsed] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('families')
          .select('*, members:family_members(*)')
          .eq('id', familyId)
          .single();
        if (err) throw err;
        const f = data as Family;
        setFamily(f);
        const initMembers = (f.members ?? []).map(m => ({
          id: m.id,
          name: m.name,
          type: m.type as 'adult' | 'child',
          age: m.age != null ? String(m.age) : '',
          phone: m.phone ?? '',
        }));
        const lat = f.latitude ? String(f.latitude) : '';
        const lng = f.longitude ? String(f.longitude) : '';
        setName(f.name ?? '');
        setAddress(f.address ?? '');
        setPhone(f.phone ?? '');
        setSpouse(f.spouse ?? '');
        setChildren(f.children ?? '');
        setNotes(f.notes ?? '');
        setLatitude(lat);
        setLongitude(lng);
        setMembers(initMembers);
        // Store originals for dirty-checking
        originalRef.current = {
          name: f.name ?? '', address: f.address ?? '',
          phone: f.phone ?? '', spouse: f.spouse ?? '',
          children: f.children ?? '', notes: f.notes ?? '',
          latitude: lat, longitude: lng,
          members: initMembers.map(m => ({ ...m })),
        };
      } catch {
        setFetchError('Family not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [familyId]);

  // ── Dirty check ────────────────────────────────────────────────────────────
  function markDirty() { setIsDirty(true); }

  function wrap<T extends string>(setter: (v: T) => void) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(e.target.value as T);
      markDirty();
    };
  }

  // Phone: allow only digits, +, -, spaces
  function handlePhone(e: ChangeEvent<HTMLInputElement>) {
    setPhone(e.target.value.replace(/[^0-9+\- ]/g, ''));
    markDirty();
  }

  function phoneWarnMsg(val: string): string {
    const digits = val.replace(/\D/g, '').length;
    if (digits > 15) return 'Number seems too long — please double-check.';
    if (digits > 10) return 'More than 10 digits. If this is a landline, include STD code (e.g. 044-XXXXXXXX).';
    return '';
  }

  // ── Maps link parser ───────────────────────────────────────────────────────
  function handleMapsLink(e: ChangeEvent<HTMLInputElement>) {
    const url = e.target.value;
    setMapsLink(url);
    setLocationError('');
    setLocationParsed(null);
    markDirty();
    if (!url.trim()) return;
    // Short links — accept them, but can't auto-parse coords
    if (url.includes('goo.gl') || url.includes('maps.app')) {
      setLocationError("Short link saved ✓ — coordinates can't be auto-read. Enter lat/lng manually below if needed.");
      return;
    }
    const coords = parseGoogleMapsUrl(url);
    if (coords) {
      setLocationParsed(coords);
      setLatitude(coords.lat.toString());
      setLongitude(coords.lng.toString());
    } else {
      setLocationError('Could not read coordinates from this URL.');
    }
  }

  // ── Members ────────────────────────────────────────────────────────────────
  function addMember() {
    setMembers(m => [...m, { id: uid(), isNew: true, name: '', type: 'adult', age: '', phone: '' }]);
    markDirty();
  }
  function updateMember(id: string, k: keyof MemberDraft, v: string) {
    setMembers(m => m.map(x => x.id === id ? { ...x, [k]: v } : x));
    markDirty();
  }
  function markDelete(id: string) {
    setMembers(m => m.map(x => x.id === id ? { ...x, _deleted: true } : x));
    markDirty();
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Family name is required';
    if (!address.trim()) errs.address = 'Address is required';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaveError('');
    setSaving(true);
    try {
      const lat = locationParsed?.lat ?? (latitude ? parseFloat(latitude) : 0);
      const lng = locationParsed?.lng ?? (longitude ? parseFloat(longitude) : 0);

      const { error: updateErr } = await supabase.from('families').update({
        name: name.trim(), address: address.trim(),
        phone: phone.trim() || null, spouse: spouse.trim() || null,
        children: children.trim() || null, notes: notes.trim() || null,
        latitude: lat, longitude: lng,
      }).eq('id', familyId);
      if (updateErr) throw updateErr;

      const toDelete = members.filter(m => !m.isNew && m._deleted).map(m => m.id);
      if (toDelete.length > 0)
        await supabase.from('family_members').delete().in('id', toDelete);

      for (const m of members.filter(m => !m._deleted && m.name.trim())) {
        const row = {
          name: m.name.trim(), type: m.type,
          age: m.type === 'child' && m.age ? parseInt(m.age) : null,
          phone: m.phone.trim() || null,
        };
        if (m.isNew) await supabase.from('family_members').insert({ family_id: familyId, ...row });
        else await supabase.from('family_members').update(row).eq('id', m.id);
      }

      setSaved(true);
      setTimeout(() => router.push('/settings/groups'), 1200);
    } catch (err) {
      console.error('[Supabase] Family update failed:', err);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-container bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/settings/groups" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          {
            [1, 2, 3].map(i => (
              <div key={i} className="carol-card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  if (fetchError || !family) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-slate-500 text-sm">{fetchError || 'Family not found'}</p>
        <Link href="/settings/groups" className="text-green-700 font-semibold text-sm mt-3">← Back</Link>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <p className="font-semibold text-slate-800">Changes saved!</p>
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  const hasLocation = family.latitude !== 0 || family.longitude !== 0;
  const visibleMembers = members.filter(m => !m._deleted);

  // ── Edit form (always open) ────────────────────────────────────────────────
  return (
    <div className="page-container bg-slate-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/settings/groups" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1 truncate">Edit Family</h1>

          {/* Quick-action buttons in view strip */}
          <div className="flex gap-1.5 mr-1">
            {family.phone && (
              <a href={`tel:${family.phone}`} className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100" aria-label="Call">
                <Phone size={14} className="text-slate-500" />
              </a>
            )}
            {family.phone && (
              <a href={`https://wa.me/${family.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50" aria-label="WhatsApp">
                <MessageSquare size={14} className="text-green-600" />
              </a>
            )}
            {hasLocation && (
              <a href={`https://maps.google.com/?q=${family.latitude},${family.longitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50" aria-label="Directions">
                <Navigation size={14} className="text-blue-600" />
              </a>
            )}
          </div>

          {/* Save button — enabled only when dirty */}
          <button
            form="edit-family-form"
            type="submit"
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <form id="edit-family-form" onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-4">

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{saveError}</p>
          </div>
        )}

        {/* Family Details */}
        <div className="carol-card p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Family Details</p>

          <EF label="Family Name" required error={fieldErrors.name} icon={<User size={15} className="text-slate-400" />}>
            <input type="text" placeholder="e.g. Abraham Family" value={name} onChange={wrap(setName)} className="carol-input !pl-9 py-3 text-sm" />
          </EF>

          <EF label="Address" required error={fieldErrors.address} multiline icon={<MapPin size={15} className="text-slate-400" />}>
            <textarea placeholder="e.g. 12, Church Road, Chennai – 600 010" value={address} onChange={wrap(setAddress)} rows={2} className="carol-input !pl-9 py-3 text-sm resize-none" />
          </EF>

          <EF label="Phone" icon={<Phone size={15} className="text-slate-400" />} warn={phoneWarnMsg(phone)}>
            <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={handlePhone} className="carol-input !pl-9 py-3 text-sm" inputMode="tel" />
          </EF>

          <EF label="Spouse Name" icon={<User size={15} className="text-slate-400" />}>
            <input type="text" placeholder="Optional" value={spouse} onChange={wrap(setSpouse)} className="carol-input !pl-9 py-3 text-sm" />
          </EF>

          <EF label="Children" icon={<User size={15} className="text-slate-400" />}>
            <input type="text" placeholder="e.g. Anna (8), Daniel (6)" value={children} onChange={wrap(setChildren)} className="carol-input !pl-9 py-3 text-sm" />
          </EF>

          <EF label="Notes" multiline icon={<StickyNote size={15} className="text-slate-400" />}>
            <textarea placeholder="Any special notes…" value={notes} onChange={wrap(setNotes)} rows={2} className="carol-input !pl-9 py-3 text-sm resize-none" />
          </EF>
        </div>

        {/* Location */}
        <div className="carol-card p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Google Maps Link <span className="text-slate-400 font-normal">(paste to auto-fill)</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none"><MapPin size={15} className="text-slate-400" /></div>
              <input type="url" placeholder="https://maps.app.goo.gl/... or full Google Maps URL" value={mapsLink} onChange={handleMapsLink} className="carol-input !pl-9 py-3 text-sm" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Paste a Google Maps link — full URL or short link (maps.app.goo.gl). Full URLs auto-fill coordinates.</p>
            {locationError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> {locationError}</p>}
            {locationParsed && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <MapPin size={12} className="flex-shrink-0" />
                Detected: <strong>{locationParsed.lat.toFixed(6)}, {locationParsed.lng.toFixed(6)}</strong>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Latitude</label>
              <input type="number" step="any" placeholder="13.0827" value={latitude} onChange={e => { setLatitude(e.target.value); setLocationParsed(null); markDirty(); }} className="carol-input py-3 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Longitude</label>
              <input type="number" step="any" placeholder="80.2707" value={longitude} onChange={e => { setLongitude(e.target.value); setLocationParsed(null); markDirty(); }} className="carol-input py-3 text-sm" />
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="carol-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Members</p>
            <button type="button" onClick={addMember} className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800">
              <Plus size={13} /> Add Member
            </button>
          </div>
          {visibleMembers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-3">No members — tap &quot;Add Member&quot; above</p>
          )}
          {visibleMembers.map((m, i) => (
            <div key={m.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Member {i + 1}</span>
                <button type="button" onClick={() => markDelete(m.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <input type="text" placeholder="Full name" value={m.name} onChange={e => updateMember(m.id, 'name', e.target.value)} className="carol-input py-2.5 text-sm" />
              <div className="flex items-center gap-2">
                {(['adult', 'child'] as const).map(type => (
                  <label
                    key={type}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors select-none ${m.type === type
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    <input
                      type="radio"
                      name={`member-type-${m.id}`}
                      value={type}
                      checked={m.type === type}
                      onChange={() => { updateMember(m.id, 'type', type); }}
                      className="sr-only"
                    />
                    <span>{type === 'adult' ? '🧑' : '👶'}</span>
                    <span>{type === 'adult' ? 'Adult' : 'Child'}</span>
                  </label>
                ))}
                {m.type === 'child' && (
                  <input type="number" placeholder="Age" value={m.age} onChange={e => updateMember(m.id, 'age', e.target.value)} className="carol-input py-2 text-sm w-20" min={0} max={17} />
                )}
              </div>
              <div>
                <input type="tel" placeholder="Phone (optional)" value={m.phone} onChange={e => updateMember(m.id, 'phone', e.target.value.replace(/[^0-9+\- ]/g, ''))} className="carol-input py-2.5 text-sm" inputMode="tel" />
                {phoneWarnMsg(m.phone) && (
                  <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {phoneWarnMsg(m.phone)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom save (convenience) */}
        <button
          type="submit"
          disabled={!isDirty || saving}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : isDirty ? '✅ Save Changes' : '✅ No Changes'}
        </button>
      </form>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function EF({ label, required, icon, error, warn, multiline, children }: {
  label: string; required?: boolean; icon?: React.ReactNode;
  error?: string; warn?: string; multiline?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <span className={`absolute left-3 pointer-events-none flex items-center ${multiline ? 'self-start mt-3' : ''}`}>
            {icon}
          </span>
        )}
        {children}
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> {error}</p>}
      {!error && warn && <p className="text-xs text-orange-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> {warn}</p>}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function FamilyDetailPage(props: Props) {
  return (
    <Suspense fallback={
      <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
        <div className="skeleton w-full rounded-2xl h-14" />
        <div className="skeleton w-full rounded-2xl h-48" />
      </div>
    }>
      <FamilyEditContent {...props} />
    </Suspense>
  );
}
