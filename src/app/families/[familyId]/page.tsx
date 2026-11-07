'use client';

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, Phone, MessageSquare, Navigation, User, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Family } from '@/types/database';

interface Props {
  params: Promise<{ familyId: string }>;
}

function FamilyDetailContent({ params }: Props) {
  const { familyId } = use(params);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('families')
          .select('*, members:family_members(*)')
          .eq('id', familyId)
          .single();
        if (err) throw err;
        setFamily(data as Family);
      } catch {
        setError('Family not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [familyId]);

  if (loading) {
    return (
      <div className="page-container bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/families" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
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

  if (error || !family) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-slate-500 text-sm">{error || 'Family not found'}</p>
        <Link href="/families" className="text-green-700 font-semibold text-sm mt-3">← Back to Families</Link>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/families" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1">Family Details</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {/* Main info */}
        <div className="carol-card p-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-50 flex-shrink-0">
              <User size={22} className="text-green-700" />
            </span>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">{family.name}</h2>
              <p className="text-sm text-slate-400">{family.address}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {family.phone && (
              <a href={`tel:${family.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium">
                <Phone size={15} /> Call
              </a>
            )}
            {family.phone && (
              <a href={`https://wa.me/${family.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                <MessageSquare size={15} /> WhatsApp
              </a>
            )}
            {(family.latitude !== 0 || family.longitude !== 0) && (
              <a href={`https://maps.google.com/?q=${family.latitude},${family.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                <Navigation size={15} /> Directions
              </a>
            )}
          </div>
        </div>

        {/* Family Members */}
        {family.members && family.members.length > 0 && (
          <div className="carol-card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Family Members</p>
            <div className="space-y-3">
              {family.members.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-50 border border-slate-100">
                    <User size={15} className="text-slate-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      {member.name}
                      <span className="ml-1.5 text-xs text-slate-400 font-normal capitalize">
                        ({member.type}{member.age ? ` – ${member.age} years` : ''})
                      </span>
                    </p>
                    {member.phone && <p className="text-xs text-slate-400">{member.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        {(family.spouse || family.children || family.phone || family.notes) && (
          <div className="carol-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Additional Information</p>
            </div>
            <div className="space-y-2 text-sm">
              {family.spouse && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Spouse</span>
                  <span className="text-slate-700 font-medium">{family.spouse}</span>
                </div>
              )}
              {family.children && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Children</span>
                  <span className="text-slate-700 font-medium">{family.children}</span>
                </div>
              )}
              {family.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone</span>
                  <span className="text-slate-700 font-medium">{family.phone}</span>
                </div>
              )}
              {family.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-xs">Notes</span>
                  <p className="text-slate-700 text-sm mt-1">{family.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <Link href="/families" className="btn-outline w-full block text-center">← Back to Families</Link>
      </div>
    </div>
  );
}

export default function FamilyDetailPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
          <div className="skeleton w-full rounded-2xl h-14" />
          <div className="skeleton w-full rounded-2xl h-48" />
        </div>
      }
    >
      <FamilyDetailContent {...props} />
    </Suspense>
  );
}
