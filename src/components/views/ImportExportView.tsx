import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Layers,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import {
  parseExcelFileLocally,
  extractSheetData,
  validateAndPrepareImport,
  executeImport,
  downloadSampleExcelTemplate,
  exportCatalogToExcel,
  type ParsedExcelSheet,
  type ImportValidationResult,
} from '../../services/excelService';
import { notifySuccess, notifyError, notifyWarning } from '../../services/notificationService';
import { db } from '../../db/pvtDb';
import { canCreateOrEdit } from '../../services/authService';
import { translations } from '../../i18n/translations';
import type { Language, LocalUser } from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
}

export const ImportExportView: React.FC<Props> = ({ lang, currentUser }) => {
  const t = translations[lang];

  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<ParsedExcelSheet | null>(null);
  const [workbookRef, setWorkbookRef] = useState<any>(null);

  // Field mapping state
  const [mapping, setMapping] = useState<Record<string, string>>({
    sampleCode: '',
    field: '',
    reservoir: '',
    well: '',
    fluidType: '',
    sampleType: '',
    samplingDate: '',
    samplingDepth: '',
    samplingPressure: '',
    samplingTemp: '',
    satPressure: '',
  });

  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; updated: number } | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      try {
        const { sheets, workbook } = await parseExcelFileLocally(selected);
        setSheetNames(sheets);
        setWorkbookRef(workbook);
        const firstSheet = sheets[0] || '';
        setSelectedSheet(firstSheet);
        const extracted = extractSheetData(workbook, firstSheet);
        setSheetData(extracted);

        // Auto map recognized headers
        const autoMap: Record<string, string> = { ...mapping };
        extracted.headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('sample') && (lower.includes('code') || lower.includes('id') || lower.includes('name'))) {
            autoMap.sampleCode = h;
          } else if (lower.includes('field') || lower.includes('حقل')) {
            autoMap.field = h;
          } else if (lower.includes('reservoir') || lower.includes('مكمن')) {
            autoMap.reservoir = h;
          } else if (lower.includes('well') || lower.includes('بئر')) {
            autoMap.well = h;
          } else if (lower.includes('fluid') || lower.includes('مائع')) {
            autoMap.fluidType = h;
          } else if (lower.includes('type') && !lower.includes('fluid')) {
            autoMap.sampleType = h;
          } else if (lower.includes('date') || lower.includes('تاريخ')) {
            autoMap.samplingDate = h;
          } else if (lower.includes('depth') || lower.includes('عمق')) {
            autoMap.samplingDepth = h;
          } else if (lower.includes('pressure') && !lower.includes('sat')) {
            autoMap.samplingPressure = h;
          } else if (lower.includes('temp') || lower.includes('حرار')) {
            autoMap.samplingTemp = h;
          } else if (lower.includes('pb') || lower.includes('sat')) {
            autoMap.satPressure = h;
          }
        });
        setMapping(autoMap);
        setStep(2);
      } catch (err: any) {
        notifyError(
          'Failed to read Excel workbook: ' + err.message,
          lang === 'ar' ? 'خطأ في قراءة ملف Excel' : 'Excel Read Error'
        );
      }
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookRef) {
      const extracted = extractSheetData(workbookRef, sheetName);
      setSheetData(extracted);
    }
  };

  const handleValidateStep = async () => {
    if (!sheetData) return;
    if (!mapping.sampleCode) {
      notifyWarning(
        lang === 'ar' ? 'يرجى مطابقة حقل "رمز العينة" الإلزامي.' : 'Please map the mandatory Sample Code field.',
        lang === 'ar' ? 'حقل إلزامي' : 'Mandatory Field'
      );
      return;
    }

    const res = await validateAndPrepareImport(sheetData.rows, mapping, duplicateAction);
    setValidationResult(res);
    setStep(4);
  };

  const handleExecuteImport = async () => {
    if (!validationResult) return;
    setImporting(true);
    try {
      const { importedCount, updatedCount } = await executeImport(
        validationResult,
        mapping,
        currentUser?.id || 'USR',
        currentUser?.fullName || 'User',
        currentUser?.role
      );
      setImportSummary({ imported: importedCount, updated: updatedCount });
      setStep(5);
      notifySuccess(
        lang === 'ar'
          ? `اكتمل الاستيراد بنجاح: تم إدراج ${importedCount} عينة وتحديث ${updatedCount}.`
          : `Import completed: Inserted ${importedCount} and updated ${updatedCount} records.`
      );
    } catch (err: any) {
      notifyError(
        'Import failed: ' + err.message,
        lang === 'ar' ? 'فشل الاستيراد' : 'Import Failed'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleExportAll = async () => {
    const [analyses, samples, fields, reservoirs, wells] = await Promise.all([
      db.analysisRecords.toArray(),
      db.samples.toArray(),
      db.fields.toArray(),
      db.reservoirs.toArray(),
      db.wells.toArray(),
    ]);

    const fieldMap = new Map(fields.map(f => [f.id, f]));
    const resMap = new Map(reservoirs.map(r => [r.id, r]));
    const wellMap = new Map(wells.map(w => [w.id, w]));

    const rows = samples.map(s => {
      const anl = analyses.find(a => a.sampleId === s.id);
      return {
        analysis: anl || { id: 'N/A', reportNumber: 'N/A' },
        sample: s,
        field: fieldMap.get(s.fieldId),
        reservoir: resMap.get(s.reservoirId),
        well: wellMap.get(s.wellId),
      };
    });

    await exportCatalogToExcel(rows, `PVT_Complete_Database_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const resetImporter = () => {
    setStep(1);
    setFile(null);
    setSheetNames([]);
    setSelectedSheet('');
    setSheetData(null);
    setWorkbookRef(null);
    setValidationResult(null);
    setImportSummary(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.importExport.title}</h2>
          <p className="text-xs text-slate-500">{t.importExport.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleExcelTemplate}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>{t.importExport.downloadTemplate}</span>
          </button>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-sm transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.importExport.exportAllData}</span>
          </button>
        </div>
      </div>

      {/* 5-Step Process Bar */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {[
          { num: 1, label: t.importExport.step1 },
          { num: 2, label: t.importExport.step2 },
          { num: 3, label: t.importExport.step3 },
          { num: 4, label: t.importExport.step4 },
          { num: 5, label: t.importExport.step5 },
        ].map(s => (
          <div
            key={s.num}
            className={`p-2.5 rounded-xl border text-[11px] font-semibold transition ${
              step === s.num
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : step > s.num
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            <span className="block truncate">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main Importer Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        {/* Step 1: Pick File */}
        {step === 1 && (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-bold text-slate-800 text-base">{t.importExport.selectFile}</h3>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'اختر مصنف Excel من جهازك ليتم فحصه واستيراده محلياً داخل المتصفح دون اتصال بالإنترنت.'
                  : 'Select an Excel file from your computer for instant 100% offline local processing.'}
              </p>
            </div>

            <div className="max-w-xs mx-auto pt-2">
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 p-6 cursor-pointer hover:bg-sky-50 transition">
                <Upload className="w-6 h-6 text-sky-600 mb-2" />
                <span className="text-xs font-bold text-sky-800">
                  {lang === 'ar' ? 'انقر لاختيار الملف' : 'Browse Local Files'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">XLSX, XLS</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Select Sheet & Inspect Sample Rows */}
        {step === 2 && sheetData && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {lang === 'ar' ? 'فحص أوراق العمل والأعمدة المكتشفة' : 'Inspect Worksheet & Discovered Columns'}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.importExport.totalRowsFound.replace('{count}', String(sheetData.rows.length))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">{t.importExport.selectSheet}:</span>
                <select
                  value={selectedSheet}
                  onChange={e => handleSheetChange(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none"
                >
                  {sheetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Preview Table of First 3 rows */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">
                {lang === 'ar' ? 'معاينة أول 3 صفوف من الملف:' : 'Preview of first 3 rows:'}
              </span>
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b">
                      {sheetData.headers.map((h, i) => (
                        <th key={i} className="p-2.5 font-semibold text-start whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sheetData.rows.slice(0, 3).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {sheetData.headers.map((h, cIdx) => (
                          <td key={cIdx} className="p-2.5 text-slate-600 whitespace-nowrap">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={resetImporter}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t.actions.cancel}
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-sm transition"
              >
                <span>{lang === 'ar' ? 'المتابعة لمطابقة الأعمدة' : 'Proceed to Field Mapping'}</span>
                {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Column Mapping & Conflict Resolution */}
        {step === 3 && sheetData && (
          <div className="space-y-5">
            <div className="border-b pb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {lang === 'ar' ? 'مطابقة أعمدة Excel مع حقول نظام PVT' : 'Map Excel Columns to PVT System Fields'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'حدد العمود المطابق في ملف Excel لكل خاصية مكمنية.'
                  : 'Map each source Excel column to the corresponding database field.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">
                  {t.samples.sampleCode} *
                </label>
                <select
                  value={mapping.sampleCode}
                  onChange={e => setMapping({ ...mapping, sampleCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.well}</label>
                <select
                  value={mapping.well}
                  onChange={e => setMapping({ ...mapping, well: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.field}</label>
                <select
                  value={mapping.field}
                  onChange={e => setMapping({ ...mapping, field: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.reservoir}</label>
                <select
                  value={mapping.reservoir}
                  onChange={e => setMapping({ ...mapping, reservoir: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.fluidType}</label>
                <select
                  value={mapping.fluidType}
                  onChange={e => setMapping({ ...mapping, fluidType: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.sampleType}</label>
                <select
                  value={mapping.sampleType}
                  onChange={e => setMapping({ ...mapping, sampleType: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.samplingDate}</label>
                <select
                  value={mapping.samplingDate}
                  onChange={e => setMapping({ ...mapping, samplingDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">{t.samples.satPressure} Pb</label>
                <select
                  value={mapping.satPressure}
                  onChange={e => setMapping({ ...mapping, satPressure: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- {lang === 'ar' ? 'اختر العمود' : 'Select Column'} --</option>
                  {sheetData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conflict resolution option */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
              <span className="font-bold text-amber-900 block">{t.importExport.duplicateAction}</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-amber-900">
                  <input
                    type="radio"
                    name="dup"
                    value="skip"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                    className="text-sky-600"
                  />
                  <span>{t.importExport.skipDuplicates}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-amber-900">
                  <input
                    type="radio"
                    name="dup"
                    value="update"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                    className="text-sky-600"
                  />
                  <span>{t.importExport.updateExisting}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {lang === 'ar' ? 'السابق' : 'Back'}
              </button>
              <button
                onClick={handleValidateStep}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-sm transition"
              >
                <span>{lang === 'ar' ? 'فحص السجلات والتكرارات' : 'Validate & Detect Duplicates'}</span>
                {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Duplicate Detection Summary */}
        {step === 4 && validationResult && (
          <div className="space-y-5">
            <div className="border-b pb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {lang === 'ar' ? 'ملخص الفحص والتحقق قبل الاعتماد النهائي' : 'Validation & Integrity Summary'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'راجع الإحصائيات قبل كتابة السجلات نهائياً في قاعدة البيانات المحلية.'
                  : 'Review the dry-run validation results before committing to IndexedDB.'}
              </p>
            </div>

            {/* Summary counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <span className="font-bold text-xs block text-emerald-700 mb-1">
                  ✓ {t.importExport.validRows.replace('{count}', String(validationResult.validRows.length))}
                </span>
                <p className="text-[11px] text-emerald-600">
                  {lang === 'ar' ? 'سجلات مطابقة ومستعدة للحفظ الفوري.' : 'Fully valid and ready for commit.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold text-xs block text-amber-700 mb-1">
                  ⚠ {t.importExport.duplicateRows.replace('{count}', String(validationResult.duplicateRows.length))}
                </span>
                <p className="text-[11px] text-amber-700">
                  {duplicateAction === 'skip'
                    ? (lang === 'ar' ? 'سيتم تخطيها للحفاظ على البيانات السابقة.' : 'Will be skipped to preserve existing.')
                    : (lang === 'ar' ? 'سيتم تحديث السجلات السابقة.' : 'Will update existing records.')}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <span className="font-bold text-xs block text-rose-700 mb-1">
                  ✕ {t.importExport.invalidRows.replace('{count}', String(validationResult.invalidRows.length))}
                </span>
                <p className="text-[11px] text-rose-600">
                  {lang === 'ar' ? 'صفوف غير صالحة لغياب رمز العينة.' : 'Rows missing mandatory identifier.'}
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(3)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {lang === 'ar' ? 'السابق' : 'Back'}
              </button>
              <button
                disabled={validationResult.validRows.length === 0 || importing}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {importing
                    ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Committing...')
                    : (lang === 'ar' ? 'اعتماد وحفظ السجلات في قاعدة البيانات' : 'Commit & Save to Database')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Completed */}
        {step === 5 && importSummary && (
          <div className="text-center py-8 space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                {lang === 'ar' ? 'اكتمل الاستيراد بنجاح!' : 'Import Completed Successfully!'}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {t.importExport.importSuccess.replace('{count}', String(importSummary.imported + importSummary.updated))}
              </p>
            </div>

            <div className="pt-3">
              <button
                onClick={resetImporter}
                className="rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-sky-700 shadow-sm"
              >
                {lang === 'ar' ? 'استيراد ملف آخر' : 'Import Another File'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
