import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Layers,
  GitCommit,
  FlaskConical,
  Activity,
  FileArchive,
  Search,
  PlusCircle,
  FileSpreadsheet,
  ArchiveRestore,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { db, checkStoragePersistence, requestStoragePersistence } from '../../db/pvtDb';
import { translations } from '../../i18n/translations';
import type { ActiveTab, Language, LocalUser, SampleRecord, AnalysisRecord } from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
  onNavigate: (tab: ActiveTab) => void;
  onSelectSampleDetail: (sampleId: string) => void;
}

export const DashboardView: React.FC<Props> = ({
  lang,
  currentUser,
  onNavigate,
  onSelectSampleDetail,
}) => {
  const t = translations[lang];

  const [stats, setStats] = useState({
    fields: 0,
    reservoirs: 0,
    wells: 0,
    samples: 0,
    analyses: 0,
    reports: 0,
  });

  const [recentSamples, setRecentSamples] = useState<SampleRecord[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean;
    quotaMb: number;
    usageMb: number;
    usagePercent: number;
  }>({
    persisted: false,
    quotaMb: 0,
    usageMb: 0,
    usagePercent: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const [fieldsCount, reservoirsCount, wellsCount, samplesCount, analysesCount, reportsCount] =
      await Promise.all([
        db.fields.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
        db.reservoirs.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
        db.wells.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
        db.samples.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
        db.analysisRecords.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
        db.reports.where('isArchived').equals(0 as any).or('isArchived').equals(false as any).count(),
      ]);

    setStats({
      fields: fieldsCount,
      reservoirs: reservoirsCount,
      wells: wellsCount,
      samples: samplesCount,
      analyses: analysesCount,
      reports: reportsCount,
    });

    const samples = await db.samples.orderBy('createdAt').reverse().limit(5).toArray();
    setRecentSamples(samples);

    const analyses = await db.analysisRecords.orderBy('createdAt').reverse().limit(5).toArray();
    setRecentAnalyses(analyses);

    const st = await checkStoragePersistence();
    setStorageInfo({
      persisted: st.persisted,
      quotaMb: st.quota ? Math.round(st.quota / (1024 * 1024)) : 0,
      usageMb: st.usage ? Math.round((st.usage / (1024 * 1024)) * 10) / 10 : 0,
      usagePercent: st.usagePercent || 0,
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestPersist = async () => {
    const granted = await requestStoragePersistence();
    if (granted) {
      await loadData();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to pvt-index with pre-filtered search
      sessionStorage.setItem('pvt_initial_search', searchQuery);
      onNavigate('pvt-index');
    }
  };

  const statCards = [
    { label: t.dashboard.totalFields, count: stats.fields, icon: MapPin, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', tab: 'fields' as ActiveTab },
    { label: t.dashboard.totalReservoirs, count: stats.reservoirs, icon: Layers, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-100', tab: 'reservoirs' as ActiveTab },
    { label: t.dashboard.totalWells, count: stats.wells, icon: GitCommit, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-100', tab: 'wells' as ActiveTab },
    { label: t.dashboard.totalSamples, count: stats.samples, icon: FlaskConical, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', tab: 'samples' as ActiveTab },
    { label: t.dashboard.totalAnalyses, count: stats.analyses, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', tab: 'analyses' as ActiveTab },
    { label: t.dashboard.totalReports, count: stats.reports, icon: FileArchive, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', tab: 'reports' as ActiveTab },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Search */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-sky-950 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-500/30">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.offlineBadge}</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {t.dashboard.title}
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {t.dashboard.subtitle}
            </p>
          </div>

          {/* Quick Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2">
            <div className="relative flex items-center max-w-2xl">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.dashboard.quickSearchPlaceholder}
                className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/20 px-4 py-3.5 pe-24 text-sm text-white placeholder-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none transition shadow-inner"
              />
              <button
                type="submit"
                className="absolute end-1.5 top-1.5 bottom-1.5 rounded-lg bg-sky-500 px-4 text-xs font-bold text-white hover:bg-sky-400 active:scale-95 transition flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t.actions.search}</span>
              </button>
            </div>
          </form>

          {/* Action shortcuts */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              onClick={() => onNavigate('samples')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition border border-white/10"
            >
              <PlusCircle className="w-3.5 h-3.5 text-sky-300" />
              <span>{t.samples.addSample}</span>
            </button>
            <button
              onClick={() => onNavigate('import-export')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition border border-white/10"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t.actions.importExcel}</span>
            </button>
            <button
              onClick={() => onNavigate('backup-restore')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition border border-white/10"
            >
              <ArchiveRestore className="w-3.5 h-3.5 text-amber-300" />
              <span>{t.nav.backupRestore}</span>
            </button>
            <button
              onClick={() => onNavigate('pvt-index')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition shadow-sm"
            >
              <span>{t.nav.pvtIndex}</span>
              {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Live Calculated Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {statCards.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              onClick={() => onNavigate(item.tab)}
              className={`rounded-2xl border p-4.5 cursor-pointer transition hover:shadow-md hover:scale-[1.02] bg-white ${item.bg}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 truncate">{item.label}</span>
                <div className={`p-2 rounded-xl bg-white shadow-xs ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                {item.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Columns: Recent Samples & Recent Analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Samples */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <FlaskConical className="w-4 h-4 text-amber-600" />
              <span>{t.dashboard.recentSamples}</span>
            </div>
            <button
              onClick={() => onNavigate('samples')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <span>{t.actions.view}</span>
              {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="space-y-2.5">
            {recentSamples.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">{t.dashboard.noRecentData}</div>
            ) : (
              recentSamples.map(sample => (
                <div
                  key={sample.id}
                  onClick={() => onSelectSampleDetail(sample.id)}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{sample.sampleCode}</span>
                      <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] font-medium">
                        {sample.fluidType}
                      </span>
                      <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px]">
                        {sample.sampleType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {sample.samplingMethod}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[11px] font-mono text-slate-500">{sample.samplingDate}</div>
                    <span className="inline-block text-[10px] font-semibold text-emerald-600">
                      {sample.sampleStatus}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Analyses */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>{t.dashboard.recentAnalyses}</span>
            </div>
            <button
              onClick={() => onNavigate('analyses')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <span>{t.actions.view}</span>
              {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="space-y-2.5">
            {recentAnalyses.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">{t.dashboard.noRecentData}</div>
            ) : (
              recentAnalyses.map(analysis => (
                <div
                  key={analysis.id}
                  onClick={() => onNavigate('analyses')}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{analysis.reportNumber}</span>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-medium">
                        {analysis.testType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                      {analysis.laboratory}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[11px] font-bold text-slate-700">
                      {analysis.bubblePointPressure ? `Pb: ${analysis.bubblePointPressure} psi` : analysis.analysisDate}
                    </div>
                    <span className="inline-block text-[10px] font-semibold text-sky-600">
                      {analysis.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Storage & Local Persistence Widget */}
      <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-slate-50 to-white p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <HardDrive className="w-5 h-5 text-sky-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                {lang === 'ar' ? 'حالة التخزين المحلي واستمرارية البيانات' : 'Local Storage & Continuity Status'}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                  storageInfo.persisted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {storageInfo.persisted ? t.storagePersisted : t.storageVolatile}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {lang === 'ar'
                ? `المساحة المستخدمة: ${storageInfo.usageMb} MB من أصل ${storageInfo.quotaMb || 1000} MB متاحة في ذاكرة المتصفح المحلية.`
                : `Storage Used: ${storageInfo.usageMb} MB of estimated ${storageInfo.quotaMb || 1000} MB browser quota.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!storageInfo.persisted && (
            <button
              onClick={handleRequestPersist}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              {t.actions.requestPersistence}
            </button>
          )}
          <button
            onClick={() => onNavigate('backup-restore')}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            {t.backupRestore.createBackupBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
