import React from 'react';
import {
  LayoutDashboard,
  TableProperties,
  MapPin,
  Layers,
  Component,
  GitCommit,
  FlaskConical,
  Activity,
  FileArchive,
  FileSpreadsheet,
  ArchiveRestore,
  Users,
  ScrollText,
  Settings,
  HelpCircle,
  HardDrive,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { translations } from '../../i18n/translations';
import type { ActiveTab, Language, LocalUser } from '../../types';

interface Props {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  lang: Language;
  currentUser: LocalUser | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  storageUsagePercent: number;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onNavigate,
  lang,
  currentUser,
  collapsed,
  onToggleCollapse,
  storageUsagePercent,
}) => {
  const t = translations[lang];

  const menuItems = [
    { id: 'dashboard' as ActiveTab, label: t.nav.dashboard, icon: LayoutDashboard, section: 'core' },
    { id: 'pvt-index' as ActiveTab, label: t.nav.pvtIndex, icon: TableProperties, section: 'core' },
    
    // Geological & Field Assets
    { id: 'fields' as ActiveTab, label: t.nav.fields, icon: MapPin, section: 'assets' },
    { id: 'reservoirs' as ActiveTab, label: t.nav.reservoirs, icon: Layers, section: 'assets' },
    { id: 'formations' as ActiveTab, label: t.nav.formations, icon: Component, section: 'assets' },
    { id: 'wells' as ActiveTab, label: t.nav.wells, icon: GitCommit, section: 'assets' },

    // Laboratory Data & Archive
    { id: 'samples' as ActiveTab, label: t.nav.samples, icon: FlaskConical, section: 'lab' },
    { id: 'analyses' as ActiveTab, label: t.nav.analyses, icon: Activity, section: 'lab' },
    { id: 'reports' as ActiveTab, label: t.nav.reports, icon: FileArchive, section: 'lab' },

    // Operations & Administration
    { id: 'import-export' as ActiveTab, label: t.nav.importExport, icon: FileSpreadsheet, section: 'ops' },
    { id: 'backup-restore' as ActiveTab, label: t.nav.backupRestore, icon: ArchiveRestore, section: 'ops' },
    { id: 'users' as ActiveTab, label: t.nav.users, icon: Users, section: 'admin' },
    { id: 'audit-log' as ActiveTab, label: t.nav.auditLog, icon: ScrollText, section: 'admin' },
    { id: 'settings' as ActiveTab, label: t.nav.settings, icon: Settings, section: 'system' },
    { id: 'help' as ActiveTab, label: t.nav.help, icon: HelpCircle, section: 'system' },
  ];

  return (
    <aside
      className={`relative flex flex-col border-e border-slate-200 bg-slate-900 text-slate-300 transition-all duration-300 shrink-0 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Sidebar Header Title */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              {lang === 'ar' ? 'أقسام النظام المركزي' : 'Division Navigation'}
            </span>
          </div>
        ) : (
          <div className="mx-auto h-2 w-2 rounded-full bg-sky-400" />
        )}
        <button
          onClick={onToggleCollapse}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {lang === 'ar' ? (
            collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer / Storage Bar */}
      {!collapsed && (
        <div className="border-t border-slate-800 p-4 space-y-2 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              {lang === 'ar' ? 'مساحة IndexedDB' : 'Local Storage'}
            </span>
            <span className="font-mono text-slate-300">{storageUsagePercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                storageUsagePercent > 80 ? 'bg-rose-500' : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, storageUsagePercent))}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {lang === 'ar' ? 'التخزين محلي 100% دون خوادم' : 'Strictly offline browser db'}
          </p>
        </div>
      )}
    </aside>
  );
};
