import { Settings, Bell, Shield, Wifi, Info, ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="page-container bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your carol team preferences</p>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Profile */}
        <div className="carol-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-700 text-white text-lg font-bold">
              A
            </span>
            <div>
              <p className="font-semibold text-slate-800">Admin User</p>
              <p className="text-sm text-slate-400">admin@letscarol.app</p>
            </div>
            <span className="ml-auto text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold">
              Admin
            </span>
          </div>
        </div>

        {/* Settings groups */}
        <SettingsGroup title="Preferences">
          <SettingsItem icon={<Bell size={16} className="text-blue-600" />} iconBg="bg-blue-50" label="Notifications" sub="Push notification settings" />
          <SettingsItem icon={<Wifi size={16} className="text-green-600" />} iconBg="bg-green-50" label="Location Sharing" sub="Auto-share duration and interval" />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingsItem icon={<Shield size={16} className="text-purple-600" />} iconBg="bg-purple-50" label="Privacy & Security" sub="Manage access and permissions" />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingsItem icon={<Info size={16} className="text-slate-500" />} iconBg="bg-slate-50" label="App Version" sub="v1.0.0 – Let's Carol" chevron={false} />
        </SettingsGroup>

        {/* Logout */}
        <Link
          href="/login"
          id="logout-btn"
          className="carol-card flex items-center gap-4 p-4 block text-red-500"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
            <LogOut size={18} className="text-red-500" />
          </span>
          <span className="font-semibold text-sm">Log Out</span>
        </Link>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="carol-card divide-y divide-slate-50">
        {children}
      </div>
    </div>
  );
}

function SettingsItem({
  icon, iconBg, label, sub, chevron = true,
}: { icon: React.ReactNode; iconBg: string; label: string; sub?: string; chevron?: boolean }) {
  return (
    <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors">
      <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${iconBg}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      {chevron && <ChevronRight size={15} className="text-slate-300" />}
    </button>
  );
}
