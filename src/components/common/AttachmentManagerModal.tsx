import React, { useState, useEffect } from 'react';
import {
  FileArchive,
  Upload,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  HardDrive,
  Copy,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  saveAttachment,
  getAttachmentBlob,
  verifyAttachmentIntegrity,
  renameAttachment,
  archiveAttachment,
  replaceAttachmentVersion,
  isOPFSSupported,
} from '../../services/storageService';
import { db } from '../../db/pvtDb';
import { canCreateOrEdit } from '../../services/authService';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  requestConfirm,
} from '../../services/notificationService';
import { translations } from '../../i18n/translations';
import type {
  Language,
  LocalUser,
  AttachmentRecord,
  SampleRecord,
  AnalysisRecord,
  WellRecord,
  FieldRecord,
} from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: LocalUser | null;
  targetLinkedType?: AttachmentRecord['linkedType'];
  targetLinkedId?: string;
  onAttachmentChanged?: () => void;
}

export const AttachmentManagerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  targetLinkedType = 'Sample',
  targetLinkedId = '',
  onAttachmentChanged,
}) => {
  const t = translations[lang];

  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [wells, setWells] = useState<WellRecord[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);

  // Upload wizard states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedLinkedType, setSelectedLinkedType] = useState<AttachmentRecord['linkedType']>(targetLinkedType);
  const [selectedLinkedId, setSelectedLinkedId] = useState<string>(targetLinkedId);
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Active OPFS status
  const [opfsActive, setOpfsActive] = useState<boolean>(false);

  // Rename & Replace Version Modals
  const [renamingAttachment, setRenamingAttachment] = useState<AttachmentRecord | null>(null);
  const [newFileName, setNewFileName] = useState<string>('');
  const [replacingAttachment, setReplacingAttachment] = useState<AttachmentRecord | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<boolean>(false);

  // Integrity Check result
  const [integrityStatus, setIntegrityStatus] = useState<Record<string, { valid: boolean; hash: string }>>({});

  // Preview state
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      isOPFSSupported().then(setOpfsActive);
      setSelectedLinkedType(targetLinkedType);
      setSelectedLinkedId(targetLinkedId);
      setSelectedFiles([]);
      setUploadError(null);
      setUploadSuccess(null);
    }
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [isOpen, targetLinkedType, targetLinkedId]);

  const loadData = async () => {
    const [attList, smpList, wllList, anlList, fldList] = await Promise.all([
      db.attachments.toArray(),
      db.samples.toArray(),
      db.wells.toArray(),
      db.analysisRecords.toArray(),
      db.fields.toArray(),
    ]);

    setAttachments(attList);
    setSamples(smpList);
    setWells(wllList);
    setAnalyses(anlList);
    setFields(fldList);

    if (!selectedLinkedId && smpList.length > 0) {
      setSelectedLinkedId(smpList[0].id);
    }
  };

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      // Validate types and limits
      const allowedExts = ['pdf', 'xlsx', 'xls', 'csv', 'txt', 'png', 'jpg', 'jpeg'];
      const validFiles: File[] = [];
      let rejected = 0;

      filesArray.forEach(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        if (allowedExts.includes(ext)) {
          validFiles.push(f);
        } else {
          rejected++;
        }
      });

      if (rejected > 0) {
        notifyWarning(
          lang === 'ar'
            ? `تم استبعاد ${rejected} ملف بسبب نوع غير مدعوم. الأنواع المدعومة: PDF, Excel, CSV, صور.`
            : `Excluded ${rejected} unsupported file(s). Allowed: PDF, Excel, CSV, Images.`,
          lang === 'ar' ? 'نوع ملف غير مدعوم' : 'Unsupported File Type'
        );
      }

      setSelectedFiles(validFiles);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    if (!selectedLinkedId) {
      setUploadError(lang === 'ar' ? 'يرجى اختيار السجل المرتبط بالملف.' : 'Please select the linked entity.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let completedCount = 0;
      for (const file of selectedFiles) {
        await saveAttachment({
          file,
          fileName: file.name,
          linkedType: selectedLinkedType,
          linkedId: selectedLinkedId,
          sampleId: selectedLinkedType === 'Sample' ? selectedLinkedId : undefined,
          analysisId: selectedLinkedType === 'Analysis' ? selectedLinkedId : undefined,
          wellId: selectedLinkedType === 'Well' ? selectedLinkedId : undefined,
          fieldId: selectedLinkedType === 'Field' ? selectedLinkedId : undefined,
          description: uploadDescription.trim() || undefined,
          userId: currentUser?.id || 'USR',
          userName: currentUser?.fullName || 'User',
          onProgress: percent => {
            const overall = Math.round(((completedCount + percent / 100) / selectedFiles.length) * 100);
            setUploadProgress(overall);
          },
        });
        completedCount++;
      }

      setUploadSuccess(
        lang === 'ar'
          ? `تم حفظ وفحص ${completedCount} ملف بنجاح في التخزين المحلي الآمن.`
          : `Successfully saved and verified ${completedCount} file(s) in local storage.`
      );
      setSelectedFiles([]);
      setUploadDescription('');
      await loadData();
      if (onAttachmentChanged) onAttachmentChanged();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenPreview = async (att: AttachmentRecord) => {
    try {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const blob = await getAttachmentBlob(att.id);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setPreviewAttachment(att);
    } catch (err: any) {
      notifyError(
        'Could not preview file: ' + err.message,
        lang === 'ar' ? 'خطأ في المعاينة' : 'Preview Error'
      );
    }
  };

  const handleDownload = async (att: AttachmentRecord) => {
    try {
      const blob = await getAttachmentBlob(att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
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

  const handleVerifyIntegrity = async (att: AttachmentRecord) => {
    try {
      const result = await verifyAttachmentIntegrity(att.id);
      setIntegrityStatus(prev => ({
        ...prev,
        [att.id]: { valid: result.valid, hash: result.calculatedChecksum },
      }));
      if (result.valid) {
        notifySuccess(
          lang === 'ar'
            ? `الملف سليم ومطابق لبصمة SHA-256 بنجاح (${result.calculatedChecksum.substring(0, 12)}...)`
            : `File verified intact via SHA-256 (${result.calculatedChecksum.substring(0, 12)}...)`,
          lang === 'ar' ? 'فحص السلامة الرقمية' : 'Integrity Verified'
        );
      } else {
        notifyError(
          lang === 'ar'
            ? 'تحذير: عدم تطابق بصمة التشفير مع الأصل!'
            : 'Warning: Cryptographic checksum mismatch!',
          lang === 'ar' ? 'فشل فحص السلامة' : 'Integrity Mismatch'
        );
      }
    } catch (err: any) {
      notifyError(
        'Integrity check failed: ' + err.message,
        lang === 'ar' ? 'فحص السلامة' : 'Integrity Check'
      );
    }
  };

  const handleExecuteRename = async () => {
    if (!renamingAttachment || !newFileName.trim()) return;
    try {
      await renameAttachment(
        renamingAttachment.id,
        newFileName.trim(),
        currentUser?.id || 'USR',
        currentUser?.fullName || 'User'
      );
      setRenamingAttachment(null);
      await loadData();
      if (onAttachmentChanged) onAttachmentChanged();
      notifySuccess(
        lang === 'ar' ? 'تمت إعادة تسمية المرفق بنجاح.' : 'File renamed successfully.',
        lang === 'ar' ? 'إعادة التسمية' : 'Rename Successful'
      );
    } catch (err: any) {
      notifyError(
        'Rename failed: ' + err.message,
        lang === 'ar' ? 'خطأ في إعادة التسمية' : 'Rename Failed'
      );
    }
  };

  const handleExecuteVersionReplacement = async () => {
    if (!replacingAttachment || !replacementFile || !confirmReplace) return;
    try {
      await replaceAttachmentVersion(
        replacingAttachment.id,
        replacementFile,
        currentUser?.id || 'USR',
        currentUser?.fullName || 'User'
      );
      setReplacingAttachment(null);
      setReplacementFile(null);
      setConfirmReplace(false);
      await loadData();
      if (onAttachmentChanged) onAttachmentChanged();
      notifySuccess(
        lang === 'ar' ? 'تم استبدال ورفع إصدار جديد بنجاح.' : 'New file version uploaded successfully.',
        lang === 'ar' ? 'تحديث الإصدار' : 'Version Updated'
      );
    } catch (err: any) {
      notifyError(
        'Version replacement failed: ' + err.message,
        lang === 'ar' ? 'خطأ في تحديث الإصدار' : 'Version Update Failed'
      );
    }
  };

  const handleToggleArchive = (att: AttachmentRecord) => {
    const action = !att.isArchived;
    requestConfirm({
      title: lang === 'ar' ? (action ? 'أرشفة المرفق' : 'استعادة المرفق') : (action ? 'Archive Attachment' : 'Restore Attachment'),
      message:
        lang === 'ar'
          ? `هل ترغب في ${action ? 'أرشفة' : 'استعادة'} هذا المرفق: "${att.fileName}"؟`
          : `Do you want to ${action ? 'archive' : 'restore'} attachment: "${att.fileName}"?`,
      confirmText: lang === 'ar' ? (action ? 'أرشفة' : 'استعادة') : (action ? 'Archive' : 'Restore'),
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: action,
      onConfirm: async () => {
        await archiveAttachment(
          att.id,
          action,
          currentUser?.id || 'USR',
          currentUser?.fullName || 'User'
        );
        await loadData();
        if (onAttachmentChanged) onAttachmentChanged();
        notifySuccess(
          lang === 'ar'
            ? `تم ${action ? 'أرشفة' : 'استعادة'} المرفق بنجاح.`
            : `Attachment ${action ? 'archived' : 'restored'} successfully.`
        );
      },
    });
  };

  // Filter attachments for current view
  const visibleAttachments = attachments.filter(a => {
    if (targetLinkedId) {
      return a.linkedId === targetLinkedId;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base">
                {lang === 'ar' ? 'إدارة المرفقات والملفات الفنية (OPFS & IndexedDB)' : 'Technical Attachments & Vault Manager'}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>
                  {opfsActive
                    ? (lang === 'ar' ? 'نظام الملفات الخاص OPFS مفعل' : 'OPFS Hardware Storage Active')
                    : (lang === 'ar' ? 'تخزين IndexedDB Blob مفعل' : 'IndexedDB Blob Storage Active')}
                </span>
                <span>•</span>
                <span className="font-mono text-emerald-400">SHA-256 Verified</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Notifications */}
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* Add Attachment Section */}
          {canCreateOrEdit(currentUser) && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-600" />
                  <span>{lang === 'ar' ? 'إضافة ملفات ومرفقات جديدة (Add Attachments)' : 'Add New Attachments'}</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  {lang === 'ar' ? 'يدعم عدة ملفات مع التحقق الفوري' : 'Multi-file supported with SHA-256 verification'}
                </span>
              </div>

              {/* Selection inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'نوع السجل المرتبط:' : 'Link to Record Type:'}
                  </label>
                  <select
                    value={selectedLinkedType}
                    onChange={e => setSelectedLinkedType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="Sample">{lang === 'ar' ? 'عينة مكمنية (Sample)' : 'Sample'}</option>
                    <option value="Analysis">{lang === 'ar' ? 'تحليل مخبري (Analysis)' : 'Analysis'}</option>
                    <option value="Well">{lang === 'ar' ? 'بئر (Well)' : 'Well'}</option>
                    <option value="Field">{lang === 'ar' ? 'حقل (Field)' : 'Field'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'السجل المحدد:' : 'Target Entity:'}
                  </label>
                  <select
                    value={selectedLinkedId}
                    onChange={e => setSelectedLinkedId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {selectedLinkedType === 'Sample' &&
                      samples.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.sampleCode} ({s.fluidType})
                        </option>
                      ))}
                    {selectedLinkedType === 'Analysis' &&
                      analyses.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.reportNumber} ({a.testType})
                        </option>
                      ))}
                    {selectedLinkedType === 'Well' &&
                      wells.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    {selectedLinkedType === 'Field' &&
                      fields.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Multi file drop area */}
              <div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
                  onChange={handleFilesSelected}
                  className="w-full rounded-xl border border-dashed border-sky-300 p-3 bg-white text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white file:font-semibold hover:file:bg-sky-700 cursor-pointer"
                />
              </div>

              {/* Preview selected files before saving */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 text-[11px]">
                    {lang === 'ar' ? 'الملفات المحددة قبل الحفظ:' : 'Files selected for commit:'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 truncate block">{f.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {Math.round(f.size / 1024)} KB • {f.type || 'binary'}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={e => setUploadDescription(e.target.value)}
                    placeholder={lang === 'ar' ? 'وصف اختياري للملفات (Description)...' : 'Optional description for files...'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              )}

              {/* Progress bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-sky-800">
                    <span>{lang === 'ar' ? 'جارٍ المعالجة وحساب البصمة الرقمية...' : 'Computing SHA-256 & writing storage...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-sky-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    disabled={isUploading}
                    onClick={handleUploadFiles}
                    className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploading
                        ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                        : (lang === 'ar' ? `حفظ وفحص (${selectedFiles.length}) ملف` : `Commit (${selectedFiles.length}) Files`)}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stored Attachments List */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-600" />
              <span>
                {lang === 'ar' ? 'الملفات المخزنة في النظام:' : 'Stored Archive Files in System:'} ({visibleAttachments.length})
              </span>
            </h4>

            {visibleAttachments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                {lang === 'ar' ? 'لا توجد مرفقات مخزنة لهذا السجل حتى الآن.' : 'No attachments stored for this record yet.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleAttachments.map(att => {
                  const isPdf = att.fileType.includes('pdf') || att.fileName.endsWith('.pdf');
                  const integrity = integrityStatus[att.id];

                  return (
                    <div
                      key={att.id}
                      className={`p-4 rounded-2xl border transition bg-white space-y-2.5 ${
                        att.isArchived ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2.5 rounded-xl ${
                              isPdf ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                          >
                            {isPdf ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{att.fileName}</span>
                              <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] font-bold">
                                v{att.version}
                              </span>
                              <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-mono">
                                {att.storageBackend}
                              </span>
                              {att.isArchived && (
                                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold">
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{Math.round(att.fileSize / 1024)} KB</span>
                              <span>•</span>
                              <span>{att.uploadDate.substring(0, 10)}</span>
                              <span>•</span>
                              <span title={`SHA-256: ${att.checksum}`}>
                                SHA: {att.checksum ? att.checksum.substring(0, 12) + '...' : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions: Preview, Download, Integrity, Rename, Version, Archive */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isPdf && (
                            <button
                              onClick={() => handleOpenPreview(att)}
                              className="rounded-lg bg-sky-50 text-sky-700 px-2.5 py-1 font-semibold hover:bg-sky-100 transition flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t.actions.preview}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDownload(att)}
                            className="rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1 font-semibold hover:bg-slate-200 transition flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{t.actions.download}</span>
                          </button>

                          <button
                            onClick={() => handleVerifyIntegrity(att)}
                            className="rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50 transition"
                            title="Verify SHA-256 Integrity"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          {canCreateOrEdit(currentUser) && (
                            <>
                              <button
                                onClick={() => {
                                  setRenamingAttachment(att);
                                  setNewFileName(att.fileName);
                                }}
                                className="rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50 transition"
                                title="Rename File"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setReplacingAttachment(att);
                                  setReplacementFile(null);
                                  setConfirmReplace(false);
                                }}
                                className="rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50 transition"
                                title="Upload New Version"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleArchive(att)}
                                className="rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50 transition"
                                title={att.isArchived ? 'Restore' : 'Archive'}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Integrity result banner if tested */}
                      {integrity && (
                        <div
                          className={`p-2 rounded-xl text-[11px] font-mono flex items-center justify-between ${
                            integrity.valid
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-sans font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {lang === 'ar' ? 'تم فحص سلامة الملف بنجاح (مطابق تماماً)' : 'Integrity Verified (Exact SHA-256 match)'}
                          </span>
                          <span className="text-[10px] text-slate-500">{integrity.hash}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
          >
            {t.actions.close}
          </button>
        </div>
      </div>

      {/* Rename Modal */}
      {renamingAttachment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">{lang === 'ar' ? 'إعادة تسمية الملف' : 'Rename Attachment'}</h4>
            <input
              type="text"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setRenamingAttachment(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {t.actions.cancel}
              </button>
              <button
                onClick={handleExecuteRename}
                className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
              >
                {t.actions.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Version Modal */}
      {replacingAttachment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-sm text-slate-900">
                {lang === 'ar' ? `رفع إصدار جديد لـ (${replacingAttachment.fileName})` : `Upload New Version for ${replacingAttachment.fileName}`}
              </h4>
              <button onClick={() => setReplacingAttachment(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              {lang === 'ar'
                ? `سيتم حفظ الإصدار الجديد برقم v${replacingAttachment.version + 1}، مع أرشفة الإصدار السابق تلقائياً وعدم حذفه لضمان سلامة السجلات.`
                : `A new version (v${replacingAttachment.version + 1}) will be stored, and previous version will be preserved in the archive without data loss.`}
            </p>

            <input
              type="file"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setReplacementFile(e.target.files[0]);
                }
              }}
              className="w-full rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50"
            />

            <label className="flex items-center gap-2 cursor-pointer font-bold text-sky-900">
              <input
                type="checkbox"
                checked={confirmReplace}
                onChange={e => setConfirmReplace(e.target.checked)}
                className="rounded text-sky-600"
              />
              <span>{lang === 'ar' ? 'أوافق على اعتماد هذا الإصدار الجديد' : 'I confirm this new version upload'}</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setReplacingAttachment(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                {t.actions.cancel}
              </button>
              <button
                disabled={!replacementFile || !confirmReplace}
                onClick={handleExecuteVersionReplacement}
                className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-sky-700"
              >
                {lang === 'ar' ? 'تأكيد رفع الإصدار الجديد' : 'Commit New Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App PDF Preview Overlay */}
      {previewAttachment && previewBlobUrl && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-4xl h-[88vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-sm">{previewAttachment.fileName}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Math.round(previewAttachment.fileSize / 1024)} KB • {previewAttachment.storageBackend} Verified
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
                  onClick={() => {
                    setPreviewAttachment(null);
                    setPreviewBlobUrl(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

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
    </div>
  );
};
