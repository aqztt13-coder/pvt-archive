export type Language = 'ar' | 'en';

export type UserRole = 'Administrator' | 'Engineer' | 'ReadOnly';

export interface LocalUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  department: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type FluidType = 
  | 'Black Oil'
  | 'Volatile Oil'
  | 'Gas Condensate'
  | 'Wet Gas'
  | 'Dry Gas'
  | 'Heavy Oil';

export type SampleType = 
  | 'Bottom Hole'
  | 'Separator Liquid'
  | 'Separator Gas'
  | 'Wellhead'
  | 'Recombined';

export type SampleStatus = 
  | 'Valid'
  | 'Questionable'
  | 'Contaminated'
  | 'Depleted'
  | 'Pending Analysis';

export type PVTTestType =
  | 'CCE' // Constant Composition Expansion
  | 'Differential Liberation'
  | 'Separator Test'
  | 'Constant Volume Depletion'
  | 'Viscosity Test'
  | 'Compositional Analysis'
  | 'Swelling Test'
  | 'Complete PVT Study';

export type ReportStatus = 'Final' | 'Preliminary' | 'Draft' | 'Archived';

export interface FieldRecord {
  id: string;
  name: string;
  code?: string;
  alternativeNames?: string[];
  location?: string;
  operator?: string;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReservoirRecord {
  id: string;
  name: string;
  fieldId: string;
  formationId?: string;
  lithology?: string;
  driveMechanism?: string;
  depthAverage?: number;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormationRecord {
  id: string;
  name: string;
  geologicalAge?: string;
  lithology?: string;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WellRecord {
  id: string;
  name: string;
  fieldId: string;
  reservoirId?: string;
  formationId?: string;
  wellType: 'Producer' | 'Injector' | 'Exploration' | 'Appraisal' | 'Observation';
  spudDate?: string;
  surfaceCoordinates?: string;
  totalDepth?: number;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SampleRecord {
  id: string;
  sampleCode: string;
  fieldId: string;
  reservoirId: string;
  formationId?: string;
  wellId: string;
  fluidType: FluidType;
  sampleType: SampleType;
  samplingDate: string;
  samplingMethod: string;
  samplingDepth?: number; // ft
  samplingPressure?: number; // psi
  samplingTemperature?: number; // degF
  cylinderNumber?: string;
  sampleSource?: string;
  transportCondition?: string;
  reservoirPressure?: number; // psi
  reservoirTemperature?: number; // degF
  saturationPressure?: number; // psi
  sampleStatus: SampleStatus;
  qualityNotes?: string;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisRecord {
  id: string;
  sampleId: string;
  reportNumber: string;
  laboratory: string;
  testType: PVTTestType;
  analysisDate: string;
  analystName?: string;
  testTemperature?: number; // degF
  saturationPressure?: number; // psi
  bubblePointPressure?: number; // psi
  gasOilRatio?: number; // scf/stb
  formationVolumeFactorBo?: number; // rb/stb
  oilViscosityAtPb?: number; // cp
  oilDensity?: number; // g/cm3 or API
  gasGravity?: number; // Air = 1.0
  status: 'Completed' | 'Preliminary' | 'Superseded' | 'Verified';
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PVTPropertyRecord {
  id: string;
  analysisId: string;
  sampleId: string;
  propertyName: string;
  category: 'Saturation' | 'CCE' | 'Differential Liberation' | 'Separator Test' | 'Viscosity' | 'Composition' | 'Swelling' | 'General';
  pressure?: number; // psi
  temperature?: number; // degF
  value: number | string;
  unit: string;
  isMeasured: boolean; // true = measured, false = calculated
  testMethod?: string;
  reportSource?: string;
  remarks?: string;
  isArchived: boolean;
}

export interface ReportRecord {
  id: string;
  reportNumber: string;
  title: string;
  reportDate: string;
  laboratory: string;
  status: ReportStatus;
  linkedType: 'Sample' | 'Analysis' | 'Well' | 'Reservoir' | 'Field';
  linkedId: string;
  remarks?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  reportId?: string;
  sampleId?: string;
  wellId?: string;
  reservoirId?: string;
  fieldId?: string;
  analysisId?: string;
  linkedType: 'Sample' | 'Analysis' | 'Well' | 'Reservoir' | 'Field' | 'Report';
  linkedId: string;
  fileName: string;
  fileType: string;
  mimeType?: string;
  fileExtension?: string;
  fileSize: number;
  blob?: Blob;
  storageBackend: 'OPFS' | 'IndexedDB';
  checksum: string; // SHA-256 hash
  uploadDate: string;
  version: number;
  description?: string;
  reportNumber?: string;
  isArchived: boolean;
  replacedVersionId?: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  actionType:
    | 'LOGIN'
    | 'LOGOUT'
    | 'CREATE_RECORD'
    | 'UPDATE_RECORD'
    | 'ARCHIVE_RECORD'
    | 'DELETE_RECORD'
    | 'IMPORT_EXCEL'
    | 'EXPORT_DATA'
    | 'UPLOAD_ATTACHMENT'
    | 'DELETE_ATTACHMENT'
    | 'BACKUP_CREATED'
    | 'RESTORE_EXECUTED'
    | 'SETTINGS_CHANGED'
    | 'USER_MANAGEMENT';
  entityType: string;
  entityId: string;
  details: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE';
}

export interface AppSettingRecord {
  key: string;
  value: any;
}

export type ActiveTab =
  | 'dashboard'
  | 'pvt-index'
  | 'fields'
  | 'reservoirs'
  | 'formations'
  | 'wells'
  | 'samples'
  | 'analyses'
  | 'reports'
  | 'import-export'
  | 'backup-restore'
  | 'users'
  | 'audit-log'
  | 'settings'
  | 'help';
