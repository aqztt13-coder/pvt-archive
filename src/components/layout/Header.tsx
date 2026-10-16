import React from 'react';
import {
  Download,
  Wifi,
  WifiOff,
  Languages,
  Shield,
  User,
  HardDrive,
  HelpCircle,
  Menu,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { translations } from '../../i18n/translations';
import type { Language, LocalUser, ActiveTab } from '../../types';

interface Props {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  currentUser: LocalUser | null;
  onOpenLogin: () => void;
  onOpenPWAInstall: () => void;
  onNavigate: (tab: ActiveTab) => void;
  storagePersisted: boolean;
  toggleSidebar: () => void;
}

export const Header: React.FC<Props> = ({
  lang,
  onLanguageChange,
  currentUser,
  onOpenLogin,
  onOpenPWAInstall,
  onNavigate,
  storagePersisted,
  toggleSidebar,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstalled } = usePWAInstall();
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur shadow-xs">
      {/* Left side: Menu toggle + Logo + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition md:hidden"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sky-400 shadow-md shadow-slate-900/10">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 md:text-base">
                {t.appName}
              </h1>
              <span className="hidden rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200/60 sm:inline-block">
                {t.appSubName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Reservoir Fluids Division</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-400">v1.0.0 Offline PWA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Status indicators, Actions, User */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Offline / Online Readiness Badge */}
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
          title={isOnline ? t.onlineStatus : t.offlineStatus}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          )}
          <span className="hidden sm:inline">
            {isOnline ? t.offlineReady : t.offlineStatus}
          </span>
        </div>

        {/* Storage Persistence Indicator */}
        <div
          onClick={() => onNavigate('settings')}
          className={`hidden lg:flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs cursor-pointer border ${
            storagePersisted
              ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
          title={storagePersisted ? t.storagePersisted : t.storageVolatile}
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-medium">
            {storagePersisted ? (lang === 'ar' ? 'تخزين دائم' : 'Storage Persisted') : (lang === 'ar' ? 'تخزين عادي' : 'Standard Storage')}
          </span>
        </div>

        {/* PWA Install Button (Always visible unless standalone, or clickable to show modal) */}
        <button
          onClick={onOpenPWAInstall}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t.actions.installPWA}</span>
          <span className="md:hidden">{lang === 'ar' ? 'تثبيت' : 'Install'}</span>
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => onLanguageChange(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          title="Switch Language / تبديل اللغة"
        >
          <Languages className="w-3.5 h-3.5 text-slate-500" />
          <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* User Account / Role Switcher */}
        <button
          onClick={onOpenLogin}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-[10px]">
            {currentUser ? currentUser.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block text-start leading-tight">
            <div className="font-semibold text-slate-900 truncate max-w-[110px]">
              {currentUser?.fullName.split(' ')[0] || 'User'}
            </div>
            <div className="text-[10px] text-slate-500">{currentUser?.role || 'Guest'}</div>
          </div>
        </button>

        {/* Help icon */}
        <button
          onClick={() => onNavigate('help')}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          title={t.nav.help}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
