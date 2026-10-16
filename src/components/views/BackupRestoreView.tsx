import React, { useState, useEffect } from 'react';
import {
  ArchiveRestore,
  Download,
  Upload,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HardDrive,
  FileCheck,
  Clock,
  Key,
} from 'lucide-react';
import {
  createFullBackup,
  inspectBackupFile,
  restoreBackup,
  type BackupManifest,
} from '../../services/backupService';
import { checkStoragePersistence, requestStoragePersistence } from '../../db/pvtDb';
import { canAdminister } from '../../services/authService';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  requestConfirm,
} from '../../services/notificationService';
import { translations } from '../../i18n/translations';
import type { Language, LocalUser } from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
}

export const BackupRestoreView: React.FC<Props> = ({ lang, currentUser }) => {
  const t = translations[lang];

  // Backup state
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [manifestPreview, setManifestPreview] = useState<BackupManifest | null>(null);
  const [zipRef, setZipRef] = useState<any>(null);
  const [inspecting, setInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Storage info
  const [storageData, setStorageData] = useState<{
    persisted: boolean;
    quotaMb: number;
    usageMb: number;
    usagePercent: number;
  }>({ persisted: false, quotaMb: 0, usageMb: 0, usagePercent: 0 });

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    const st = await checkStoragePersistence();
    setStorageData({
      persisted: st.persisted,
      quotaMb: st.quota ? Math.round(st.quota / (1024 * 1024)) : 0,
      usageMb: st.usage ? Math.round((st.usage / (1024 * 1024)) * 10) / 10 : 0,
      usagePercent: st.usagePercent || 0,
    });
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setStatusMsg(null);
    try {
      const pwd = encryptBackup ? backupPassword : undefined;
      const { blob, filename } = await createFullBackup(pwd);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: 'success',
        text:
          lang === 'ar'
            ? `تم إنشاء حزمة النسخة الاحتياطية (${filename}) وتنزيلها بنجاح.`
            : `Backup package (${filename}) created and downloaded successfully.`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Backup creation failed: ' + err.message });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileSelectForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setRestoreFile(f);
      setManifestPreview(null);
      setZipRef(null);
      setRestoreConfirmed(false);
      setStatusMsg(null);

      // If it looks like a standard zip, inspect immediately
      if (f.name.endsWith('.zip')) {
        inspectFile(f, '');
      }
    }
  };

  const inspectFile = async (f: File, pwd?: string) => {
    setInspecting(true);
    setStatusMsg(null);
    try {
      const { manifest, zip } = await inspectBackupFile(f, pwd);
      setManifestPreview(manifest);
      setZipRef(zip);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setInspecting(false);
    }
  };

  const handleExecuteRestore = () => {
    if (!canAdminister(currentUser)) {
      notifyError(
        lang === 'ar' ? 'فقط مدير النظام يملك صلاحية استعادة النسخ الاحتياطية.' : 'Only administrators can restore backups.'
      );
      return;
    }
    if (!zipRef) return;

    requestConfirm({
      title: lang === 'ar' ? 'تأكيد استعادة النسخة الاحتياطية' : 'Confirm Backup Restore',
      message:
        lang === 'ar'
          ? 'تنبيه: ستؤدي عملية الاستعادة إلى استبدال البيانات الحالية بالبيانات والملفات الموجودة داخل النسخة الاحتياطية. هل ترغب في المتابعة؟'
          : 'Warning: Restoring will overwrite existing records with data and files from the backup archive. Do you want to proceed?',
      confirmText: lang === 'ar' ? 'تأكيد الاستعادة' : 'Proceed with Restore',
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setIsRestoring(true);
        setStatusMsg(null);
        try {
          const result = await restoreBackup(
            zipRef,
            currentUser?.id || 'USR-ADMIN',
            currentUser?.fullName || 'Administrator'
          );
          setStatusMsg({
            type: 'success',
            text: t.backupRestore.restoreSuccess,
          });
          notifySuccess(
            lang === 'ar'
              ? `تمت استعادة النسخة بنجاح: تم التحقق من ${result.verifiedCount} ملف.`
              : `Restore completed: Verified ${result.verifiedCount} files.`,
            lang === 'ar' ? 'استعادة ناجحة' : 'Restore Successful'
          );
          setManifestPreview(null);
          setRestoreFile(null);
          setZipRef(null);
          setRestoreConfirmed(false);
          await loadStorageInfo();
        } catch (err: any) {
          setStatusMsg({ type: 'error', text: 'Restore failed: ' + err.message });
          notifyError('Restore failed: ' + err.message);
        } finally {
          setIsRestoring(false);
        }
      },
    });
  };

  const handleRequestPersist = async () => {
    const ok = await requestStoragePersistence();
    await loadStorageInfo();
    if (ok) {
      setStatusMsg({
        type: 'success',
        text:
          lang === 'ar'
            ? 'تم تفعيل الحماية الدائمة للتخزين المحلي بنجاح.'
            : 'Persistent storage mode enabled successfully.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.backupRestore.title}</h2>
        <p className="text-xs text-slate-500">{t.backupRestore.subtitle}</p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 animate-fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{statusMsg.text}</span>
        </div>
      )}

      {/* Persistence Notice (Crucial for offline IndexedDB app) */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900 text-sm">
              {lang === 'ar' ? 'تنبيه استمرارية البيانات المحلية والنسخ الخارجي' : 'Local Storage Continuity & External Backup Safeguard'}
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              {t.backupRestore.persistenceNotice}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/60 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <span>
              {storageData.persisted ? (
                <span className="text-emerald-700 font-bold">✓ {t.settings.persistedText}</span>
              ) : (
                <span className="text-amber-800">⚠ {t.settings.notPersistedText}</span>
              )}
            </span>
            <span>•</span>
            <span>
              {storageData.usageMb} MB / {storageData.quotaMb} MB
            </span>
          </div>

          {!storageData.persisted && (
            <button
              onClick={handleRequestPersist}
              className="rounded-xl bg-amber-800 px-3.5 py-1.5 font-bold text-white hover:bg-amber-900 transition"
            >
              {t.settings.requestPersistenceBtn}
            </button>
          )}
        </div>
      </div>

      {/* Two Main Columns: Backup Box & Restore Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup Generator Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t.backupRestore.backupSection}</h3>
                <p className="text-xs text-slate-500">{t.backupRestore.backupDesc}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encryptBackup}
                  onChange={e => setEncryptBackup(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  {t.backupRestore.encryptBackup}
                </span>
              </label>

              {encryptBackup && (
                <div className="space-y-1">
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={e => setBackupPassword(e.target.value)}
                    placeholder={t.backupRestore.passwordPlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    {lang === 'ar'
                      ? 'يتم التشفير محلياً باستخدام خوارزمية AES-GCM (256-bit) وPBKDF2.'
                      : 'Client-side hardware encryption using AES-GCM (256-bit) and PBKDF2.'}
                  </p>
                </div>
              )}
            </div>

            {/* Inclusions summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs text-slate-600">
              <div className="font-bold text-slate-700">
                {lang === 'ar' ? 'محتويات الحزمة الاحتياطية:' : 'Package Contents:'}
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                <li>{lang === 'ar' ? 'كافة جداول قاعدة بيانات IndexedDB' : 'Full IndexedDB JSON Schema & Tables'}</li>
                <li>{lang === 'ar' ? 'كافة تقارير PDF وجداول Excel والمرفقات الثنائية' : 'All PDF reports, Excel files, and Blobs'}</li>
                <li>{lang === 'ar' ? 'ملف البيان التعريفي manifest.json مع الفحص الرقمي' : 'System manifest.json with record counters'}</li>
                <li>{lang === 'ar' ? 'سجل التدقيق المحلي وإعدادات الشعبة' : 'Complete Audit trail & system settings'}</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup || (encryptBackup && !backupPassword)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-700 disabled:opacity-50 transition"
            >
              <Download className="w-4 h-4" />
              <span>
                {isCreatingBackup
                  ? (lang === 'ar' ? 'جارٍ تجميع وحزم النسخة...' : 'Packaging Backup...')
                  : t.backupRestore.createBackupBtn}
              </span>
            </button>
          </div>
        </div>

        {/* Restore System Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t.backupRestore.restoreSection}</h3>
                <p className="text-xs text-slate-500">{t.backupRestore.restoreDesc}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                {t.backupRestore.selectBackupFile}
              </label>
              <input
                type="file"
                accept=".zip, .pvtbackup"
                onChange={handleFileSelectForRestore}
                className="w-full rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50 text-xs"
              />

              {restoreFile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={restorePassword}
                      onChange={e => setRestorePassword(e.target.value)}
                      placeholder={t.backupRestore.enterRestorePassword}
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:outline-none"
                    />
                    <button
                      onClick={() => inspectFile(restoreFile, restorePassword)}
                      disabled={inspecting}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                    >
                      {inspecting ? '...' : (lang === 'ar' ? 'فحص الحزمة' : 'Verify')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Manifest preview */}
            {manifestPreview && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs text-emerald-900 animate-fade-in">
                <div className="flex items-center justify-between font-bold">
                  <span>✓ {lang === 'ar' ? 'تم التحقق من سلامة الحزمة:' : 'Package Verified:'}</span>
                  <span className="font-mono text-[10px] text-emerald-700">v{manifestPreview.version}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800">
                  <div>{t.dashboard.totalFields}: {manifestPreview.counts.fields}</div>
                  <div>{t.dashboard.totalReservoirs}: {manifestPreview.counts.reservoirs}</div>
                  <div>{t.dashboard.totalWells}: {manifestPreview.counts.wells}</div>
                  <div>{t.dashboard.totalSamples}: {manifestPreview.counts.samples}</div>
                  <div>{t.dashboard.totalAnalyses}: {manifestPreview.counts.analyses}</div>
                  <div>{t.reports.title}: {manifestPreview.counts.attachments}</div>
                </div>

                <div className="pt-2 border-t border-emerald-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700">
                    <input
                      type="checkbox"
                      checked={restoreConfirmed}
                      onChange={e => setRestoreConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>{t.backupRestore.restoreConfirm}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleExecuteRestore}
              disabled={!manifestPreview || !restoreConfirmed || isRestoring}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-40 transition"
            >
              <ArchiveRestore className="w-4 h-4" />
              <span>
                {isRestoring
                  ? (lang === 'ar' ? 'جارٍ استعادة البيانات والمرفقات...' : 'Restoring Data...')
                  : (lang === 'ar' ? 'تأكيد واستعادة النظام الآن' : 'Commit System Restore')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
