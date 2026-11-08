'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Users, Car, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GroupDraft {
  name: string;
  vehicle_number: string;
}

export default function NewGroupPage() {
  const router = useRouter();
  const [form, setForm] = useState<GroupDraft>({ name: '', vehicle_number: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof GroupDraft) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Group name is required'); return; }
    setError('');
    setSaving(true);

    try {
      const { error: err } = await supabase.from('groups').insert({
        name:           form.name.trim(),
        vehicle_number: form.vehicle_number.trim() || null,
        is_active:      true,
        // leader_id is nullable — no auth yet
      });

      if (err) throw err;
      setSaved(true);
      setTimeout(() => router.push('/settings/groups'), 1200);
    } catch (err: unknown) {
      console.error('[Supabase] Group insert failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create group. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <p className="font-semibold text-slate-800">Group created!</p>
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/settings/groups" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-800">Create Group</h1>
            <p className="text-xs text-slate-400">New carol team group</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="carol-card p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Group Details</p>

            {/* Name */}
            <div>
              <label htmlFor="group-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Group Name <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none flex items-center">
                  <Users size={15} className="text-slate-400" />
                </span>
                <input
                  id="group-name"
                  type="text"
                  placeholder="e.g. Carol Team Alpha"
                  value={form.name}
                  onChange={set('name')}
                  className="carol-input !pl-9 py-3 text-sm"
                />
              </div>
            </div>

            {/* Vehicle number */}
            <div>
              <label htmlFor="vehicle-number" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Vehicle Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none flex items-center">
                  <Car size={15} className="text-slate-400" />
                </span>
                <input
                  id="vehicle-number"
                  type="text"
                  placeholder="e.g. TN 01 AB 1234"
                  value={form.vehicle_number}
                  onChange={set('vehicle_number')}
                  className="carol-input !pl-9 py-3 text-sm"
                />
              </div>
            </div>

            {/* Info note */}
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs text-blue-700">
                The group will be set as <strong>Active</strong> immediately. The tracking tab will redirect to this group&apos;s live view.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : '✅ Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}

