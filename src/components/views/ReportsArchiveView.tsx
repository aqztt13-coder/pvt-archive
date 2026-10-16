import React, { useState, useEffect } from 'react';
import {
  FileArchive,
  Upload,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  HardDrive,
  Trash2,
  X,
  Plus,
} from 'lucide-react';
import { db, logAuditEvent } from '../../db/pvtDb';
import { canCreateOrEdit } from '../../services/authService';
import { getAttachmentBlob, saveAttachment } from '../../services/storageService';
import { notifySuccess, notifyError } from '../../services/notificationService';
import { AttachmentManagerModal } from '../common/AttachmentManagerModal';
import { translations } from '../../i18n/translations';
import type {
  Language,
  LocalUser,
  ReportRecord,
  AttachmentRecord,
  SampleRecord,
  WellRecord,
} from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
  targetReportId?: string | null;
}

export const ReportsArchiveView: React.FC<Props> = ({
  lang,
  currentUser,
  targetReportId,
}) => {
  const t = translations[lang];

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [wells, setWells] = useState<WellRecord[]>([]);

  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);

  // Upload Form
  const [fReportNumber, setFReportNumber] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().substring(0, 10));
  const [fLab, setFLab] = useState('Central Reservoir Fluids Core Laboratory');
  const [fLinkedType, setFLinkedType] = useState<ReportRecord['linkedType']>('Sample');
  const [fLinkedId, setFLinkedId] = useState('');
  const [fFile, setFFile] = useState<File | null>(null);
  const [fRemarks, setFRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (targetReportId && reports.length > 0) {
      const found = reports.find(r => r.id === targetReportId);
      if (found) {
        setSelectedReport(found);
        // Find attached pdf to preview
        const att = attachments.find(a => a.reportId === found.id);
        if (att) openPreview(att);
      }
    }
  }, [targetReportId, reports, attachments]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const loadData = async () => {
    const [reps, atts, smps, wlls] = await Promise.all([
      db.reports.toArray(),
      db.attachments.toArray(),
      db.samples.toArray(),
      db.wells.toArray(),
    ]);

    setReports(reps);
    setAttachments(atts);
    setSamples(smps);
    setWells(wlls);

    if (smps.length > 0 && !fLinkedId) {
      setFLinkedId(smps[0].id);
    }
  };

  const openPreview = async (attachment: AttachmentRecord) => {
    try {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      const blob = await getAttachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      setPreviewAttachment(attachment);
      setPreviewBlobUrl(url);
    } catch (err: any) {
      notifyError(
        'Could not preview file: ' + err.message,
        lang === 'ar' ? 'خطأ في المعاينة' : 'Preview Error'
      );
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewAttachment(null);
    setPreviewBlobUrl(null);
  };

  const handleDownload = async (attachment: AttachmentRecord) => {
    try {
      const blob = await getAttachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notifyError(
        'Download error: ' + err.message,
        lang === 'ar' ? 'خطأ في التنزيل' : 'Download Error'
      );
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fFile) return;

    const reportId = `REP-${Date.now()}`;
    const now = new Date().toISOString();

    const newReport: ReportRecord = {
      id: reportId,
      reportNumber: fReportNumber.trim(),
      title: fTitle.trim(),
      reportDate: fDate,
      laboratory: fLab.trim(),
      status: 'Final',
      linkedType: fLinkedType,
      linkedId: fLinkedId,
      remarks: fRemarks.trim() || undefined,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.reports.add(newReport);

    await saveAttachment({
      file: fFile,
      fileName: fFile.name,
      reportId,
      linkedType: fLinkedType,
      linkedId: fLinkedId,
      sampleId: fLinkedType === 'Sample' ? fLinkedId : undefined,
      wellId: fLinkedType === 'Well' ? fLinkedId : undefined,
      description: fTitle.trim(),
      reportNumber: fReportNumber.trim(),
      userId: currentUser?.id || 'USR',
      userName: currentUser?.fullName || 'User',
    });

    await loadData();
    setShowUploadModal(false);
    setFFile(null);
    notifySuccess(
      lang === 'ar' ? 'تم حفظ وأرشفة التقرير والمرفق بنجاح.' : 'Report and attachment archived successfully.'
    );
  };

  const filteredReports = reports.filter(r => {
    if (r.isArchived) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.reportNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.laboratory.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.reports.title}</h2>
          <p className="text-xs text-slate-500">{t.reports.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManagerModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-600" />
            <span>{lang === 'ar' ? 'إدارة المرفقات الكاملة' : 'Manage All Vault Files'}</span>
          </button>

          {canCreateOrEdit(currentUser) && (
            <button
              onClick={() => {
                setFReportNumber(`PVT-REP-${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`);
                setFTitle('');
                setFFile(null);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <Upload className="w-4 h-4" />
              <span>{t.reports.uploadReport}</span>
            </button>
          )}
        </div>
      </div>

      {/* Storage and Security Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-sky-400 shrink-0" />
          <div>
            <div className="font-bold">
              {lang === 'ar' ? 'التخزين المحلي الآمن للوثائق والمرفقات' : 'Sovereign Offline Technical File Vault'}
            </div>
            <p className="text-slate-400 text-[11px]">
              {t.reports.fileStoredLocally}
            </p>
          </div>
        </div>
        <span className="rounded-lg bg-sky-500/20 text-sky-300 px-2.5 py-1 text-[11px] font-semibold border border-sky-500/30">
          {attachments.length} {lang === 'ar' ? 'ملفات مخزنة' : 'Stored Files'}
        </span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'ar' ? 'ابحث برقم التقرير أو العنوان...' : 'Search reports by number or title...'}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-9 text-xs text-slate-800 focus:border-sky-500 focus:outline-none shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
      </div>

      {/* Reports Archive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map(report => {
          const reportAttachments = attachments.filter(a => a.reportId === report.id);
          const isPdf = reportAttachments.some(a => a.fileType.includes('pdf') || a.fileName.endsWith('.pdf'));

          return (
            <div
              key={report.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isPdf ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}
                  >
                    {isPdf ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{report.reportNumber}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{report.reportDate}</span>
                  </div>
                </div>

                <span className="rounded bg-sky-50 text-sky-800 px-2 py-0.5 text-[10px] font-semibold border border-sky-100">
                  {report.status}
                </span>
              </div>

              <div>
                <h5 className="font-semibold text-slate-800 text-xs line-clamp-2">{report.title}</h5>
                <p className="text-[11px] text-slate-500 mt-1">{report.laboratory}</p>
              </div>

              {/* Attachments pills */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {reportAttachments.map(att => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[200px]">
                      <span className="font-medium truncate text-slate-800">{att.fileName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({Math.round(att.fileSize / 1024)} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(att.fileType.includes('pdf') || att.fileName.endsWith('.pdf')) && (
                        <button
                          onClick={() => openPreview(att)}
                          className="p-1 rounded-md text-sky-600 hover:bg-sky-100 transition"
                          title={t.reports.previewPdf}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(att)}
                        className="p-1 rounded-md text-slate-600 hover:bg-slate-200 transition"
                        title={t.reports.downloadFile}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* In-App PDF Preview Modal */}
      {previewAttachment && previewBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-4xl h-[88vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-sm">{previewAttachment.fileName}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Math.round(previewAttachment.fileSize / 1024)} KB • Local Offline Blob
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewAttachment)}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.reports.downloadFile}</span>
                </button>
                <button
                  onClick={closePreview}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Native Browser PDF Object (100% Offline) */}
            <div className="flex-1 bg-slate-100 p-2 overflow-hidden">
              <object
                data={previewBlobUrl}
                type="application/pdf"
                className="w-full h-full rounded-xl border border-slate-300 bg-white"
              >
                <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
                  <FileText className="w-12 h-12 text-slate-400" />
                  <p className="text-xs text-slate-600 max-w-md">
                    {t.reports.noPreviewAvailable}
                  </p>
                  <button
                    onClick={() => handleDownload(previewAttachment)}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {t.reports.downloadFile}
                  </button>
                </div>
              </object>
            </div>
          </div>
        </div>
      )}

      {/* Upload Technical Report Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">{t.reports.uploadReport}</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.reports.reportNumber} *</label>
                  <input
                    type="text"
                    required
                    value={fReportNumber}
                    onChange={e => setFReportNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.reports.reportDate} *</label>
                  <input
                    type="date"
                    required
                    value={fDate}
                    onChange={e => setFDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.reports.reportTitle} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full PVT Laboratory Report Mishrif Well NR-142"
                  value={fTitle}
                  onChange={e => setFTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.reports.laboratory} *</label>
                  <input
                    type="text"
                    required
                    value={fLab}
                    onChange={e => setFLab(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.reports.linkedEntity}</label>
                  <select
                    value={fLinkedId}
                    onChange={e => setFLinkedId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {samples.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} ({s.fluidType})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'حدد ملف PDF أو Excel:' : 'Select PDF or Excel File:'} *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.xlsx,.xls"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setFFile(e.target.files[0]);
                    }
                  }}
                  className="w-full rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white file:font-semibold hover:file:bg-sky-700"
                />
                {fFile && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    ✓ {fFile.name} ({Math.round(fFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.samples.remarks}</label>
                <textarea
                  rows={2}
                  value={fRemarks}
                  onChange={e => setFRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!fFile}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm disabled:opacity-50"
                >
                  {t.actions.upload}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Manager Modal */}
      <AttachmentManagerModal
        isOpen={showManagerModal}
        onClose={() => setShowManagerModal(false)}
        lang={lang}
        currentUser={currentUser}
        onAttachmentChanged={loadData}
      />
    </div>
  );
};
