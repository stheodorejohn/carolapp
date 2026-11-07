'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Users, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Group {
  id: string;
  name: string;
  vehicle_number: string | null;
  is_active: boolean;
  created_at: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('groups')
      .select('id, name, vehicle_number, is_active, created_at')
      .order('created_at', { ascending: false });
    setGroups((data as Group[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('groups').update({ is_active: !current }).eq('id', id);
    load();
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Carol Groups</h1>
            <p className="text-xs text-slate-400">Manage your carol team groups</p>
          </div>
          <button onClick={load} className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <RefreshCw size={14} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
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

        {/* Groups list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <RefreshCw size={22} className="text-slate-300 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="carol-card p-8 text-center">
            <Users size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No groups yet</p>
            <p className="text-xs text-slate-400 mt-1">Tap &quot;Create New Group&quot; above to get started</p>
          </div>
        ) : (
          <div className="carol-card divide-y divide-slate-50">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-3 p-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${g.is_active ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <Users size={18} className={g.is_active ? 'text-green-700' : 'text-slate-400'} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {g.vehicle_number ? `🚗 ${g.vehicle_number}` : 'No vehicle'} · {g.is_active ? '🟢 Active' : '⚫ Inactive'}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(g.id, g.is_active)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    g.is_active
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {g.is_active
                    ? <><CheckCircle2 size={12} /> Active</>
                    : <><Circle size={12} /> Inactive</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

