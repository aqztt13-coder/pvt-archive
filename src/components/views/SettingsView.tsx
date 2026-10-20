import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDrive,
  Languages,
  Sliders,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  db,
  checkStoragePersistence,
  requestStoragePersistence,
  seedInitialDatabaseIfEmpty,
  logAuditEvent,
} from '../../db/pvtDb';
import { canAdminister } from '../../services/authService';
import { notifySuccess, notifyError, requestConfirm } from '../../services/notificationService';
import { translations } from '../../i18n/translations';
import type { Language, LocalUser } from '../../types';

interface Props {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  currentUser: LocalUser | null;
}

export const SettingsView: React.FC<Props> = ({
  lang,
  onLanguageChange,
  currentUser,
}) => {
  const t = translations[lang];

  const [storageData, setStorageData] = useState<{
    persisted: boolean;
    quotaMb: number;
    usageMb: number;
    usagePercent: number;
  }>({ persisted: false, quotaMb: 0, usageMb: 0, usagePercent: 0 });

  const [unitSystem, setUnitSystem] = useState<'oilfield' | 'metric'>('oilfield');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const st = await checkStoragePersistence();
    setStorageData({
      persisted: st.persisted,
      quotaMb: st.quota ? Math.round(st.quota / (1024 * 1024)) : 0,
      usageMb: st.usage ? Math.round((st.usage / (1024 * 1024)) * 10) / 10 : 0,
      usagePercent: st.usagePercent || 0,
    });

    const unitSetting = await db.appSettings.get('unitSystem');
    if (unitSetting) setUnitSystem(unitSetting.value);
  };

  const handleTogglePersist = async () => {
    const ok = await requestStoragePersistence();
    await loadSettings();
    if (ok) {
      setMsg({
        type: 'success',
        text:
          lang === 'ar'
            ? 'تم منح تصريح استمرارية التخزين بنجاح من المتصفح.'
            : 'Persistent storage permission granted by browser.',
      });
    } else {
      setMsg({
        type: 'error',
        text:
          lang === 'ar'
            ? 'تعذر تفعيل الاستمرارية الدائمة أو تم رفضها من سياسة المتصفح.'
            : 'Could not grant persistent storage due to browser security policy.',
      });
    }
  };

  const handleUnitChange = async (val: 'oilfield' | 'metric') => {
    setUnitSystem(val);
    await db.appSettings.put({ key: 'unitSystem', value: val });
    await logAuditEvent({
      userId: currentUser?.id || 'USR',
      userName: currentUser?.fullName || 'User',
      actionType: 'SETTINGS_CHANGED',
      entityType: 'AppSetting',
      entityId: 'unitSystem',
      details: `Unit system changed to ${val}.`,
    });
    setMsg({
      type: 'success',
      text: lang === 'ar' ? 'تم حفظ تفضيل نظام الوحدات.' : 'Unit system preference saved.',
    });
  };

  const handleResetDemoData = () => {
    if (!canAdminister(currentUser)) {
      notifyError(
        lang === 'ar' ? 'فقط مدير النظام يملك صلاحية إعادة الضبط.' : 'Only administrators can reset reference data.'
      );
      return;
    }

    requestConfirm({
      title: lang === 'ar' ? 'تأكيد إعادة الضبط' : 'Confirm Data Reset',
      message: t.settings.resetWarning,
      confirmText: lang === 'ar' ? 'إعادة الضبط' : 'Reset Data',
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await db.transaction(
          'rw',
          [
            db.fields,
            db.reservoirs,
            db.formations,
            db.wells,
            db.samples,
            db.analysisRecords,
            db.pvtProperties,
            db.reports,
            db.localUsers,
          ],
          async () => {
            await db.fields.clear();
            await db.reservoirs.clear();
            await db.formations.clear();
            await db.wells.clear();
            await db.samples.clear();
            await db.analysisRecords.clear();
            await db.pvtProperties.clear();
            await db.reports.clear();
            await db.localUsers.clear();
          }
        );

        await seedInitialDatabaseIfEmpty();
        await loadSettings();
        setMsg({
          type: 'success',
          text: lang === 'ar' ? 'تمت إعادة توليد البيانات النموذجية المرجعية بنجاح.' : 'Demonstration reference data re-seeded.',
        });
        notifySuccess(
          lang === 'ar' ? 'تمت إعادة توليد البيانات النموذجية بنجاح.' : 'Demonstration data re-seeded successfully.'
        );
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.settings.title}</h2>
        <p className="text-xs text-slate-500">{t.settings.subtitle}</p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 animate-fade-in ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span className="font-semibold">{msg.text}</span>
        </div>
      )}

      {/* Storage & Eviction Protection Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <HardDrive className="w-5 h-5 text-sky-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{t.settings.storageTitle}</h3>
            <p className="text-xs text-slate-500">IndexedDB Storage & Browser Eviction Guard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">{t.settings.storageUsed}</span>
            <div className="text-base font-bold text-slate-900 font-mono">
              {storageData.usageMb} MB
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">{t.settings.storageQuota}</span>
            <div className="text-base font-bold text-slate-900 font-mono">
              {storageData.quotaMb} MB
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-800 block">{t.settings.persistStatus}</span>
            <span className="text-slate-600 text-[11px]">
              {storageData.persisted ? t.settings.persistedText : t.settings.notPersistedText}
            </span>
          </div>

          {!storageData.persisted && (
            <button
              onClick={handleTogglePersist}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 transition"
            >
              {t.settings.requestPersistenceBtn}
            </button>
          )}
        </div>
      </div>

      {/* Units & Localization */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{t.settings.unitSystem}</h3>
            <p className="text-xs text-slate-500">Engineering Measurement Conventions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label
            onClick={() => handleUnitChange('oilfield')}
            className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
              unitSystem === 'oilfield'
                ? 'border-sky-500 bg-sky-50/50 text-sky-950 font-medium'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="unit"
              checked={unitSystem === 'oilfield'}
              onChange={() => handleUnitChange('oilfield')}
              className="mt-0.5 text-sky-600"
            />
            <div>
              <span className="font-bold block text-slate-900">
                {lang === 'ar' ? 'وحدات الحقول النفطية القياسية (Oilfield Units)' : 'Oilfield Standard Units'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">{t.settings.oilfieldUnits}</p>
            </div>
          </label>

          <label
            onClick={() => handleUnitChange('metric')}
            className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
              unitSystem === 'metric'
                ? 'border-sky-500 bg-sky-50/50 text-sky-950 font-medium'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="unit"
              checked={unitSystem === 'metric'}
              onChange={() => handleUnitChange('metric')}
              className="mt-0.5 text-sky-600"
            />
            <div>
              <span className="font-bold block text-slate-900">
                {lang === 'ar' ? 'الوحدات المترية الدولية (Metric / SI Units)' : 'Metric / SI Standard Units'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">{t.settings.metricUnits}</p>
            </div>
          </label>
        </div>

        {/* Language switch */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-800">{t.settings.languageSetting}:</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onLanguageChange('ar')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                lang === 'ar'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              العربية (RTL)
            </button>
            <button
              onClick={() => onLanguageChange('en')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                lang === 'en'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              English (LTR)
            </button>
          </div>
        </div>
      </div>

      {/* User Security & Secret Code Card */}
      {currentUser && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">
                  {lang === 'ar' ? 'الأمان وتغيير الرمز السري' : 'Security & Secret Code'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ar'
                    ? 'التحكم في الرمز السري وتأمينه بحيث يكون خاصاً وغير ظاهر للعلن'
                    : 'Manage your confidential secret code to ensure privacy'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-700">
                {currentUser.email || currentUser.username}
              </span>
              {currentUser.isDefaultPassword ? (
                <span className="rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                  {lang === 'ar' ? 'رمز افتراضي' : 'Default Code'}
                </span>
              ) : (
                <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                  {lang === 'ar' ? 'رمز سري محمي' : 'Secured Code'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'ar' ? 'الرمز السري الحالي / الافتراضي:' : 'Current / Default Code:'}
              </label>
              <input
                type="password"
                placeholder={lang === 'ar' ? 'الرمز الحالي أو 123456' : 'Current code or 123456'}
                id="settings-current-pwd"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'ar' ? 'الرمز السري الجديد:' : 'New Private Code:'}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                id="settings-new-pwd"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'ar' ? 'تأكيد الرمز الجديد:' : 'Confirm New Code:'}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                id="settings-confirm-pwd"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={async () => {
                const curEl = document.getElementById('settings-current-pwd') as HTMLInputElement;
                const newEl = document.getElementById('settings-new-pwd') as HTMLInputElement;
                const confEl = document.getElementById('settings-confirm-pwd') as HTMLInputElement;

                if (!curEl?.value || !newEl?.value || !confEl?.value) {
                  notifyError(
                    lang === 'ar'
                      ? 'يرجى ملء جميع حقول الرمز السري.'
                      : 'Please fill in all secret code fields.'
                  );
                  return;
                }

                if (newEl.value !== confEl.value) {
                  notifyError(
                    lang === 'ar'
                      ? 'الرمز السري الجديد وتأكيده غير متطابقين.'
                      : 'New code and confirmation do not match.'
                  );
                  return;
                }

                const res = await (await import('../../services/authService')).changeUserSecretCode(
                  currentUser.id,
                  curEl.value,
                  newEl.value
                );

                if (res.success) {
                  notifySuccess(
                    lang === 'ar'
                      ? 'تم تحديث وتشفير رمزك السري الجديد بنجاح! أصبح رمزك سرياً وخاصاً بك.'
                      : 'Secret code updated successfully! Your code is now confidential.'
                  );
                  curEl.value = '';
                  newEl.value = '';
                  confEl.value = '';
                } else {
                  notifyError(res.error || 'Failed to update code');
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <span>{lang === 'ar' ? 'حفظ وتأمين الرمز السري' : 'Save & Secure Code'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone: Demo data reset */}
      {canAdminister(currentUser) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">{t.settings.resetDemoData}</h4>
              <p className="text-[11px] text-slate-500">{t.settings.resetWarning}</p>
            </div>
            <button
              onClick={handleResetDemoData}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'ar' ? 'إعادة التعيين النموذجية' : 'Re-seed Demo Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <span>{lang === 'ar' ? 'نظام تحاليل الموائع المكمنية' : 'PVT Analysis System'}</span>
        <span className="font-mono text-slate-500">IndexedDB: PVTAnalysisSystemDB</span>
      </div>
    </div>
  );
};
