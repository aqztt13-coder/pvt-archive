import React from 'react';
import {
  Monitor,
  Download,
  WifiOff,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  FileText,
  AlertTriangle,
  Layers,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { translations } from '../../i18n/translations';
import type { Language } from '../../types';

interface Props {
  lang: Language;
  onOpenPWAInstall: () => void;
}

export const HelpView: React.FC<Props> = ({ lang, onOpenPWAInstall }) => {
  const t = translations[lang];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.help.title}</h2>
        <p className="text-xs text-slate-500">{t.help.subtitle}</p>
      </div>

      {/* Hero Standalone Desktop Card */}
      <div className="rounded-2xl bg-linear-to-r from-slate-900 to-sky-950 p-6 text-white shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base">{t.help.pwaIntroTitle}</h3>
            <span className="text-xs text-sky-300 font-mono">
              Microsoft Edge & Google Chrome • Windows 10/11 Native App
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
          {t.help.pwaIntroDesc}
        </p>

        <div className="pt-2">
          <button
            onClick={onOpenPWAInstall}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400 shadow-md transition"
          >
            <Download className="w-4 h-4" />
            <span>{t.actions.installPWA}</span>
          </button>
        </div>
      </div>

      {/* Step by Step Windows Installation Guide */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <h3 className="font-bold text-slate-900 text-sm">
          {lang === 'ar' ? 'خطوات التثبيت التفصيلية على حواسيب Windows:' : 'Windows Step-by-Step Installation Procedure:'}
        </h3>

        <div className="space-y-4">
          <div className="flex gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
              1
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">{t.help.step1Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.help.step1Desc}</p>
            </div>
          </div>

          <div className="flex gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
              2
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">{t.help.step2Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.help.step2Desc}</p>
            </div>
          </div>

          <div className="flex gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
              3
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">{t.help.step3Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.help.step3Desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {lang === 'ar' ? 'قائمة الفحص والاختبار الميداني دون إنترنت (Offline Verification):' : 'Offline Readiness Verification Checklist:'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-800">{lang === 'ar' ? 'تشغيل التطبيق بعد قطع الاتصال' : 'App Launches Completely Offline'}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Service Worker caches all bundles, CSS, and fonts.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-800">{lang === 'ar' ? 'البحث والفهرسة الفورية محلياً' : 'Instant In-Memory Search & Filtering'}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">IndexedDB indexes execute on local CPU with zero network delay.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-800">{lang === 'ar' ? 'معاينة تقارير PDF المرفوعة' : 'Offline PDF Report Preview'}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Blob objects load directly from local browser memory.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-800">{lang === 'ar' ? 'استيراد وتصدير Excel محلياً' : 'Client-Side Excel Processing'}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">100% in-browser XLSX parser without server submission.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Safety & Best Practices */}
      <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 space-y-2">
        <h4 className="font-bold text-slate-900">{t.help.storageTipsTitle}</h4>
        <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
          <li>{t.help.storageTip1}</li>
          <li>{t.help.storageTip2}</li>
          <li>{t.help.storageTip3}</li>
        </ul>
      </div>
    </div>
  );
};
