import * as XLSX from 'xlsx';
import { db, logAuditEvent } from '../db/pvtDb';
import type { SampleRecord, AnalysisRecord, FieldRecord, WellRecord, ReservoirRecord } from '../types';

export interface ExcelColumnMapping {
  field: string;
  sourceColumn: string;
}

export interface ParsedExcelSheet {
  sheetName: string;
  headers: string[];
  rows: any[];
}

export interface ImportValidationResult {
  validRows: any[];
  duplicateRows: any[];
  invalidRows: { rowNumber: number; row: any; reason: string }[];
}

export async function parseExcelFileLocally(file: File): Promise<{
  sheets: string[];
  workbook: XLSX.WorkBook;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  return {
    sheets: workbook.SheetNames,
    workbook,
  };
}

export function extractSheetData(workbook: XLSX.WorkBook, sheetName: string): ParsedExcelSheet {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { sheetName, headers: [], rows: [] };
  }

  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawJson.length === 0) {
    return { sheetName, headers: [], rows: [] };
  }

  const headers = (rawJson[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
  const rows: any[] = [];

  for (let i = 1; i < rawJson.length; i++) {
    const rawRow = rawJson[i];
    if (!rawRow || rawRow.every((val: any) => val === undefined || val === null || val === '')) {
      continue; // Skip empty row
    }
    const rowObj: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      rowObj[header] = rawRow[index];
    });
    rows.push(rowObj);
  }

  return { sheetName, headers, rows };
}

export async function validateAndPrepareImport(
  rows: any[],
  mapping: Record<string, string>,
  duplicateAction: 'skip' | 'update'
): Promise<ImportValidationResult> {
  const existingSamples = await db.samples.toArray();
  const existingCodes = new Set(existingSamples.map(s => s.sampleCode.toLowerCase()));

  const validRows: any[] = [];
  const duplicateRows: any[] = [];
  const invalidRows: { rowNumber: number; row: any; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for 0-index, +1 for header
    const sampleCode = String(row[mapping.sampleCode] || '').trim();
    const wellName = String(row[mapping.well] || '').trim();
    const fluidType = String(row[mapping.fluidType] || 'Black Oil').trim();

    if (!sampleCode) {
      invalidRows.push({
        rowNumber,
        row,
        reason: 'Sample Code is missing or empty.',
      });
      return;
    }

    if (existingCodes.has(sampleCode.toLowerCase())) {
      if (duplicateAction === 'skip') {
        duplicateRows.push({ rowNumber, sampleCode, row });
        return;
      } else {
        // Update mode - treat as valid with update flag
        validRows.push({ rowNumber, sampleCode, wellName, fluidType, isUpdate: true, row });
        return;
      }
    }

    validRows.push({
      rowNumber,
      sampleCode,
      wellName,
      fluidType,
      isUpdate: false,
      row,
    });
  });

  return { validRows, duplicateRows, invalidRows };
}

