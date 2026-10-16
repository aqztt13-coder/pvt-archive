/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  db,
  seedInitialDatabaseIfEmpty,
  checkStoragePersistence,
} from './db/pvtDb';
import { getCurrentUser } from './services/authService';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { PWAInstallModal } from './components/common/PWAInstallModal';
import { LoginModal } from './components/common/LoginModal';
import { GlobalNotificationContainer } from './components/common/GlobalNotificationContainer';
import { DashboardView } from './components/views/DashboardView';
import { PVTIndexView } from './components/views/PVTIndexView';
import { HierarchyManagementView } from './components/views/HierarchyManagementView';
import { SamplesView } from './components/views/SamplesView';
import { AnalysisRecordsView } from './components/views/AnalysisRecordsView';
import { ReportsArchiveView } from './components/views/ReportsArchiveView';
import { ImportExportView } from './components/views/ImportExportView';
import { BackupRestoreView } from './components/views/BackupRestoreView';
import { UserManagementView } from './components/views/UserManagementView';
import { AuditLogView } from './components/views/AuditLogView';
import { SettingsView } from './components/views/SettingsView';
import { HelpView } from './components/views/HelpView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { ActiveTab, Language, LocalUser } from './types';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpen] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [storageUsagePercent, setStorageUsagePercent] = useState(0);

  // Cross-view selection targets
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const isOnline = useOnlineStatus();

  // Initialization
  useEffect(() => {
    async function init() {
      // 1. Seed default petroleum data if empty
      await seedInitialDatabaseIfEmpty();

      // 2. Fetch current user
      const user = await getCurrentUser();
      setCurrentUser(user);

      // 3. Storage persistence check
      const st = await checkStoragePersistence();
      setStoragePersisted(st.persisted);
      setStorageUsagePercent(st.usagePercent || 0);

      // 4. Retrieve saved language preference if any
      const langSetting = await db.appSettings.get('language');
      if (langSetting && (langSetting.value === 'ar' || langSetting.value === 'en')) {
        setLang(langSetting.value);
      }
    }

    init();
  }, []);

  // Update document dir & lang attribute when language changes
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const handleLanguageChange = async (newLang: Language) => {
    setLang(newLang);
    await db.appSettings.put({ key: 'language', value: newLang });
  };

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSampleDetail = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setActiveTab('samples');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setActiveTab('reports');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        lang={lang}
        currentUser={currentUser}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        storageUsagePercent={storageUsagePercent}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header Bar */}
        <Header
          lang={lang}
          onLanguageChange={handleLanguageChange}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onOpenPWAInstall={() => setIsPWAInstallModalOpen(true)}
          onNavigate={handleNavigate}
          storagePersisted={storagePersisted}
          toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Dynamic View Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50/70">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'dashboard' && (
              <DashboardView
                lang={lang}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onSelectSampleDetail={handleSelectSampleDetail}
              />
            )}

            {activeTab === 'pvt-index' && (
              <PVTIndexView
                lang={lang}
                onSelectSampleDetail={handleSelectSampleDetail}
                onSelectAnalysisDetail={() => setActiveTab('analyses')}
              />
            )}

            {(activeTab === 'fields' ||
              activeTab === 'reservoirs' ||
              activeTab === 'formations' ||
              activeTab === 'wells') && (
              <HierarchyManagementView
                lang={lang}
                currentUser={currentUser}
                defaultTab={activeTab}
              />
            )}

            {activeTab === 'samples' && (
              <SamplesView
                lang={lang}
                currentUser={currentUser}
                selectedSampleIdForDetail={selectedSampleId}
                onClearSelectedDetail={() => setSelectedSampleId(null)}
                onOpenReport={handleOpenReport}
              />
            )}

            {activeTab === 'analyses' && (
              <AnalysisRecordsView lang={lang} currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <ReportsArchiveView
                lang={lang}
                currentUser={currentUser}
                targetReportId={selectedReportId}
              />
            )}

            {activeTab === 'import-export' && (
              <ImportExportView lang={lang} currentUser={currentUser} />
            )}

            {activeTab === 'backup-restore' && (
              <BackupRestoreView lang={lang} currentUser={currentUser} />
            )}

            {activeTab === 'users' && (
              <UserManagementView lang={lang} currentUser={currentUser} />
            )}

            {activeTab === 'audit-log' && <AuditLogView lang={lang} />}

            {activeTab === 'settings' && (
              <SettingsView
                lang={lang}
                onLanguageChange={handleLanguageChange}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'help' && (
              <HelpView
                lang={lang}
                onOpenPWAInstall={() => setIsPWAInstallModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* PWA Windows Desktop Install Guide Modal */}
      <PWAInstallModal
        isOpen={isPWAInstallModalOpen}
        onClose={() => setIsPWAInstallModalOpen(false)}
        lang={lang}
      />

      {/* Local User Switching & Auth Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={user => setCurrentUser(user)}
        lang={lang}
      />

      {/* Offline Toast Banner (shown when true offline occurs) */}
      {!isOnline && (
        <div className="fixed bottom-4 end-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl border border-slate-700 animate-slide-up">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {lang === 'ar'
              ? 'وضع العمل دون إنترنت — يتم حفظ والبحث في البيانات المحلية بنجاح.'
              : 'Offline Mode Active — Running 100% on local IndexedDB storage.'}
          </span>
        </div>
      )}

      {/* Global In-App Notifications and Confirmations */}
      <GlobalNotificationContainer lang={lang} />
    </div>
  );
}
