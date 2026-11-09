'use client';

/**
 * RoleSwitcherModal & UserRoleBadge
 *
 * Provides authorized role switching for users with multiple roles.
 * Strictly enforces that only authorized roles are displayed and selectable.
 */

import { useState } from 'react';
import {
  Shield, Users, Navigation, Check, X,
  ChevronDown, LogOut, User as UserIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { AppRole } from '@/types/database';
import { cn } from '@/lib/utils';

interface RoleMeta {
  role: AppRole;
  label: string;
  badgeLabel: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

const ROLE_METAS: Record<AppRole, RoleMeta> = {
  admin: {
    role: 'admin',
    label: 'Administrator',
    badgeLabel: 'Admin',
    description: 'Manage families, carol groups, routes, and settings.',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  team_member: {
    role: 'team_member',
    label: 'Carol Team Member',
    badgeLabel: 'Team Member',
    description: 'View today\'s route, song lyrics, and mark stops visited.',
    icon: Users,
    color: 'text-green-700 bg-green-50 border-green-200',
  },
  driver: {
    role: 'driver',
    label: 'Driver / Sharer',
    badgeLabel: 'Driver',
    description: 'Navigate to families and share live GPS location.',
    icon: Navigation,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
  },
};

export function RoleSwitcherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, activeRole, authorizedRoles, switchRole } = useAuth();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-switcher-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="carol-card w-full max-w-md p-6 bg-white shadow-xl rounded-3xl space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 id="role-switcher-title" className="text-lg font-bold text-slate-800">
              Switch Your Role
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose how you want to use the application
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Roles list */}
        <div className="space-y-3">
          {authorizedRoles.map(role => {
            const meta = ROLE_METAS[role];
            const isSelected = activeRole === role;
            const Icon = meta.icon;

            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  switchRole(role);
                  onClose();
                }}
                className={cn(
                  'w-full flex items-start gap-3.5 p-4 rounded-2xl border-2 text-left transition-all',
                  isSelected
                    ? 'border-green-600 bg-green-50/60 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                )}
                aria-pressed={isSelected}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 mt-0.5',
                    meta.color
                  )}
                >
                  <Icon size={20} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">{meta.label}</p>
                    {isSelected && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white flex-shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-full text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Compact role indicator badge button.
 * Clicking it opens the RoleSwitcherModal if multiple roles are available.
 */
export function UserRoleBadge() {
  const { user, activeRole, authorizedRoles } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  const currentMeta = ROLE_METAS[activeRole];
  const Icon = currentMeta.icon;
  const canSwitch = authorizedRoles.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canSwitch) setModalOpen(true);
        }}
        disabled={!canSwitch}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
          'bg-white/15 text-white border-white/20 hover:bg-white/25 backdrop-blur-sm',
          !canSwitch && 'cursor-default opacity-90'
        )}
        aria-label={`Current role: ${currentMeta.badgeLabel}.${canSwitch ? ' Tap to switch role.' : ''}`}
        title={canSwitch ? 'Tap to switch your active role' : `Active role: ${currentMeta.badgeLabel}`}
      >
        <Icon size={12} className="text-green-200" />
        <span>{currentMeta.badgeLabel}</span>
        {canSwitch && <ChevronDown size={12} className="text-green-200" />}
      </button>

      {canSwitch && (
        <RoleSwitcherModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