export async function executeImport(
  prepared: ImportValidationResult,
  mapping: Record<string, string>,
  userId: string,
  userName: string,
  currentUserRole?: string
): Promise<{ importedCount: number; updatedCount: number }> {
  if (currentUserRole === 'ReadOnly') {
    throw new Error('Permission Denied: ReadOnly users cannot import data.');
  }

  let importedCount = 0;
  let updatedCount = 0;

  // Retrieve or create reference structures
  const fields = await db.fields.toArray();
  const reservoirs = await db.reservoirs.toArray();
  const wells = await db.wells.toArray();

  const defaultField = fields[0] || { id: 'FLD-NRML', name: 'Default Field' };
  const defaultRes = reservoirs[0] || { id: 'RES-DEF', name: 'Default Reservoir', fieldId: defaultField.id };

  for (const item of prepared.validRows) {
    const row = item.row;
    const sampleCode = String(row[mapping.sampleCode] || '').trim();
    const fieldName = String(row[mapping.field] || defaultField.name).trim();
    const reservoirName = String(row[mapping.reservoir] || defaultRes.name).trim();
    const wellName = String(row[mapping.well] || 'Well-Unknown').trim();
    const fluidType = row[mapping.fluidType] || 'Black Oil';
    const sampleType = row[mapping.sampleType] || 'Bottom Hole';
    const samplingDate = row[mapping.samplingDate] ? String(row[mapping.samplingDate]).substring(0, 10) : new Date().toISOString().substring(0, 10);
    const samplingDepth = row[mapping.samplingDepth] ? Number(row[mapping.samplingDepth]) : undefined;
    const samplingPressure = row[mapping.samplingPressure] ? Number(row[mapping.samplingPressure]) : undefined;
    const samplingTemp = row[mapping.samplingTemp] ? Number(row[mapping.samplingTemp]) : undefined;
    const saturationPressure = row[mapping.satPressure] ? Number(row[mapping.satPressure]) : undefined;

    // Check or find well
    let well = wells.find(w => w.name.toLowerCase() === wellName.toLowerCase());
    if (!well) {
      well = {
        id: `WEL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: wellName,
        fieldId: defaultField.id,
        reservoirId: defaultRes.id,
        wellType: 'Producer',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.wells.add(well);
      wells.push(well);
    }

    const existingSample = await db.samples.where('sampleCode').equalsIgnoreCase(sampleCode).first();
    if (existingSample && item.isUpdate) {
      await db.samples.update(existingSample.id, {
        wellId: well.id,
        fluidType,
        sampleType,
        samplingDate,
        samplingDepth,
        samplingPressure,
        samplingTemperature: samplingTemp,
        saturationPressure,
        updatedAt: new Date().toISOString(),
      });
      updatedCount++;
    } else {
      const newSample: SampleRecord = {
        id: `SMP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sampleCode,
        fieldId: well.fieldId,
        reservoirId: well.reservoirId || defaultRes.id,
        wellId: well.id,
        fluidType,
        sampleType,
        samplingDate,
        samplingMethod: 'Imported from Excel',
        samplingDepth,
        samplingPressure,
        samplingTemperature: samplingTemp,
        saturationPressure,
        sampleStatus: 'Valid',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.samples.add(newSample);
      importedCount++;
    }
  }

  await logAuditEvent({
    userId,
    userName,
    actionType: 'IMPORT_EXCEL',
    entityType: 'Samples',
    entityId: `BATCH-${Date.now()}`,
    details: `Imported ${importedCount} new samples, updated ${updatedCount} existing records.`,
  });

  return { importedCount, updatedCount };
}

export function downloadSampleExcelTemplate() {
  const templateData = [
    {
      'Sample Code': 'SMP-DEMO-01',
      'Field Name': 'North Rumaila (شمال الرميلة)',
      'Reservoir Name': 'Mishrif MB1 (مشرف وحدة MB1)',
      'Well Name': 'NR-142 (ش.ر-142)',
      'Fluid Type': 'Black Oil',
      'Sample Type': 'Bottom Hole',
      'Sampling Date': '2024-06-15',
      'Sampling Depth (ft)': 7850,
      'Sampling Pressure (psi)': 3420,
      'Sampling Temp (degF)': 195,
      'Saturation Pressure Pb (psi)': 1820,
      'Oil FVF Bo (rb/stb)': 1.285,
      'Solution GOR (scf/stb)': 485,
      'Oil Viscosity (cp)': 1.74,
      'Remarks': 'Standard PVT test sample',
    },
    {
      'Sample Code': 'SMP-DEMO-02',
      'Field Name': 'North Rumaila (شمال الرميلة)',
      'Reservoir Name': 'Zubair Main Pay (زبير المكمن الرئيسي)',
      'Well Name': 'NR-205 (ش.ر-205)',
      'Fluid Type': 'Volatile Oil',
      'Sample Type': 'Recombined',
      'Sampling Date': '2024-07-20',
      'Sampling Depth (ft)': 10600,
      'Sampling Pressure (psi)': 4900,
      'Sampling Temp (degF)': 235,
      'Saturation Pressure Pb (psi)': 3260,
      'Oil FVF Bo (rb/stb)': 1.542,
      'Solution GOR (scf/stb)': 945,
      'Oil Viscosity (cp)': 0.62,
      'Remarks': 'Volatile oil study sample',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PVT_Samples_Template');
  XLSX.writeFile(wb, 'PVT_Analysis_Import_Template.xlsx');
}

export async function exportCatalogToExcel(filteredItems: any[], filename = 'PVT_Catalog_Export.xlsx') {
  const exportRows = filteredItems.map(item => ({
    'Analysis ID': item.analysis?.id || 'N/A',
    'Report Number': item.analysis?.reportNumber || 'N/A',
    'Field': item.field?.name || '',
    'Reservoir': item.reservoir?.name || '',
    'Formation': item.formation?.name || '',
    'Well': item.well?.name || '',
    'Sample Code': item.sample?.sampleCode || '',
    'Fluid Type': item.sample?.fluidType || '',
    'Sample Type': item.sample?.sampleType || '',
    'Sampling Date': item.sample?.samplingDate || '',
    'Analysis Date': item.analysis?.analysisDate || '',
    'Laboratory': item.analysis?.laboratory || '',
    'Test Type': item.analysis?.testType || '',
    'Pb (psi)': item.analysis?.saturationPressure ?? '',
    'Bo (rb/stb)': item.analysis?.formationVolumeFactorBo ?? '',
    'Rs (scf/stb)': item.analysis?.gasOilRatio ?? '',
    'Viscosity (cp)': item.analysis?.oilViscosityAtPb ?? '',
    'Oil Density (g/cm3)': item.analysis?.oilDensity ?? '',
    'Status': item.analysis?.status || item.sample?.sampleStatus || '',
    'Remarks': item.analysis?.remarks || item.sample?.remarks || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PVT_Catalog');
  XLSX.writeFile(wb, filename);
}
