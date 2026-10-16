import React from 'react';
import { Download, Monitor, ShieldCheck, CheckCircle2, X, ExternalLink, HardDrive } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { translations } from '../../i18n/translations';
import type { Language } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const PWAInstallModal: React.FC<Props> = ({ isOpen, onClose, lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {lang === 'ar' ? 'تثبيت نظام تحليل الموائع المكمنية على سطح المكتب' : 'Install PVT Analysis System on Windows Desktop'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'تطبيق مستقل (PWA) يعمل بالكامل دون الحاجة للإنترنت' : 'Standalone Desktop PWA — 100% Offline Operational'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Status Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-900">
                {isInstalled
                  ? (lang === 'ar' ? 'التطبيق مثبت حالياً ويعمل في نافذة سطح مكتب مستقلة' : 'Application is currently running in standalone desktop mode.')
                  : (lang === 'ar' ? 'التطبيق جاهز للتثبيت على حاسوبك المكتبي' : 'Application is ready for 1-click Windows desktop installation.')}
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                {lang === 'ar'
                  ? 'بمجرد التثبيت، تُخزن كافة الشيفرات والخطوط والمكتبات محلياً ولن تتأثر بقطع الإنترنت.'
                  : 'All scripts, styles, icons, and libraries are locally cached for zero-network dependency.'}
              </p>
            </div>
          </div>

          {/* Direct Install Button if browser supports beforeinstallprompt */}
          {isInstallable && !isInstalled && (
            <div className="text-center py-2">
              <button
                onClick={async () => {
                  const success = await install();
                  if (success) onClose();
                }}
                className="inline-flex items-center gap-2.5 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-700 active:scale-95 transition"
              >
                <Download className="w-5 h-5" />
                {lang === 'ar' ? 'تثبيت التطبيق الآن على Windows' : 'Install PVT System Now'}
              </button>
            </div>
          )}

          {/* Windows Desktop Steps */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <Monitor className="w-4 h-4 text-sky-600" />
              {lang === 'ar' ? 'خطوات التثبيت وإضافة اختصار سطح المكتب (Windows):' : 'Installation & Desktop Shortcut Guide (Windows):'}
            </h4>

            <div className="grid gap-3">
              <div className="flex gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs">
                  1
                </span>
                <div>
                  <div className="font-semibold text-slate-800">
                    {lang === 'ar' ? 'التثبيت عبر Microsoft Edge أو Google Chrome' : 'Install via Microsoft Edge or Google Chrome'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'انقر على زر "تثبيت" في أعلى النافذة، أو انقر على أيقونة التثبيت (شاشة مع سهم) الموجودة في شريط عنوان المتصفح في أعلى اليمين/اليسار.'
                      : 'Click the "Install" button above, or click the App Available icon (monitor with down arrow) in the browser address bar.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs">
                  2
                </span>
                <div>
                  <div className="font-semibold text-slate-800">
                    {lang === 'ar' ? 'الموافقة وتثبيت الاختصار (Desktop Shortcut)' : 'Approve & Pin to Desktop / Taskbar'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'عند ظهور نافذة Windows المنبثقة، ضع علامة صح بجوار: "إنشاء اختصار على سطح المكتب" (Create Desktop shortcut) و"تثبيت في شريط المهام" (Pin to taskbar).'
                      : 'In the system dialog, check "Create Desktop shortcut" and "Pin to taskbar" for convenient 1-click access.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs">
                  3
                </span>
                <div>
                  <div className="font-semibold text-slate-800">
                    {lang === 'ar' ? 'التشغيل المستقل دون متصفح' : 'Standalone Window Experience'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'سيفتح التطبيق في نافذة مستقلة خاصة به تحمل اسم وأيقونة شعبة الموائع المكمنية دون أشرطة المتصفح المعتادة، وسيعمل حتى عند فصل كابل الإنترنت تماماً.'
                      : 'The app opens in an isolated native-style window with its own taskbar icon and functions seamlessly with the network completely disconnected.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Protection Notice */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {lang === 'ar'
                ? 'ملاحظة مهمة: بيانات العينات والتحاليل تحفظ محلياً على هذا الجهاز ضمن بيئة المتصفح. لضمان الأمان الدائم، يرجى الاستفادة من ميزة النسخ الاحتياطي (Backup) دورياً وتخزين ملف ZIP على قرص خارجي.'
                : 'Important: All PVT records and PDF reports reside in your local machine storage. Always perform regular backups (.zip package) to an external division drive.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
          >
            {t.actions.close}
          </button>
        </div>
      </div>
    </div>
  );
};
