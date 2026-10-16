import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Activity,
  FileArchive,
  Calendar,
  Layers,
  MapPin,
  GitCommit,
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  Upload,
  Download,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { db, logAuditEvent } from '../../db/pvtDb';
import { canCreateOrEdit } from '../../services/authService';
import { getAttachmentBlob } from '../../services/storageService';
import { notifySuccess, notifyError } from '../../services/notificationService';
import { AttachmentManagerModal } from '../common/AttachmentManagerModal';
import { translations } from '../../i18n/translations';
import type {
  Language,
  LocalUser,
  SampleRecord,
  AnalysisRecord,
  ReportRecord,
  AttachmentRecord,
  FieldRecord,
  ReservoirRecord,
  FormationRecord,
  WellRecord,
  FluidType,
  SampleType,
  SampleStatus,
} from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
  selectedSampleIdForDetail?: string | null;
  onClearSelectedDetail?: () => void;
  onOpenReport?: (reportId: string) => void;
}

export const SamplesView: React.FC<Props> = ({
  lang,
  currentUser,
  selectedSampleIdForDetail,
  onClearSelectedDetail,
  onOpenReport,
}) => {
  const t = translations[lang];

  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [reservoirs, setReservoirs] = useState<ReservoirRecord[]>([]);
  const [formations, setFormations] = useState<FormationRecord[]>([]);
  const [wells, setWells] = useState<WellRecord[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);

  const [search, setSearch] = useState('');
  const [filterFluid, setFilterFluid] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showAttachManager, setShowAttachManager] = useState(false);
  const [editItem, setEditItem] = useState<SampleRecord | null>(null);
  const [detailItem, setDetailItem] = useState<SampleRecord | null>(null);

  // Form Fields
  const [fCode, setFCode] = useState('');
  const [fFieldId, setFFieldId] = useState('');
  const [fReservoirId, setFReservoirId] = useState('');
  const [fFormationId, setFFormationId] = useState('');
  const [fWellId, setFWellId] = useState('');
  const [fFluidType, setFFluidType] = useState<FluidType>('Black Oil');
  const [fSampleType, setFSampleType] = useState<SampleType>('Bottom Hole');
  const [fDate, setFDate] = useState(new Date().toISOString().substring(0, 10));
  const [fMethod, setFMethod] = useState('');
  const [fDepth, setFDepth] = useState<number | ''>('');
  const [fPressure, setFPressure] = useState<number | ''>('');
  const [fTemp, setFTemp] = useState<number | ''>('');
  const [fCylinder, setFCylinder] = useState('');
  const [fSource, setFSource] = useState('');
  const [fTransport, setFTransport] = useState('');
  const [fResPressure, setFResPressure] = useState<number | ''>('');
  const [fResTemp, setFResTemp] = useState<number | ''>('');
  const [fSatPressure, setFSatPressure] = useState<number | ''>('');
  const [fStatus, setFStatus] = useState<SampleStatus>('Valid');
  const [fQualityNotes, setFQualityNotes] = useState('');
  const [fRemarks, setFRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSampleIdForDetail && samples.length > 0) {
      const found = samples.find(s => s.id === selectedSampleIdForDetail);
      if (found) setDetailItem(found);
    }
  }, [selectedSampleIdForDetail, samples]);

  const loadData = async () => {
    const [s, f, r, fm, w, a, rep, att] = await Promise.all([
      db.samples.toArray(),
      db.fields.toArray(),
      db.reservoirs.toArray(),
      db.formations.toArray(),
      db.wells.toArray(),
      db.analysisRecords.toArray(),
      db.reports.toArray(),
      db.attachments.toArray(),
    ]);

    setSamples(s);
    setFields(f);
    setReservoirs(r);
    setFormations(fm);
    setWells(w);
    setAnalyses(a);
    setReports(rep);
    setAttachments(att);

    if (f.length > 0 && !fFieldId) setFFieldId(f[0].id);
    if (r.length > 0 && !fReservoirId) setFReservoirId(r[0].id);
    if (w.length > 0 && !fWellId) setFWellId(w[0].id);
  };

  const handleDownloadAttachment = async (att: AttachmentRecord) => {
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
      notifySuccess(
        lang === 'ar' ? `بدأ تنزيل ${att.fileName}` : `Downloading ${att.fileName}`
      );
    } catch (err: any) {
      notifyError('Download error: ' + err.message);
    }
  };

  const openForm = (item?: SampleRecord) => {
    setEditItem(item || null);
    if (item) {
      setFCode(item.sampleCode);
      setFFieldId(item.fieldId);
      setFReservoirId(item.reservoirId);
      setFFormationId(item.formationId || '');
      setFWellId(item.wellId);
      setFFluidType(item.fluidType);
      setFSampleType(item.sampleType);
      setFDate(item.samplingDate);
      setFMethod(item.samplingMethod || '');
      setFDepth(item.samplingDepth ?? '');
      setFPressure(item.samplingPressure ?? '');
      setFTemp(item.samplingTemperature ?? '');
      setFCylinder(item.cylinderNumber || '');
      setFSource(item.sampleSource || '');
      setFTransport(item.transportCondition || '');
      setFResPressure(item.reservoirPressure ?? '');
      setFResTemp(item.reservoirTemperature ?? '');
      setFSatPressure(item.saturationPressure ?? '');
      setFStatus(item.sampleStatus);
      setFQualityNotes(item.qualityNotes || '');
      setFRemarks(item.remarks || '');
    } else {
      setFCode(`SMP-${new Date().getFullYear()}-${String(samples.length + 1).padStart(3, '0')}`);
      setFFieldId(fields[0]?.id || '');
      setFReservoirId(reservoirs[0]?.id || '');
      setFFormationId(formations[0]?.id || '');
      setFWellId(wells[0]?.id || '');
      setFFluidType('Black Oil');
      setFSampleType('Bottom Hole');
      setFDate(new Date().toISOString().substring(0, 10));
      setFMethod('Wireline Formation Tester Chamber');
      setFDepth('');
      setFPressure('');
      setFTemp('');
      setFCylinder('');
      setFSource('');
      setFTransport('');
      setFResPressure('');
      setFResTemp('');
      setFSatPressure('');
      setFStatus('Valid');
      setFQualityNotes('');
      setFRemarks('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const id = editItem ? editItem.id : `SMP-${Date.now()}`;

    const record: SampleRecord = {
      id,
      sampleCode: fCode.trim(),
      fieldId: fFieldId || fields[0]?.id || '',
      reservoirId: fReservoirId || reservoirs[0]?.id || '',
      formationId: fFormationId || undefined,
      wellId: fWellId || wells[0]?.id || '',
      fluidType: fFluidType,
      sampleType: fSampleType,
      samplingDate: fDate,
      samplingMethod: fMethod.trim(),
      samplingDepth: fDepth !== '' ? Number(fDepth) : undefined,
      samplingPressure: fPressure !== '' ? Number(fPressure) : undefined,
      samplingTemperature: fTemp !== '' ? Number(fTemp) : undefined,
      cylinderNumber: fCylinder.trim() || undefined,
      sampleSource: fSource.trim() || undefined,
      transportCondition: fTransport.trim() || undefined,
      reservoirPressure: fResPressure !== '' ? Number(fResPressure) : undefined,
      reservoirTemperature: fResTemp !== '' ? Number(fResTemp) : undefined,
      saturationPressure: fSatPressure !== '' ? Number(fSatPressure) : undefined,
      sampleStatus: fStatus,
      qualityNotes: fQualityNotes.trim() || undefined,
      remarks: fRemarks.trim() || undefined,
      isArchived: editItem ? editItem.isArchived : false,
      createdAt: editItem ? editItem.createdAt : now,
      updatedAt: now,
    };

    await db.samples.put(record);

    await logAuditEvent({
      userId: currentUser?.id || 'USR',
      userName: currentUser?.fullName || 'User',
      actionType: editItem ? 'UPDATE_RECORD' : 'CREATE_RECORD',
      entityType: 'Sample',
      entityId: id,
      details: `${editItem ? 'Updated' : 'Registered'} sample ${record.sampleCode}`,
    });

    await loadData();
    setShowModal(false);
  };

  const filteredSamples = samples.filter(s => {
    if (s.isArchived) return false;
    if (filterFluid !== 'ALL' && s.fluidType !== filterFluid) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const w = wells.find(x => x.id === s.wellId)?.name || '';
      return s.sampleCode.toLowerCase().includes(q) || w.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.samples.title}</h2>
          <p className="text-xs text-slate-500">{t.samples.subtitle}</p>
        </div>

        {canCreateOrEdit(currentUser) && (
          <button
            onClick={() => openForm()}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.samples.addSample}</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث برمز العينة أو اسم البئر...' : 'Search by code or well...'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pl-9 text-xs text-slate-800 focus:bg-white focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={filterFluid}
            onChange={e => setFilterFluid(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none"
          >
            <option value="ALL">{t.pvtIndex.allFluids}</option>
            <option value="Black Oil">Black Oil</option>
            <option value="Volatile Oil">Volatile Oil</option>
            <option value="Gas Condensate">Gas Condensate</option>
            <option value="Wet Gas">Wet Gas</option>
            <option value="Dry Gas">Dry Gas</option>
            <option value="Heavy Oil">Heavy Oil</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {lang === 'ar'
            ? `إجمالي العينات: ${filteredSamples.length}`
            : `Total Samples: ${filteredSamples.length}`}
        </span>
      </div>

      {/* Samples Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSamples.map(sample => {
          const well = wells.find(w => w.id === sample.wellId);
          const field = fields.find(f => f.id === sample.fieldId);
          const res = reservoirs.find(r => r.id === sample.reservoirId);
          const sampleAnalyses = analyses.filter(a => a.sampleId === sample.id);

          return (
            <div
              key={sample.id}
              onClick={() => setDetailItem(sample)}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md cursor-pointer transition hover:border-sky-300 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{sample.sampleCode}</h4>
                    <span className="font-mono text-xs font-semibold text-sky-700">
                      {well?.name || '—'}
                    </span>
                  </div>
                </div>

                <span className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                  {sample.sampleStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.samples.fluidType}</span>
                  <span className="font-semibold text-slate-800">{sample.fluidType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.samples.sampleType}</span>
                  <span className="font-semibold text-slate-800">{sample.sampleType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.samples.field} / {t.samples.reservoir}</span>
                  <span className="font-medium text-slate-700 truncate block">
                    {field?.name?.split(' ')[0]} - {res?.name?.split(' ')[0]}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.samples.samplingDate}</span>
                  <span className="font-mono text-slate-700">{sample.samplingDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>
                  {sampleAnalyses.length} {lang === 'ar' ? 'تحاليل مخبرية مرتبطة' : 'PVT Studies Linked'}
                </span>
                <span className="text-sky-600 font-bold hover:underline flex items-center gap-0.5">
                  <span>{t.actions.view}</span>
                  {lang === 'ar' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Sample Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editItem ? (lang === 'ar' ? 'تعديل بيانات العينة' : 'Edit Sample Record') : t.samples.addSample}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.sampleCode} *</label>
                  <input
                    type="text"
                    required
                    value={fCode}
                    onChange={e => setFCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.fluidType} *</label>
                  <select
                    value={fFluidType}
                    onChange={e => setFFluidType(e.target.value as FluidType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Black Oil">Black Oil (نفط أسود)</option>
                    <option value="Volatile Oil">Volatile Oil (نفط متطاير)</option>
                    <option value="Gas Condensate">Gas Condensate (متكثف غازي)</option>
                    <option value="Wet Gas">Wet Gas (غاز رطب)</option>
                    <option value="Dry Gas">Dry Gas (غاز جاف)</option>
                    <option value="Heavy Oil">Heavy Oil (نفط ثقيل)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.field} *</label>
                  <select
                    value={fFieldId}
                    onChange={e => setFFieldId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.reservoir} *</label>
                  <select
                    value={fReservoirId}
                    onChange={e => setFReservoirId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {reservoirs.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.well} *</label>
                  <select
                    value={fWellId}
                    onChange={e => setFWellId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {wells.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.sampleType} *</label>
                  <select
                    value={fSampleType}
                    onChange={e => setFSampleType(e.target.value as SampleType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Bottom Hole">Bottom Hole (قعر البئر)</option>
                    <option value="Separator Liquid">Separator Liquid (سائل العازلة)</option>
                    <option value="Separator Gas">Separator Gas (غاز العازلة)</option>
                    <option value="Wellhead">Wellhead (رأس البئر)</option>
                    <option value="Recombined">Recombined (معاد تركيبها)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.samplingDate} *</label>
                  <input
                    type="date"
                    required
                    value={fDate}
                    onChange={e => setFDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.sampleStatus} *</label>
                  <select
                    value={fStatus}
                    onChange={e => setFStatus(e.target.value as SampleStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Valid">Valid (صالحة ومعتمدة)</option>
                    <option value="Questionable">Questionable (موضع شك)</option>
                    <option value="Contaminated">Contaminated (ملوثة)</option>
                    <option value="Depleted">Depleted (مستنفذة)</option>
                    <option value="Pending Analysis">Pending Analysis (قيد التحليل)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.samplingDepth}</label>
                  <input
                    type="number"
                    value={fDepth}
                    onChange={e => setFDepth(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.samplingPressure}</label>
                  <input
                    type="number"
                    value={fPressure}
                    onChange={e => setFPressure(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.samplingTemp}</label>
                  <input
                    type="number"
                    value={fTemp}
                    onChange={e => setFTemp(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.cylinderNo}</label>
                  <input
                    type="text"
                    value={fCylinder}
                    onChange={e => setFCylinder(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.samplingMethod}</label>
                  <input
                    type="text"
                    value={fMethod}
                    onChange={e => setFMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.resPressure}</label>
                  <input
                    type="number"
                    value={fResPressure}
                    onChange={e => setFResPressure(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.resTemp}</label>
                  <input
                    type="number"
                    value={fResTemp}
                    onChange={e => setFResTemp(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.samples.satPressure}</label>
                  <input
                    type="number"
                    value={fSatPressure}
                    onChange={e => setFSatPressure(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.samples.qualityNotes}</label>
                <textarea
                  rows={2}
                  value={fQualityNotes}
                  onChange={e => setFQualityNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
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
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm"
                >
                  {t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Detailed View Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-100 text-sky-700 font-bold">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {detailItem.sampleCode}
                    </h3>
                    <span className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 text-xs font-semibold border border-emerald-200">
                      {detailItem.sampleStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {wells.find(w => w.id === detailItem.wellId)?.name} • {fields.find(f => f.id === detailItem.fieldId)?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canCreateOrEdit(currentUser) && (
                  <button
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      openForm(item);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{t.actions.edit}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setDetailItem(null);
                    if (onClearSelectedDetail) onClearSelectedDetail();
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Technical Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.fluidType}</span>
                <span className="font-bold text-slate-900">{detailItem.fluidType}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.sampleType}</span>
                <span className="font-bold text-slate-900">{detailItem.sampleType}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.samplingDate}</span>
                <span className="font-bold font-mono text-slate-900">{detailItem.samplingDate}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.samplingDepth}</span>
                <span className="font-bold text-slate-900">
                  {detailItem.samplingDepth ? `${detailItem.samplingDepth} ft` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.samplingPressure}</span>
                <span className="font-bold text-slate-900">
                  {detailItem.samplingPressure ? `${detailItem.samplingPressure} psi` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.samplingTemp}</span>
                <span className="font-bold text-slate-900">
                  {detailItem.samplingTemperature ? `${detailItem.samplingTemperature} °F` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.cylinderNo}</span>
                <span className="font-mono text-slate-800">{detailItem.cylinderNumber || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.resPressure}</span>
                <span className="font-bold text-sky-800">
                  {detailItem.reservoirPressure ? `${detailItem.reservoirPressure} psi` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">{t.samples.satPressure}</span>
                <span className="font-bold text-sky-800">
                  {detailItem.saturationPressure ? `${detailItem.saturationPressure} psi` : '—'}
                </span>
              </div>
            </div>

            {/* Quality & Method */}
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">{t.samples.samplingMethod}:</span>
                <p className="text-slate-600">{detailItem.samplingMethod}</p>
              </div>
              {detailItem.qualityNotes && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-900">
                  <span className="font-bold block mb-0.5">{t.samples.qualityNotes}:</span>
                  <p>{detailItem.qualityNotes}</p>
                </div>
              )}
            </div>

            {/* Linked PVT Analyses */}
            <div className="space-y-2.5 pt-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>{t.samples.linkedAnalyses}</span>
              </h4>

              <div className="space-y-2">
                {analyses.filter(a => a.sampleId === detailItem.id).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    {lang === 'ar' ? 'لا توجد تحاليل مسجلة لهذه العينة حتى الآن.' : 'No PVT analyses registered yet for this sample.'}
                  </div>
                ) : (
                  analyses
                    .filter(a => a.sampleId === detailItem.id)
                    .map(anl => (
                      <div
                        key={anl.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{anl.reportNumber}</span>
                            <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] font-semibold">
                              {anl.testType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{anl.laboratory}</div>
                        </div>

                        <div className="text-end">
                          <div className="font-mono font-bold text-slate-800">
                            {anl.bubblePointPressure ? `Pb: ${anl.bubblePointPressure} psi` : anl.analysisDate}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {anl.formationVolumeFactorBo ? `Bo: ${anl.formationVolumeFactorBo} rb/stb` : ''}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Linked Reports & Files */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-purple-600" />
                  <span>{t.samples.linkedReports}</span>
                </h4>
                {canCreateOrEdit(currentUser) && (
                  <button
                    onClick={() => setShowAttachManager(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-sky-50 text-sky-700 px-3 py-1 font-semibold text-xs hover:bg-sky-100 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة / إدارة المرفقات' : 'Manage Attachments'}</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {reports.filter(r => r.linkedId === detailItem.id || r.linkedId === detailItem.wellId).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    {lang === 'ar' ? 'لا توجد تقارير PDF مؤرشفة مرتبطة مباشرة.' : 'No archived PDF reports attached.'}
                  </div>
                ) : (
                  reports
                    .filter(r => r.linkedId === detailItem.id || r.linkedId === detailItem.wellId)
                    .map(rep => (
                      <div
                        key={rep.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <div>
                            <span className="font-bold text-slate-900">{rep.reportNumber}</span>
                            <p className="text-[11px] text-slate-500 truncate max-w-md">{rep.title}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (onOpenReport) onOpenReport(rep.id);
                          }}
                          className="rounded-lg bg-sky-50 text-sky-700 px-3 py-1.5 font-semibold text-xs hover:bg-sky-100 transition"
                        >
                          {t.reports.previewPdf}
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Direct File Attachments */}
            <div className="space-y-2.5 pt-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-600" />
                <span>{lang === 'ar' ? 'الملفات والمرفقات المخزنة محلياً' : 'Locally Stored Files & Attachments'}</span>
              </h4>

              <div className="space-y-2">
                {attachments.filter(a => a.linkedId === detailItem.id && !a.isArchived).length === 0 ? (
                  <div className="p-3.5 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    {lang === 'ar' ? 'لا توجد ملفات ثنائية مرفقة مباشرة بهذه العينة.' : 'No binary attachments linked directly.'}
                  </div>
                ) : (
                  attachments
                    .filter(a => a.linkedId === detailItem.id && !a.isArchived)
                    .map(att => (
                      <div
                        key={att.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="rounded bg-slate-100 text-slate-700 font-bold px-2 py-0.5 text-[10px] uppercase">
                            {att.fileExtension || 'FILE'}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 truncate block">{att.fileName}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span>{Math.round(att.fileSize / 1024)} KB</span>
                              <span>•</span>
                              <span className="font-mono">v{att.version}</span>
                              <span>•</span>
                              <span className="rounded bg-slate-100 text-slate-600 px-1 py-0.5 text-[10px]">
                                {att.storageBackend}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-emerald-600 text-[10px]">
                                <ShieldCheck className="w-3 h-3" />
                                {att.checksum?.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1.5 font-semibold text-xs hover:bg-slate-200 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تنزيل' : 'Download'}</span>
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setDetailItem(null);
                  if (onClearSelectedDetail) onClearSelectedDetail();
                }}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {t.actions.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Manager Modal */}
      {detailItem && (
        <AttachmentManagerModal
          isOpen={showAttachManager}
          onClose={() => setShowAttachManager(false)}
          lang={lang}
          currentUser={currentUser}
          targetLinkedType="Sample"
          targetLinkedId={detailItem.id}
          onAttachmentChanged={loadData}
        />
      )}
    </div>
  );
};
