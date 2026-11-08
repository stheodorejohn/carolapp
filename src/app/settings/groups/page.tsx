'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Plus, UsersRound, CheckCircle2, Circle, RefreshCw,
  Settings, MapPin, Search, Users, Trash2, AlertCircle,
  Bell, Shield, Info, LogOut, Wifi, Edit3, Save, X,
  Car, Link2, Loader2, Home, GripVertical,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Family } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string;
  name: string;
  vehicle_number: string | null;
  slug: string | null;
  is_active: boolean;
  created_at: string;
}

interface RouteRow {
  id: string;
  family_id: string;
  order_index: number;
  family?: { id: string; name: string; address: string };
}

interface FamilyPickerItem {
  id: string;
  name: string;
  address: string;
  phone: string | null;
}

type AdminTab = 'groups' | 'families' | 'settings';
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function sanitizeSlug(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('groups');

  const TAB_ITEMS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'groups', label: 'Groups', icon: <UsersRound size={15} /> },
    { id: 'families', label: 'Families', icon: <Users size={15} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
  ];

  return (
    <div className="page-container bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-0 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-slate-800 pb-3">Manage</h1>
        <div className="flex border-b border-slate-100">
          {TAB_ITEMS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors -mb-px ${tab === t.id
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {tab === 'groups' && <GroupsTab />}
        {tab === 'families' && <FamiliesTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Groups Tab ───────────────────────────────────────────────────────────────

function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDirty, setEditDirty] = useState(false);

  // Families-in-group state
  const [routeRows, setRouteRows] = useState<RouteRow[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [allFamilies, setAllFamilies] = useState<FamilyPickerItem[]>([]);
  const [familySearch, setFamilySearch] = useState('');
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);

  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editOrigRef = useRef<{ name: string; vehicle: string; slug: string } | null>(null);
  const savedRouteRowsRef = useRef<RouteRow[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverHalf, setDragOverHalf] = useState<'top' | 'bottom'>('top');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('groups')
      .select('id, name, vehicle_number, slug, is_active, created_at')
      .order('created_at', { ascending: false });
    setGroups((data as Group[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const editingGroup = groups.find(g => g.id === editingId) ?? null;

  // ── Open / close ──────────────────────────────────────────────────────────
  function openEdit(g: Group) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditVehicle(g.vehicle_number ?? '');
    setEditSlug(g.slug ?? '');
    setSlugStatus('idle');
    setEditDirty(false);
    editOrigRef.current = { name: g.name, vehicle: g.vehicle_number ?? '', slug: g.slug ?? '' };
    loadRoutes(g.id);
    loadAllFamilies();
    setFamilySearch('');
    setShowFamilyPicker(false);
  }

  function closeEdit() {
    setEditingId(null);
    setEditDirty(false);
    setSlugStatus('idle');
    setRouteRows([]);
    savedRouteRowsRef.current = [];
    setShowFamilyPicker(false);
    setFamilySearch('');
    if (slugTimer.current) clearTimeout(slugTimer.current);
  }

  async function loadRoutes(groupId: string) {
    setRoutesLoading(true);
    const { data } = await supabase
      .from('routes')
      .select('id, family_id, order_index, family:families(id, name, address)')
      .eq('group_id', groupId)
      .order('order_index', { ascending: true });
    const rows = (data as unknown as RouteRow[]) ?? [];
    setRouteRows(rows);
    savedRouteRowsRef.current = rows;
    setRoutesLoading(false);
  }

  async function loadAllFamilies() {
    const { data } = await supabase
      .from('families')
      .select('id, name, address, phone')
      .order('name', { ascending: true });
    setAllFamilies((data as FamilyPickerItem[]) ?? []);
  }

  // ── Family management (local-only until Save) ─────────────────────────────
  function addFamilyToGroup(family: FamilyPickerItem) {
    if (!editingId) return;
    if (routeRows.some(r => r.family_id === family.id)) return;
    const tempRow: RouteRow = {
      id: `temp-${family.id}`,
      family_id: family.id,
      order_index: routeRows.length,
      family: { id: family.id, name: family.name, address: family.address },
    };
    setRouteRows(r => [...r, tempRow]);
    setFamilySearch('');
    markEditDirty();
  }

  function removeFamilyFromGroup(routeId: string) {
    setRouteRows(r => r.filter(x => x.id !== routeId));
    markEditDirty();
  }

  // Cancel family changes — restore to DB snapshot, stay in panel
  function cancelFamilyChanges() {
    setRouteRows(savedRouteRowsRef.current);
    setShowFamilyPicker(false);
    setFamilySearch('');
    const orig = editOrigRef.current;
    const metaDirty = orig
      ? editName !== orig.name || editVehicle !== orig.vehicle || editSlug !== orig.slug
      : false;
    setEditDirty(metaDirty);
  }

  function markEditDirty() { setEditDirty(true); }

  // ── Slug validation ───────────────────────────────────────────────────────
  function handleSlugChange(raw: string) {
    const clean = sanitizeSlug(raw);
    setEditSlug(clean);
    markEditDirty();
    setSlugStatus('idle');
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!clean) return;
    if (clean.length < 2) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    slugTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('groups').select('id').eq('slug', clean).maybeSingle();
      if (!data) setSlugStatus('available');
      else if (data.id === editingId) setSlugStatus('available');
      else setSlugStatus('taken');
    }, 500);
  }

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    setDragOverIndex(index);
    setDragOverHalf(half);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null) { setDragOverIndex(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isBottomHalf = e.clientY >= rect.top + rect.height / 2;
    const insertSlot = isBottomHalf ? index + 1 : index;
    if (insertSlot === from || insertSlot === from + 1) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    const newRows = [...routeRows];
    const [moved] = newRows.splice(from, 1);
    const adjustedSlot = insertSlot > from ? insertSlot - 1 : insertSlot;
    newRows.splice(adjustedSlot, 0, moved);
    setRouteRows(newRows.map((r, i) => ({ ...r, order_index: i })));
    markEditDirty();
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveEdit(id: string) {
    if (slugStatus === 'taken' || slugStatus === 'invalid' || slugStatus === 'checking') return;
    setSavingEdit(true);

    await supabase.from('groups').update({
      name: editName.trim() || editOrigRef.current?.name,
      vehicle_number: editVehicle.trim() || null,
      slug: editSlug.trim() || null,
    }).eq('id', id);

    const savedIds = new Set(savedRouteRowsRef.current.map(r => r.family_id));
    const currentFamilyIds = new Set(routeRows.map(r => r.family_id));

    const toDelete = savedRouteRowsRef.current.filter(r => !currentFamilyIds.has(r.family_id));
    await Promise.all(toDelete.map(r => supabase.from('routes').delete().eq('id', r.id)));

    await Promise.all(
      routeRows.map((r, i) =>
        r.id.startsWith('temp-') && !savedIds.has(r.family_id)
          ? supabase.from('routes').insert({ group_id: id, family_id: r.family_id, order_index: i, status: 'pending' })
          : supabase.from('routes').update({ order_index: i }).eq('id', r.id)
      )
    );

    setSavingEdit(false);
    closeEdit();
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('groups').update({ is_active: !current }).eq('id', id);
    load();
  }

  async function deleteGroup(id: string) {
    setDeleting(id);
    await supabase.from('groups').delete().eq('id', id);
    setConfirmDelete(null);
    setDeleting(null);
    load();
  }

  const slugStatusUI: Record<SlugStatus, React.ReactNode> = {
    idle: <span className="text-slate-400">Lowercase letters, numbers, hyphens. e.g. <code className="bg-slate-100 px-1 rounded">a1</code></span>,
    checking: <span className="flex items-center gap-1 text-slate-400"><Loader2 size={11} className="animate-spin" /> Checking…</span>,
    available: <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> Available — link will be <code className="bg-green-50 px-1 rounded">/live/{editSlug}</code></span>,
    taken: <span className="flex items-center gap-1 text-red-500"><AlertCircle size={11} /> Already taken — choose another</span>,
    invalid: <span className="flex items-center gap-1 text-orange-500"><AlertCircle size={11} /> Min 2 characters (a–z, 0–9, hyphen)</span>,
  };

  // ── Shared edit panel content ─────────────────────────────────────────────
  const editPanelContent = editingGroup && (
    <div className="space-y-4">
      {/* Group name */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Group Name</label>
        <div className="relative flex items-center">
          <span className="absolute left-3 pointer-events-none flex items-center">
            <UsersRound size={14} className="text-slate-400" />
          </span>
          <input
            type="text"
            value={editName}
            onChange={e => { setEditName(e.target.value); markEditDirty(); }}
            className="carol-input !pl-9 py-2.5 text-sm"
            placeholder="Carol Team Alpha"
          />
        </div>
      </div>

      {/* Vehicle number */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Vehicle Number <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 pointer-events-none flex items-center">
            <Car size={14} className="text-slate-400" />
          </span>
          <input
            type="text"
            value={editVehicle}
            onChange={e => { setEditVehicle(e.target.value); markEditDirty(); }}
            className="carol-input !pl-9 py-2.5 text-sm"
            placeholder="TN 01 AB 1234"
          />
        </div>
      </div>

      {/* Share link / slug */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Share Link Text <span className="font-normal text-slate-400">(short URL slug)</span>
        </label>
        <div className="flex items-center">
          <span className="flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs text-slate-500 font-mono select-none whitespace-nowrap self-stretch">
            /live/
          </span>
          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3 pointer-events-none flex items-center">
              <Link2 size={13} className="text-slate-400" />
            </span>
            <input
              type="text"
              value={editSlug}
              onChange={e => handleSlugChange(e.target.value)}
              className="carol-input !pl-9 py-2.5 text-sm rounded-l-none border-l-0 font-mono w-full"
              placeholder="a1  or  team-alpha"
              maxLength={30}
            />
          </div>
        </div>
        <div className="mt-1.5 text-xs pl-1 min-h-[16px]">{slugStatusUI[slugStatus]}</div>
      </div>

      {/* Assigned Families */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned Families</p>
          <button
            type="button"
            onClick={() => { setShowFamilyPicker(p => !p); setFamilySearch(''); }}
            className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
          >
            <Plus size={13} /> Add Family
          </button>
        </div>

        {/* Family picker */}
        {showFamilyPicker && (
          <div className="mb-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="relative flex items-center border-b border-slate-100">
              <span className="absolute left-3 pointer-events-none flex items-center">
                <Search size={13} className="text-slate-400" />
              </span>
              <input
                type="search"
                placeholder="Search families…"
                value={familySearch}
                onChange={e => setFamilySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-transparent outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
              {(() => {
                const q = familySearch.toLowerCase();
                const filtered = allFamilies.filter(f =>
                  (f.name.toLowerCase().includes(q) || (f.address ?? '').toLowerCase().includes(q))
                  && !routeRows.some(r => r.family_id === f.id)
                );
                const visible = filtered.slice(0, 30);
                return (
                  <>
                    {visible.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => addFamilyToGroup(f)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-green-50 transition-colors"
                      >
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 flex-shrink-0">
                          {f.name[0]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{f.address}</p>
                        </div>
                        <Plus size={12} className="text-green-600 ml-auto flex-shrink-0" />
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">
                        {familySearch ? 'No matching families' : 'All families already assigned'}
                      </p>
                    )}
                    {filtered.length > 30 && (
                      <p className="text-[10px] text-slate-400 text-center py-2">
                        Showing 30 of {filtered.length} — type to narrow down
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Assigned list */}
        {routesLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="text-slate-300 animate-spin" />
          </div>
        ) : routeRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
            <Home size={16} className="text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">No families assigned yet</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-slate-400 mb-1 pl-1">
              {routeRows.length} {routeRows.length === 1 ? 'family' : 'families'} — drag <GripVertical size={10} className="inline" /> to reorder
            </p>
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-50 overflow-hidden max-h-64 overflow-y-auto">
              {routeRows.map((r, i) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={e => handleDragStart(e, i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={e => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${
                    dragOverIndex === i && dragOverHalf === 'top' ? 'border-t-2 border-green-400 bg-green-50' :
                    dragOverIndex === i && dragOverHalf === 'bottom' ? 'border-b-2 border-green-400 bg-green-50' : ''
                  } ${r.id.startsWith('temp-') ? 'bg-green-50/40' : ''}`}
                >
                  <span className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
                    <GripVertical size={14} />
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 w-4 text-center flex-shrink-0">{i + 1}</span>
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 flex-shrink-0">
                    {(r.family?.name ?? '?')[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{r.family?.name ?? r.family_id}</p>
                    <p className="text-[10px] text-slate-400 truncate">{r.family?.address ?? ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFamilyFromGroup(r.id)}
                    className="flex items-center justify-center w-6 h-6 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                    aria-label="Remove family"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => saveEdit(editingGroup.id)}
          disabled={!editDirty || savingEdit || slugStatus === 'taken' || slugStatus === 'invalid' || slugStatus === 'checking'}
          className="flex-1 flex items-center justify-center gap-1.5 bg-green-700 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Save size={13} /> {savingEdit ? 'Saving…' : 'Save Group Details'}
        </button>
        <button
          onClick={editDirty ? cancelFamilyChanges : closeEdit}
          className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
        >
          <X size={13} /> {editDirty ? 'Cancel' : 'Close'}
        </button>
      </div>
      <p className="text-[10px] text-slate-400 text-center">
        Family changes are saved when you click &quot;Save Group Details&quot;.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Create new */}
      <Link
        href="/settings/groups/new"
        className="flex items-center gap-3 p-4 carol-card border-2 border-dashed border-green-200 hover:border-green-400 transition-colors"
      >
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50">
          <Plus size={20} className="text-green-700" />
        </span>
        <div>
          <p className="text-sm font-semibold text-green-700">Create New Group</p>
          <p className="text-xs text-slate-400">Add a carol group for tracking</p>
        </div>
      </Link>

      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw size={22} className="text-slate-300 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="carol-card p-8 text-center">
          <UsersRound size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No groups yet</p>
          <p className="text-xs text-slate-400 mt-1">Tap &quot;Create New Group&quot; above to get started</p>
        </div>
      ) : (
        <div className="carol-card divide-y divide-slate-50">
          {groups.map(g => (
            <div key={g.id}>
              {/* View row — always visible */}
              <div className="flex items-center gap-3 p-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${g.is_active ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <UsersRound size={18} className={g.is_active ? 'text-green-700' : 'text-slate-400'} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    {g.vehicle_number ? `🚗 ${g.vehicle_number}` : 'No vehicle'}
                    {g.slug && (
                      <span className="text-green-700 font-mono bg-green-50 px-1.5 py-0.5 rounded text-[10px]">
                        /live/{g.slug}
                      </span>
                    )}
                  </p>
                </div>
                {g.is_active && (
                  <Link href={`/tracking/${g.id}`} className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 flex-shrink-0" aria-label="Track">
                    <MapPin size={14} className="text-green-700" />
                  </Link>
                )}
                <button
                  onClick={() => toggleActive(g.id, g.is_active)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors flex-shrink-0 ${g.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {g.is_active ? <><CheckCircle2 size={11} /> Active</> : <><Circle size={11} /> Off</>}
                </button>
                <button
                  onClick={() => openEdit(g)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors flex-shrink-0"
                  aria-label="Edit group"
                >
                  <Edit3 size={14} className="text-blue-600" />
                </button>
                <button
                  onClick={() => setConfirmDelete(g.id)}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                  aria-label="Delete group"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Confirm delete */}
              {confirmDelete === g.id && (
                <div className="mx-4 mb-3 rounded-xl bg-red-50 border border-red-100 p-3 flex items-center gap-3">
                  <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600 flex-1">Delete &quot;{g.name}&quot;? This cannot be undone.</p>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-500 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100">Cancel</button>
                  <button
                    onClick={() => deleteGroup(g.id)}
                    disabled={deleting === g.id}
                    className="text-xs text-white bg-red-500 font-semibold px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-60"
                  >
                    {deleting === g.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom Drawer (mobile/tablet) / Centered Modal (desktop) ── */}
      {editingId && editingGroup && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={closeEdit}
          />

          {/* Panel — full-width rounded-top sheet on mobile, card on desktop */}
          <div className="relative w-full md:max-w-lg md:mx-4 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Mobile drag pill */}
            <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-800">Edit Group</p>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">{editingGroup.name}</p>
              </div>
              <button
                onClick={closeEdit}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {editPanelContent}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Families Tab ─────────────────────────────────────────────────────────────

function FamiliesTab() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [filtered, setFiltered] = useState<Family[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('families')
      .select('*, members:family_members(*)')
      .order('name', { ascending: true });
    setFamilies((data ?? []) as Family[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? families.filter(f =>
          f.name.toLowerCase().includes(q) ||
          f.address?.toLowerCase().includes(q) ||
          f.phone?.toLowerCase().includes(q)
        )
        : families
    );
  }, [search, families]);

  async function deleteFamily(id: string) {
    setDeleting(id);
    await supabase.from('families').delete().eq('id', id);
    setConfirmDelete(null);
    setDeleting(null);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 flex items-center">
          <span className="absolute left-3 pointer-events-none flex items-center">
            <Search size={14} className="text-slate-400" />
          </span>
          <input
            type="search"
            placeholder="Search families…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="carol-input !pl-9 py-2.5 text-sm"
          />
        </div>
        <Link
          href="/families/new"
          className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl flex-shrink-0"
        >
          <Plus size={14} /> Add
        </Link>
      </div>

      <p className="text-xs text-slate-400">
        {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'family' : 'families'}${search ? ' found' : ' total'}`}
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="carol-card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="carol-card p-8 text-center">
          <p className="text-2xl mb-2">🏠</p>
          <p className="text-sm font-medium text-slate-500">{search ? 'No families found' : 'No families yet'}</p>
          <p className="text-xs text-slate-400 mt-1">{search ? 'Try a different search' : 'Tap "Add" above to get started'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id}>
              <div className="carol-card p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-slate-600">{f.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{f.address}</p>
                </div>
                <Link
                  href={`/families/${f.id}`}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors flex-shrink-0"
                  aria-label="Edit family"
                >
                  <Edit3 size={14} className="text-blue-600" />
                </Link>
                <button
                  onClick={() => setConfirmDelete(f.id)}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                  aria-label="Delete family"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {confirmDelete === f.id && (
                <div className="mt-1 rounded-xl bg-red-50 border border-red-100 p-3 flex items-center gap-3">
                  <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600 flex-1">Delete &quot;{f.name}&quot;? This cannot be undone.</p>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-500 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100">Cancel</button>
                  <button
                    onClick={() => deleteFamily(f.id)}
                    disabled={deleting === f.id}
                    className="text-xs text-white bg-red-500 font-semibold px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-60"
                  >
                    {deleting === f.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="space-y-4">
      <div className="carol-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-700 text-white text-lg font-bold">A</span>
          <div>
            <p className="font-semibold text-slate-800">Admin User</p>
            <p className="text-sm text-slate-400">admin@letscarol.app</p>
          </div>
          <span className="ml-auto text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold">Admin</span>
        </div>
      </div>

      <SG title="Preferences">
        <SI icon={<Bell size={16} className="text-blue-600" />} iconBg="bg-blue-50" label="Notifications" sub="Push notification settings" />
        <SI icon={<Wifi size={16} className="text-green-600" />} iconBg="bg-green-50" label="Location Sharing" sub="Auto-share duration and interval" />
      </SG>
      <SG title="Security">
        <SI icon={<Shield size={16} className="text-purple-600" />} iconBg="bg-purple-50" label="Privacy & Security" sub="Manage access and permissions" />
      </SG>
      <SG title="About">
        <SI icon={<Info size={16} className="text-slate-500" />} iconBg="bg-slate-50" label="App Version" sub="v1.0.0 – Let's Carol" chevron={false} />
      </SG>

      <Link href="/login" className="carol-card flex items-center gap-4 p-4 block text-red-500">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
          <LogOut size={18} className="text-red-500" />
        </span>
        <span className="font-semibold text-sm">Log Out</span>
      </Link>
    </div>
  );
}

function SG({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="carol-card divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function SI({ icon, iconBg, label, sub, chevron = true }: {
  icon: React.ReactNode; iconBg: string; label: string; sub?: string; chevron?: boolean;
}) {
  return (
    <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors">
      <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${iconBg}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      {chevron && <span className="text-slate-300">›</span>}
    </button>
  );
}
