import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  Search,
  FlaskConical,
  Edit2,
  Trash2,
  Table,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  PlusCircle,
  FileText,
} from 'lucide-react';
import { db, logAuditEvent } from '../../db/pvtDb';
import { canCreateOrEdit } from '../../services/authService';
import { translations } from '../../i18n/translations';
import type {
  Language,
  LocalUser,
  AnalysisRecord,
  PVTPropertyRecord,
  SampleRecord,
  PVTTestType,
} from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
}

export const AnalysisRecordsView: React.FC<Props> = ({ lang, currentUser }) => {
  const t = translations[lang];

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [properties, setProperties] = useState<PVTPropertyRecord[]>([]);

  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [search, setSearch] = useState('');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showPropModal, setShowPropModal] = useState(false);

  // Analysis Form
  const [fSampleId, setFSampleId] = useState('');
  const [fReportNo, setFReportNo] = useState('');
  const [fLab, setFLab] = useState('');
  const [fTestType, setFTestType] = useState<PVTTestType>('Complete PVT Study');
  const [fDate, setFDate] = useState(new Date().toISOString().substring(0, 10));
  const [fAnalyst, setFAnalyst] = useState('');
  const [fTemp, setFTemp] = useState<number | ''>('');
  const [fPb, setFPb] = useState<number | ''>('');
  const [fBo, setFBo] = useState<number | ''>('');
  const [fGor, setFGor] = useState<number | ''>('');
  const [fVisc, setFVisc] = useState<number | ''>('');
  const [fDensity, setFDensity] = useState<number | ''>('');
  const [fGasGrav, setFGasGrav] = useState<number | ''>('');
  const [fStatus, setFStatus] = useState<AnalysisRecord['status']>('Completed');
  const [fRemarks, setFRemarks] = useState('');

  // Property Form
  const [propName, setPropName] = useState('');
  const [propCategory, setPropCategory] = useState<PVTPropertyRecord['category']>('CCE');
  const [propPressure, setPropPressure] = useState<number | ''>('');
  const [propTemp, setPropTemp] = useState<number | ''>('');
  const [propValue, setPropValue] = useState<string>('');
  const [propUnit, setPropUnit] = useState<string>('psi');
  const [propIsMeasured, setPropIsMeasured] = useState<boolean>(true);
  const [propMethod, setPropMethod] = useState<string>('');
  const [propRemarks, setPropRemarks] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [a, s, p] = await Promise.all([
      db.analysisRecords.toArray(),
      db.samples.toArray(),
      db.pvtProperties.toArray(),
    ]);

    setAnalyses(a);
    setSamples(s);
    setProperties(p);

    if (a.length > 0 && !selectedAnalysis) {
      setSelectedAnalysis(a[0]);
    }
  };

  const openNewAnalysisModal = () => {
    setFSampleId(samples[0]?.id || '');
    setFReportNo(`PVT-RFD-${new Date().getFullYear()}-${String(analyses.length + 1).padStart(3, '0')}`);
    setFLab('Central Reservoir Fluids Core Laboratory');
    setFTestType('Complete PVT Study');
    setFDate(new Date().toISOString().substring(0, 10));
    setFAnalyst(currentUser?.fullName || 'Reservoir Fluids Engineer');
    setFTemp('');
    setFPb('');
    setFBo('');
    setFGor('');
    setFVisc('');
    setFDensity('');
    setFGasGrav('');
    setFStatus('Completed');
    setFRemarks('');
    setShowAnalysisModal(true);
  };

  const handleSaveAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `ANL-${Date.now()}`;
    const now = new Date().toISOString();

    const record: AnalysisRecord = {
      id,
      sampleId: fSampleId || samples[0]?.id || '',
      reportNumber: fReportNo.trim(),
      laboratory: fLab.trim(),
      testType: fTestType,
      analysisDate: fDate,
      analystName: fAnalyst.trim() || undefined,
      testTemperature: fTemp !== '' ? Number(fTemp) : undefined,
      saturationPressure: fPb !== '' ? Number(fPb) : undefined,
      bubblePointPressure: fPb !== '' ? Number(fPb) : undefined,
      gasOilRatio: fGor !== '' ? Number(fGor) : undefined,
      formationVolumeFactorBo: fBo !== '' ? Number(fBo) : undefined,
      oilViscosityAtPb: fVisc !== '' ? Number(fVisc) : undefined,
      oilDensity: fDensity !== '' ? Number(fDensity) : undefined,
      gasGravity: fGasGrav !== '' ? Number(fGasGrav) : undefined,
      status: fStatus,
      remarks: fRemarks.trim() || undefined,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.analysisRecords.add(record);

    // Also auto-add Bubble Point property if provided
    if (record.saturationPressure) {
      await db.pvtProperties.add({
        id: `PRP-${Date.now()}`,
        analysisId: id,
        sampleId: record.sampleId,
        propertyName: 'Bubble Point Pressure (Pb)',
        category: 'Saturation',
        pressure: record.saturationPressure,
        temperature: record.testTemperature,
        value: record.saturationPressure,
        unit: 'psi',
        isMeasured: true,
        testMethod: 'Visual CCE Cell',
        isArchived: false,
      });
    }

    await logAuditEvent({
      userId: currentUser?.id || 'USR',
      userName: currentUser?.fullName || 'User',
      actionType: 'CREATE_RECORD',
      entityType: 'AnalysisRecord',
      entityId: id,
      details: `Created PVT Analysis ${record.reportNumber} (${record.testType})`,
    });

    await loadData();
    setShowAnalysisModal(false);
    setSelectedAnalysis(record);
  };

  const openAddPropertyModal = () => {
    if (!selectedAnalysis) return;
    setPropName('');
    setPropCategory('CCE');
    setPropPressure(selectedAnalysis.saturationPressure ?? '');
    setPropTemp(selectedAnalysis.testTemperature ?? '');
    setPropValue('');
    setPropUnit('psi');
    setPropIsMeasured(true);
    setPropMethod('');
    setPropRemarks('');
    setShowPropModal(true);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysis) return;

    const propId = `PRP-${Date.now()}`;
    const newProp: PVTPropertyRecord = {
      id: propId,
      analysisId: selectedAnalysis.id,
      sampleId: selectedAnalysis.sampleId,
      propertyName: propName.trim(),
      category: propCategory,
      pressure: propPressure !== '' ? Number(propPressure) : undefined,
      temperature: propTemp !== '' ? Number(propTemp) : undefined,
      value: propValue.trim(),
      unit: propUnit.trim(),
      isMeasured: propIsMeasured,
      testMethod: propMethod.trim() || undefined,
      remarks: propRemarks.trim() || undefined,
      isArchived: false,
    };

    await db.pvtProperties.add(newProp);

    await logAuditEvent({
      userId: currentUser?.id || 'USR',
      userName: currentUser?.fullName || 'User',
      actionType: 'CREATE_RECORD',
      entityType: 'PVTProperty',
      entityId: propId,
      details: `Added PVT property ${newProp.propertyName} = ${newProp.value} ${newProp.unit}`,
    });

    await loadData();
    setShowPropModal(false);
  };

  const filteredAnalyses = analyses.filter(a => {
    if (a.isArchived) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.reportNumber.toLowerCase().includes(q) ||
        a.laboratory.toLowerCase().includes(q) ||
        a.testType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedProperties = selectedAnalysis
    ? properties.filter(p => p.analysisId === selectedAnalysis.id && !p.isArchived)
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.analyses.title}</h2>
          <p className="text-xs text-slate-500">{t.analyses.subtitle}</p>
        </div>

        {canCreateOrEdit(currentUser) && (
          <button
            onClick={openNewAnalysisModal}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.analyses.addAnalysis}</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left List (1 col) + Right Detailed Analysis Sheet (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Analyses List */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث برقم التقرير أو المختبر...' : 'Search reports or labs...'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-9 text-xs text-slate-800 focus:border-sky-500 focus:outline-none shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto pe-1">
            {filteredAnalyses.map(item => {
              const sample = samples.find(s => s.id === item.sampleId);
              const isSelected = selectedAnalysis?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnalysis(item)}
                  className={`p-4 rounded-2xl border cursor-pointer transition text-xs space-y-2 ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{item.reportNumber}</h4>
                      <span className="font-mono text-[11px] text-slate-500">
                        {sample?.sampleCode || 'No Sample'}
                      </span>
                    </div>
                    <span className="rounded bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-semibold">
                      {item.testType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <span>{item.analysisDate}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {item.bubblePointPressure ? `Pb: ${item.bubblePointPressure} psi` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed PVT Study & Interactive Properties Sheet */}
        <div className="lg:col-span-2 space-y-5">
          {selectedAnalysis ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              {/* Top Banner */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {selectedAnalysis.reportNumber}
                    </h3>
                    <span className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 text-xs font-semibold border border-emerald-200">
                      {selectedAnalysis.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedAnalysis.laboratory} • {selectedAnalysis.analysisDate}
                  </p>
                </div>

                {canCreateOrEdit(currentUser) && (
                  <button
                    onClick={openAddPropertyModal}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t.analyses.addProperty}</span>
                  </button>
                )}
              </div>

              {/* Core PVT Measured Summary Values */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{t.analyses.saturationPressure}</span>
                  <span className="font-extrabold text-sky-700 text-sm">
                    {selectedAnalysis.saturationPressure ? `${selectedAnalysis.saturationPressure} psi` : '—'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{t.analyses.formationVolumeFactorBo}</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedAnalysis.formationVolumeFactorBo ? `${selectedAnalysis.formationVolumeFactorBo} rb/stb` : '—'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{t.analyses.gasOilRatio}</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedAnalysis.gasOilRatio ? `${selectedAnalysis.gasOilRatio} scf/stb` : '—'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{t.analyses.oilViscosityAtPb}</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedAnalysis.oilViscosityAtPb ? `${selectedAnalysis.oilViscosityAtPb} cp` : '—'}
                  </span>
                </div>
              </div>

              {/* Secondary parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.analyses.testTemperature}</span>
                  <span className="font-bold text-slate-800">
                    {selectedAnalysis.testTemperature ? `${selectedAnalysis.testTemperature} °F` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.analyses.oilDensity}</span>
                  <span className="font-bold text-slate-800">
                    {selectedAnalysis.oilDensity ? `${selectedAnalysis.oilDensity} g/cm³` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.analyses.gasGravity}</span>
                  <span className="font-bold text-slate-800">
                    {selectedAnalysis.gasGravity ? `${selectedAnalysis.gasGravity}` : '—'}
                  </span>
                </div>
              </div>

              {/* Registered PVT Properties Table (CCE, Diff Lib, Viscosity, Composition) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-sky-600" />
                    <span>{t.analyses.propertiesList}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {selectedProperties.length} {lang === 'ar' ? 'نقاط قياس مسجلة' : 'data points'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                        <th className="p-2.5 text-start">{t.analyses.propertyName}</th>
                        <th className="p-2.5 text-start">{t.analyses.category}</th>
                        <th className="p-2.5 text-start">{t.analyses.pressure}</th>
                        <th className="p-2.5 text-start">{t.analyses.value}</th>
                        <th className="p-2.5 text-start">{t.analyses.measuredVsCalculated}</th>
                        <th className="p-2.5 text-start">{lang === 'ar' ? 'طريقة الاختبار' : 'Method'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedProperties.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                            {lang === 'ar'
                              ? 'لا توجد خصائص مضافة يدوياً لهذا التحليل. انقر "إضافة خاصية PVT" لإدراج نقاط CCE أو التحرر التفاضلي.'
                              : 'No additional detailed curve properties logged. Click "Add PVT Property" to register CCE or Diff Lib steps.'}
                          </td>
                        </tr>
                      ) : (
                        selectedProperties.map(prop => (
                          <tr key={prop.id} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-bold text-slate-900">{prop.propertyName}</td>
                            <td className="p-2.5">
                              <span className="rounded bg-sky-50 text-sky-800 px-1.5 py-0.5 text-[10px] font-medium border border-sky-100">
                                {prop.category}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono">
                              {prop.pressure ? `${prop.pressure} psi` : '—'}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-900">
                              {prop.value} <span className="text-[10px] font-normal text-slate-500">{prop.unit}</span>
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  prop.isMeasured
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                }`}
                              >
                                {prop.isMeasured ? t.analyses.isMeasured : t.analyses.isCalculated}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px]">{prop.testMethod || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedAnalysis.remarks && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                  <div className="font-bold mb-0.5">{lang === 'ar' ? 'ملاحظات التقرير المعملي:' : 'Study Remarks:'}</div>
                  <p>{selectedAnalysis.remarks}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-xs">
                {lang === 'ar' ? 'اختر دراسة PVT من القائمة لعرض تفاصيلها' : 'Select a PVT study to view details'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Analysis Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">{t.analyses.addAnalysis}</h3>
              <button onClick={() => setShowAnalysisModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnalysis} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.sample} *</label>
                  <select
                    value={fSampleId}
                    onChange={e => setFSampleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {samples.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} ({s.fluidType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.reportNumber} *</label>
                  <input
                    type="text"
                    required
                    value={fReportNo}
                    onChange={e => setFReportNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.testType} *</label>
                  <select
                    value={fTestType}
                    onChange={e => setFTestType(e.target.value as PVTTestType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Complete PVT Study">Complete PVT Study (دراسة متكاملة)</option>
                    <option value="CCE">CCE (تمدد ثابت التركيب)</option>
                    <option value="Differential Liberation">Differential Liberation (تحرر تفاضلي)</option>
                    <option value="Separator Test">Separator Test (اختبار عازلات)</option>
                    <option value="Viscosity Test">Viscosity Test (اختبار لزوجة)</option>
                    <option value="Compositional Analysis">Compositional Analysis (تحليل تركيبي)</option>
                    <option value="Swelling Test">Swelling Test (اختبار انتفاخ)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.laboratory} *</label>
                  <input
                    type="text"
                    required
                    value={fLab}
                    onChange={e => setFLab(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.analysisDate} *</label>
                  <input
                    type="date"
                    required
                    value={fDate}
                    onChange={e => setFDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.testTemperature}</label>
                  <input
                    type="number"
                    value={fTemp}
                    onChange={e => setFTemp(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.saturationPressure}</label>
                  <input
                    type="number"
                    value={fPb}
                    onChange={e => setFPb(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.formationVolumeFactorBo}</label>
                  <input
                    type="number"
                    step="0.001"
                    value={fBo}
                    onChange={e => setFBo(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.gasOilRatio}</label>
                  <input
                    type="number"
                    value={fGor}
                    onChange={e => setFGor(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.oilViscosityAtPb}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fVisc}
                    onChange={e => setFVisc(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
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
                  onClick={() => setShowAnalysisModal(false)}
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

      {/* Add PVT Property Modal */}
      {showPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">{t.analyses.addProperty}</h3>
              <button onClick={() => setShowPropModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProperty} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.analyses.propertyName} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Relative Volume V/Vsat, Oil Viscosity, Rs"
                  value={propName}
                  onChange={e => setPropName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.category} *</label>
                  <select
                    value={propCategory}
                    onChange={e => setPropCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="CCE">CCE (تمدد ثابت التركيب)</option>
                    <option value="Differential Liberation">Differential Liberation</option>
                    <option value="Separator Test">Separator Test</option>
                    <option value="Viscosity">Viscosity</option>
                    <option value="Composition">Composition (تركيب)</option>
                    <option value="Saturation">Saturation</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.measuredVsCalculated}</label>
                  <select
                    value={propIsMeasured ? 'true' : 'false'}
                    onChange={e => setPropIsMeasured(e.target.value === 'true')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="true">{t.analyses.isMeasured}</option>
                    <option value="false">{t.analyses.isCalculated}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.pressure} (psi)</label>
                  <input
                    type="number"
                    value={propPressure}
                    onChange={e => setPropPressure(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.temperature} (°F)</label>
                  <input
                    type="number"
                    value={propTemp}
                    onChange={e => setPropTemp(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.value} *</label>
                  <input
                    type="text"
                    required
                    value={propValue}
                    onChange={e => setPropValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.analyses.unit} *</label>
                  <input
                    type="text"
                    required
                    value={propUnit}
                    onChange={e => setPropUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPropModal(false)}
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
    </div>
  );
};
