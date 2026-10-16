import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Activity,
  Check,
  X,
} from 'lucide-react';
import { db } from '../../db/pvtDb';
import { exportCatalogToExcel } from '../../services/excelService';
import { translations } from '../../i18n/translations';
import type {
  Language,
  SampleRecord,
  AnalysisRecord,
  FieldRecord,
  ReservoirRecord,
  FormationRecord,
  WellRecord,
} from '../../types';

interface CatalogRow {
  id: string;
  analysis: AnalysisRecord;
  sample: SampleRecord;
  field?: FieldRecord;
  reservoir?: ReservoirRecord;
  formation?: FormationRecord;
  well?: WellRecord;
}

interface Props {
  lang: Language;
  onSelectSampleDetail: (sampleId: string) => void;
  onSelectAnalysisDetail?: (analysisId: string) => void;
}

export const PVTIndexView: React.FC<Props> = ({
  lang,
  onSelectSampleDetail,
  onSelectAnalysisDetail,
}) => {
  const t = translations[lang];

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CatalogRow[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);

  // Search and multi-condition filters
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('pvt_initial_search') || '';
  });
  const [selectedFieldId, setSelectedFieldId] = useState<string>('ALL');
  const [selectedFluidType, setSelectedFluidType] = useState<string>('ALL');
  const [selectedTestType, setSelectedTestType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    recordId: true,
    field: true,
    reservoir: true,
    formation: false,
    well: true,
    sampleCode: true,
    fluidType: true,
    sampleType: true,
    samplingDate: true,
    analysisDate: true,
    lab: true,
    testType: true,
    reportNo: true,
    pb: true,
    bo: true,
    gor: true,
    viscosity: false,
    status: true,
  });

  const [showColModal, setShowColModal] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<string>('samplingDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selected row for modal
  const [selectedRow, setSelectedRow] = useState<CatalogRow | null>(null);

  // Load catalog items with relational joins
  useEffect(() => {
    sessionStorage.removeItem('pvt_initial_search');
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [analysesList, samplesList, fieldsList, reservoirsList, formationsList, wellsList] =
        await Promise.all([
          db.analysisRecords.toArray(),
          db.samples.toArray(),
          db.fields.toArray(),
          db.reservoirs.toArray(),
          db.formations.toArray(),
          db.wells.toArray(),
        ]);

      setFields(fieldsList);

      const fieldMap = new Map(fieldsList.map(f => [f.id, f]));
      const resMap = new Map(reservoirsList.map(r => [r.id, r]));
      const formMap = new Map(formationsList.map(f => [f.id, f]));
      const wellMap = new Map(wellsList.map(w => [w.id, w]));
      const sampleMap = new Map(samplesList.map(s => [s.id, s]));

      const rows: CatalogRow[] = [];

      // Join each analysis to its sample, well, reservoir, field
      for (const anl of analysesList) {
        if (anl.isArchived) continue;
        const sample = sampleMap.get(anl.sampleId);
        if (!sample || sample.isArchived) continue;

        const well = wellMap.get(sample.wellId);
        const field = fieldMap.get(sample.fieldId);
        const reservoir = resMap.get(sample.reservoirId);
        const formation = sample.formationId ? formMap.get(sample.formationId) : undefined;

        rows.push({
          id: anl.id,
          analysis: anl,
          sample,
          field,
          reservoir,
          formation,
          well,
        });
      }

      // Also include any samples that might not have an analysis yet
      for (const sample of samplesList) {
        if (sample.isArchived) continue;
        const hasAnl = analysesList.some(a => a.sampleId === sample.id);
        if (!hasAnl) {
          const well = wellMap.get(sample.wellId);
          const field = fieldMap.get(sample.fieldId);
          const reservoir = resMap.get(sample.reservoirId);
          const formation = sample.formationId ? formMap.get(sample.formationId) : undefined;

          rows.push({
            id: `SMP-ONLY-${sample.id}`,
            analysis: {
              id: 'PENDING',
              sampleId: sample.id,
              reportNumber: 'PENDING',
              laboratory: 'Pending Testing',
              testType: 'Complete PVT Study',
              analysisDate: sample.samplingDate,
              status: 'Preliminary',
              isArchived: false,
              createdAt: sample.createdAt,
              updatedAt: sample.updatedAt,
            },
            sample,
            field,
            reservoir,
            formation,
            well,
          });
        }
      }

      setData(rows);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Text Search across multiple columns
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch =
          item.analysis.id.toLowerCase().includes(q) ||
          item.analysis.reportNumber.toLowerCase().includes(q) ||
          item.sample.sampleCode.toLowerCase().includes(q) ||
          (item.field?.name && item.field.name.toLowerCase().includes(q)) ||
          (item.reservoir?.name && item.reservoir.name.toLowerCase().includes(q)) ||
          (item.well?.name && item.well.name.toLowerCase().includes(q)) ||
          item.sample.fluidType.toLowerCase().includes(q) ||
          item.sample.sampleType.toLowerCase().includes(q) ||
          item.analysis.laboratory.toLowerCase().includes(q) ||
          item.analysis.testType.toLowerCase().includes(q);

        if (!textMatch) return false;
      }

      // 2. Field filter
      if (selectedFieldId !== 'ALL' && item.sample.fieldId !== selectedFieldId) {
        return false;
      }

      // 3. Fluid Type filter
      if (selectedFluidType !== 'ALL' && item.sample.fluidType !== selectedFluidType) {
        return false;
      }

      // 4. Test Type filter
      if (selectedTestType !== 'ALL' && item.analysis.testType !== selectedTestType) {
        return false;
      }

      // 5. Date Range
      if (startDate && item.sample.samplingDate < startDate) {
        return false;
      }
      if (endDate && item.sample.samplingDate > endDate) {
        return false;
      }

      return true;
    });
  }, [data, searchQuery, selectedFieldId, selectedFluidType, selectedTestType, startDate, endDate]);

  // Sort logic
  const sortedData = useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'recordId':
          valA = a.analysis.id;
          valB = b.analysis.id;
          break;
        case 'field':
          valA = a.field?.name || '';
          valB = b.field?.name || '';
          break;
        case 'reservoir':
          valA = a.reservoir?.name || '';
          valB = b.reservoir?.name || '';
          break;
        case 'well':
          valA = a.well?.name || '';
          valB = b.well?.name || '';
          break;
        case 'sampleCode':
          valA = a.sample.sampleCode;
          valB = b.sample.sampleCode;
          break;
        case 'fluidType':
          valA = a.sample.fluidType;
          valB = b.sample.fluidType;
          break;
        case 'samplingDate':
          valA = a.sample.samplingDate;
          valB = b.sample.samplingDate;
          break;
        case 'pb':
          valA = a.analysis.saturationPressure || 0;
          valB = b.analysis.saturationPressure || 0;
          break;
        case 'bo':
          valA = a.analysis.formationVolumeFactorBo || 0;
          valB = b.analysis.formationVolumeFactorBo || 0;
          break;
        default:
          valA = a.sample.samplingDate;
          valB = b.sample.samplingDate;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredData, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedFieldId('ALL');
    setSelectedFluidType('ALL');
    setSelectedTestType('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleExport = () => {
    exportCatalogToExcel(
      sortedData,
      `PVT_Index_Export_${new Date().toISOString().substring(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.pvtIndex.title}</h2>
          <p className="text-xs text-slate-500">{t.pvtIndex.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.pvtIndex.selectColumns}</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.actions.exportExcel}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Main search input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.actions.search}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pl-9 text-xs text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Field Filter */}
          <div>
            <select
              value={selectedFieldId}
              onChange={e => {
                setSelectedFieldId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">{t.pvtIndex.allFields}</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fluid Type Filter */}
          <div>
            <select
              value={selectedFluidType}
              onChange={e => {
                setSelectedFluidType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">{t.pvtIndex.allFluids}</option>
              <option value="Black Oil">Black Oil (نفط أسود)</option>
              <option value="Volatile Oil">Volatile Oil (نفط متطاير)</option>
              <option value="Gas Condensate">Gas Condensate (متكثف غازي)</option>
              <option value="Wet Gas">Wet Gas (غاز رطب)</option>
              <option value="Dry Gas">Dry Gas (غاز جاف)</option>
              <option value="Heavy Oil">Heavy Oil (نفط ثقيل)</option>
            </select>
          </div>

          {/* Test Type Filter */}
          <div>
            <select
              value={selectedTestType}
              onChange={e => {
                setSelectedTestType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">{t.pvtIndex.allTests}</option>
              <option value="Complete PVT Study">Complete PVT Study (دراسة متكاملة)</option>
              <option value="CCE">CCE (تمدد ثابت التركيب)</option>
              <option value="Differential Liberation">Differential Liberation (تحرر تفاضلي)</option>
              <option value="Separator Test">Separator Test (اختبار عازلات)</option>
              <option value="Viscosity Test">Viscosity Test (اختبار لزوجة)</option>
              <option value="Compositional Analysis">Compositional Analysis (تحليل تركيبي)</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{t.pvtIndex.filterByDateRange}:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              {t.pvtIndex.showingRows
                .replace('{count}', String(sortedData.length))
                .replace('{total}', String(data.length))}
            </span>
            {(searchQuery ||
              selectedFieldId !== 'ALL' ||
              selectedFluidType !== 'ALL' ||
              selectedTestType !== 'ALL' ||
              startDate ||
              endDate) && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.actions.clearFilters}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-900 text-white">
                {columnVisibility.recordId && (
                  <th
                    onClick={() => handleSort('recordId')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colRecordId}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.field && (
                  <th
                    onClick={() => handleSort('field')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colField}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.reservoir && (
                  <th
                    onClick={() => handleSort('reservoir')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colReservoir}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.well && (
                  <th
                    onClick={() => handleSort('well')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colWell}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.sampleCode && (
                  <th
                    onClick={() => handleSort('sampleCode')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colSampleId}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.fluidType && (
                  <th
                    onClick={() => handleSort('fluidType')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colFluidType}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.sampleType && (
                  <th className="p-3 text-start font-semibold whitespace-nowrap">
                    {t.pvtIndex.colSampleType}
                  </th>
                )}
                {columnVisibility.samplingDate && (
                  <th
                    onClick={() => handleSort('samplingDate')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colSamplingDate}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.testType && (
                  <th className="p-3 text-start font-semibold whitespace-nowrap">
                    {t.pvtIndex.colTestType}
                  </th>
                )}
                {columnVisibility.reportNo && (
                  <th className="p-3 text-start font-semibold whitespace-nowrap">
                    {t.pvtIndex.colReportNo}
                  </th>
                )}
                {columnVisibility.pb && (
                  <th
                    onClick={() => handleSort('pb')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colPb}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.bo && (
                  <th
                    onClick={() => handleSort('bo')}
                    className="p-3 text-start font-semibold cursor-pointer hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.pvtIndex.colBo}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVisibility.gor && (
                  <th className="p-3 text-start font-semibold whitespace-nowrap">
                    {t.pvtIndex.colGor}
                  </th>
                )}
                {columnVisibility.status && (
                  <th className="p-3 text-start font-semibold whitespace-nowrap">
                    {t.pvtIndex.colStatus}
                  </th>
                )}
                <th className="p-3 text-center font-semibold whitespace-nowrap">
                  {t.pvtIndex.colActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <FlaskConical className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold">{t.pvtIndex.noResults}</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-sky-50/50 cursor-pointer transition"
                    onClick={() => setSelectedRow(row)}
                  >
                    {columnVisibility.recordId && (
                      <td className="p-3 font-mono font-bold text-sky-700">
                        {row.analysis.id}
                      </td>
                    )}
                    {columnVisibility.field && (
                      <td className="p-3 font-semibold text-slate-900">
                        {row.field?.name || '—'}
                      </td>
                    )}
                    {columnVisibility.reservoir && (
                      <td className="p-3 text-slate-600">{row.reservoir?.name || '—'}</td>
                    )}
                    {columnVisibility.well && (
                      <td className="p-3 font-semibold text-slate-800">{row.well?.name || '—'}</td>
                    )}
                    {columnVisibility.sampleCode && (
                      <td className="p-3 font-mono text-slate-900 font-semibold">
                        {row.sample.sampleCode}
                      </td>
                    )}
                    {columnVisibility.fluidType && (
                      <td className="p-3">
                        <span className="rounded-md bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px] font-medium border border-amber-200">
                          {row.sample.fluidType}
                        </span>
                      </td>
                    )}
                    {columnVisibility.sampleType && (
                      <td className="p-3 text-slate-600">{row.sample.sampleType}</td>
                    )}
                    {columnVisibility.samplingDate && (
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                        {row.sample.samplingDate}
                      </td>
                    )}
                    {columnVisibility.testType && (
                      <td className="p-3">
                        <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 text-[11px] font-medium border border-sky-200">
                          {row.analysis.testType}
                        </span>
                      </td>
                    )}
                    {columnVisibility.reportNo && (
                      <td className="p-3 font-mono text-slate-600 text-[11px]">
                        {row.analysis.reportNumber}
                      </td>
                    )}
                    {columnVisibility.pb && (
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {row.analysis.saturationPressure ? `${row.analysis.saturationPressure}` : '—'}
                      </td>
                    )}
                    {columnVisibility.bo && (
                      <td className="p-3 font-mono text-slate-700">
                        {row.analysis.formationVolumeFactorBo ?? '—'}
                      </td>
                    )}
                    {columnVisibility.gor && (
                      <td className="p-3 font-mono text-slate-700">
                        {row.analysis.gasOilRatio ?? '—'}
                      </td>
                    )}
                    {columnVisibility.status && (
                      <td className="p-3">
                        <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                          {row.analysis.status}
                        </span>
                      </td>
                    )}
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectSampleDetail(row.sample.id)}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-sky-600 hover:text-white transition"
                        title={t.actions.view}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>{lang === 'ar' ? 'الصفوف في الصفحة:' : 'Rows per page:'}</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              {lang === 'ar'
                ? `صفحة ${currentPage} من ${totalPages}`
                : `Page ${currentPage} of ${totalPages}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Column Visibility Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">{t.pvtIndex.selectColumns}</h3>
              <button onClick={() => setShowColModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.keys(columnVisibility).map(colKey => (
                <label key={colKey} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnVisibility[colKey]}
                    onChange={e =>
                      setColumnVisibility({
                        ...columnVisibility,
                        [colKey]: e.target.checked,
                      })
                    }
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="capitalize">{colKey.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowColModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {t.actions.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast Record Quick View Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700 font-bold">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedRow.sample.sampleCode}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedRow.analysis.reportNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colField}</div>
                <div className="font-bold text-slate-800">{selectedRow.field?.name || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colReservoir}</div>
                <div className="font-bold text-slate-800">{selectedRow.reservoir?.name || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colWell}</div>
                <div className="font-bold text-slate-800">{selectedRow.well?.name || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colFluidType}</div>
                <div className="font-bold text-slate-800">{selectedRow.sample.fluidType}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colPb}</div>
                <div className="font-bold text-sky-700">
                  {selectedRow.analysis.saturationPressure ? `${selectedRow.analysis.saturationPressure} psi` : '—'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colBo}</div>
                <div className="font-bold text-slate-800">
                  {selectedRow.analysis.formationVolumeFactorBo ? `${selectedRow.analysis.formationVolumeFactorBo} rb/stb` : '—'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.pvtIndex.colGor}</div>
                <div className="font-bold text-slate-800">
                  {selectedRow.analysis.gasOilRatio ? `${selectedRow.analysis.gasOilRatio} scf/stb` : '—'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium">{t.analyses.oilViscosityAtPb}</div>
                <div className="font-bold text-slate-800">
                  {selectedRow.analysis.oilViscosityAtPb ? `${selectedRow.analysis.oilViscosityAtPb} cp` : '—'}
                </div>
              </div>
            </div>

            {selectedRow.sample.remarks && (
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-xs text-amber-900">
                <div className="font-bold mb-0.5">{lang === 'ar' ? 'ملاحظات العينة:' : 'Sample Remarks:'}</div>
                <p>{selectedRow.sample.remarks}</p>
              </div>
            )}

            <div className="pt-2 flex justify-between gap-3">
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t.actions.close}
              </button>
              <button
                onClick={() => {
                  const sId = selectedRow.sample.id;
                  setSelectedRow(null);
                  onSelectSampleDetail(sId);
                }}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                {lang === 'ar' ? 'فتح الملف الكامل للعينة والتحاليل' : 'Open Full Sample & Analysis Study'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
