import Dexie, { type Table } from 'dexie';
import type {
  FieldRecord,
  ReservoirRecord,
  FormationRecord,
  WellRecord,
  SampleRecord,
  AnalysisRecord,
  PVTPropertyRecord,
  ReportRecord,
  AttachmentRecord,
  LocalUser,
  AuditLogRecord,
  AppSettingRecord
} from '../types';

export class PVTDatabase extends Dexie {
  fields!: Table<FieldRecord, string>;
  reservoirs!: Table<ReservoirRecord, string>;
  formations!: Table<FormationRecord, string>;
  wells!: Table<WellRecord, string>;
  samples!: Table<SampleRecord, string>;
  analysisRecords!: Table<AnalysisRecord, string>;
  pvtProperties!: Table<PVTPropertyRecord, string>;
  reports!: Table<ReportRecord, string>;
  attachments!: Table<AttachmentRecord, string>;
  localUsers!: Table<LocalUser, string>;
  auditLogs!: Table<AuditLogRecord, string>;
  appSettings!: Table<AppSettingRecord, string>;

  constructor() {
    super('PVTAnalysisSystemDB');

    // Define schema versions with explicit indexes for fast search and joins
    this.version(1).stores({
      fields: 'id, name, isArchived, createdAt',
      reservoirs: 'id, name, fieldId, formationId, isArchived, createdAt',
      formations: 'id, name, isArchived, createdAt',
      wells: 'id, name, fieldId, reservoirId, formationId, isArchived, createdAt',
      samples: 'id, sampleCode, fieldId, reservoirId, wellId, fluidType, sampleType, samplingDate, isArchived, createdAt',
      analysisRecords: 'id, sampleId, reportNumber, testType, analysisDate, laboratory, isArchived, createdAt',
      pvtProperties: 'id, analysisId, sampleId, propertyName, category, isArchived',
      reports: 'id, reportNumber, status, linkedType, linkedId, isArchived, createdAt',
      attachments: 'id, reportId, sampleId, wellId, fileName, uploadDate, version',
      localUsers: 'id, username, role, isActive',
      auditLogs: 'id, timestamp, actionType, userId, entityType, entityId',
      appSettings: 'key',
    });

    this.version(2).stores({
      attachments: 'id, reportId, sampleId, wellId, linkedType, linkedId, fileName, uploadDate, version, isArchived, checksum, storageBackend',
    });

    this.version(3).stores({
      localUsers: 'id, username, email, role, isActive',
    });
  }
}

export const db = new PVTDatabase();

// Audit logger helper
export async function logAuditEvent(params: {
  userId: string;
  userName: string;
  actionType: AuditLogRecord['actionType'];
  entityType: string;
  entityId: string;
  details: string;
  status?: 'SUCCESS' | 'WARNING' | 'FAILURE';
}) {
  try {
    const record: AuditLogRecord = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      userName: params.userName,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      status: params.status || 'SUCCESS',
    };
    await db.auditLogs.add(record);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Storage persistence and quota tools
export async function checkStoragePersistence(): Promise<{
  persisted: boolean;
  quota?: number;
  usage?: number;
  usagePercent?: number;
}> {
  let persisted = false;
  let quota = 0;
  let usage = 0;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.persisted) {
      persisted = await navigator.storage.persisted();
    }
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota || 0;
      usage = estimate.usage || 0;
    }
  }

  const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
  return { persisted, quota, usage, usagePercent };
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

export async function syncDefaultUserCredentials() {
  try {
    const defaultPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // 123456
    const legacyAdminHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // admin123

    // Check if user ddzek258@gmail.com exists
    const adminUser = await db.localUsers.where('email').equalsIgnoreCase('ddzek258@gmail.com').first();
    if (!adminUser) {
      // Check if existing admin user exists
      const existingAdmin = await db.localUsers.where('username').equalsIgnoreCase('admin').first();
      if (existingAdmin) {
        await db.localUsers.update(existingAdmin.id, {
          email: 'ddzek258@gmail.com',
          isDefaultPassword: existingAdmin.passwordHash === legacyAdminHash || existingAdmin.passwordHash === defaultPasswordHash,
        });
      } else {
        await db.localUsers.add({
          id: 'USR-ADMIN-DDZEK',
          username: 'ddzek258',
          email: 'ddzek258@gmail.com',
          fullName: 'Dr. Tariq Al-Husseini (Admin)',
          role: 'Administrator',
          passwordHash: defaultPasswordHash,
          department: 'Reservoir Fluids Division',
          isActive: true,
          isDefaultPassword: true,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Ensure all users have email and isDefaultPassword populated
    const allUsers = await db.localUsers.toArray();
    for (const u of allUsers) {
      const updates: Partial<LocalUser> = {};
      if (!u.email) {
        if (u.username.includes('@')) {
          updates.email = u.username.toLowerCase();
        } else if (u.username === 'admin' || u.username === 'ddzek258') {
          updates.email = 'ddzek258@gmail.com';
        } else {
          updates.email = `${u.username.toLowerCase()}@gmail.com`;
        }
      }
      if (u.isDefaultPassword === undefined) {
        updates.isDefaultPassword = (
          u.passwordHash === defaultPasswordHash ||
          u.passwordHash === legacyAdminHash ||
          u.passwordHash === '37ad8b3e8e2fa53a793a525bc8b9813c965c404cf1e2ebcd1154c502573f0896' ||
          u.passwordHash === 'bb72076295ee8cfb186b432a51f8fd60e34c567bb014fb00ae1f9c8f001efc9b'
        );
      }
      if (Object.keys(updates).length > 0) {
        await db.localUsers.update(u.id, updates);
      }
    }
  } catch (err) {
    console.error('Error synchronizing default user credentials:', err);
  }
}

// Initial Seeder for testing and first-time experience
export async function seedInitialDatabaseIfEmpty() {
  const usersCount = await db.localUsers.count();
  if (usersCount > 0) {
    await syncDefaultUserCredentials();
    return; // Already initialized
  }

  console.log('Seeding PVT Analysis System initial local database...');

  // Default secret code: 123456
  // SHA-256 for '123456': 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
  const defaultPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

  const initialUsers: LocalUser[] = [
    {
      id: 'USR-ADMIN',
      username: 'ddzek258',
      email: 'ddzek258@gmail.com',
      fullName: 'Dr. Tariq Al-Husseini (Admin)',
      role: 'Administrator',
      passwordHash: defaultPasswordHash, // 123456
      department: 'Reservoir Fluids Division',
      isActive: true,
      isDefaultPassword: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'USR-ENG-1',
      username: 'engineer',
      email: 'engineer@gmail.com',
      fullName: 'Eng. Sarah Al-Khafaji (PVT Specialist)',
      role: 'Engineer',
      passwordHash: defaultPasswordHash, // 123456
      department: 'Fluid PVT Laboratory',
      isActive: true,
      isDefaultPassword: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'USR-READONLY',
      username: 'viewer',
      email: 'viewer@gmail.com',
      fullName: 'Eng. Omar Mansour (Auditor)',
      role: 'ReadOnly',
      passwordHash: defaultPasswordHash, // 123456
      department: 'Reservoir Engineering Dept.',
      isActive: true,
      isDefaultPassword: true,
      createdAt: new Date().toISOString(),
    },
  ];
  await db.localUsers.bulkAdd(initialUsers);

  // Initial Fields
  const initialFields: FieldRecord[] = [
    {
      id: 'FLD-NORTH-RUMAILA',
      name: 'North Rumaila (شمال الرميلة)',
      code: 'NRML',
      alternativeNames: ['Rumaila North', 'RN'],
      location: 'Southern Basin, Basra',
      operator: 'Basra Oil Company (BOC)',
      remarks: 'Supergiant Cretaceous sandstone/carbonate field',
      isArchived: false,
      createdAt: '2024-01-10T08:00:00Z',
      updatedAt: '2024-01-10T08:00:00Z',
    },
    {
      id: 'FLD-WEST-QURNA',
      name: 'West Qurna 1 (غرب القرنة 1)',
      code: 'WQ-1',
      alternativeNames: ['WQ1', 'West Qurna'],
      location: 'Basra Governorate',
      operator: 'PetroChina / BOC',
      remarks: 'Mishrif carbonate development',
      isArchived: false,
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-15T09:00:00Z',
    },
    {
      id: 'FLD-MAJNOON',
      name: 'Majnoon (مجنون)',
      code: 'MJN',
      alternativeNames: ['Majnoon Field'],
      location: 'Basra - Marshlands border',
      operator: 'Basra Oil Company',
      remarks: 'Multi-layer complex fluids',
      isArchived: false,
      createdAt: '2024-02-01T10:00:00Z',
      updatedAt: '2024-02-01T10:00:00Z',
    },
  ];
  await db.fields.bulkAdd(initialFields);

  // Initial Formations
  const initialFormations: FormationRecord[] = [
    {
      id: 'FRM-MISHRIF',
      name: 'Mishrif Formation (تكوين المشرف)',
      geologicalAge: 'Cenomanian-Turonian (Upper Cretaceous)',
      lithology: 'Bioclastic Limestone & Grainstone',
      remarks: 'Major productive carbonate reservoir across southern Iraq',
      isArchived: false,
      createdAt: '2024-01-10T08:15:00Z',
      updatedAt: '2024-01-10T08:15:00Z',
    },
    {
      id: 'FRM-ZUBAIR',
      name: 'Zubair Formation (تكوين الزبير)',
      geologicalAge: 'Hauterivian-Barremian (Lower Cretaceous)',
      lithology: 'Sandstone intercalated with shales',
      remarks: 'Prolific main pay sand sequence (Main Pay, Upper Sand)',
      isArchived: false,
      createdAt: '2024-01-10T08:20:00Z',
      updatedAt: '2024-01-10T08:20:00Z',
    },
    {
      id: 'FRM-YAMAMA',
      name: 'Yamama Formation (تكوين اليمامة)',
      geologicalAge: 'Berriasian-Valanginian (Lower Cretaceous)',
      lithology: 'Oolitic & Peloidal Limestone',
      remarks: 'Deep volatile oil and gas condensate potential',
      isArchived: false,
      createdAt: '2024-01-10T08:25:00Z',
      updatedAt: '2024-01-10T08:25:00Z',
    },
  ];
  await db.formations.bulkAdd(initialFormations);

  // Initial Reservoirs
  const initialReservoirs: ReservoirRecord[] = [
    {
      id: 'RES-RUMAILA-MISHRIF',
      name: 'Mishrif MB1 (مشرف وحدة MB1)',
      fieldId: 'FLD-NORTH-RUMAILA',
      formationId: 'FRM-MISHRIF',
      lithology: 'Porous Rudistid Limestone',
      driveMechanism: 'Bottom Water Drive with Gas Injection',
      depthAverage: 7850,
      remarks: 'Primary oil accumulation, medium gravity oil',
      isArchived: false,
      createdAt: '2024-01-10T08:30:00Z',
      updatedAt: '2024-01-10T08:30:00Z',
    },
    {
      id: 'RES-RUMAILA-ZUBAIR-MP',
      name: 'Zubair Main Pay (زبير المكمن الرئيسي)',
      fieldId: 'FLD-NORTH-RUMAILA',
      formationId: 'FRM-ZUBAIR',
      lithology: 'Clean quartzose sandstone',
      driveMechanism: 'Edge water drive + Rock & fluid expansion',
      depthAverage: 10600,
      remarks: 'High API light crude oil',
      isArchived: false,
      createdAt: '2024-01-10T08:35:00Z',
      updatedAt: '2024-01-10T08:35:00Z',
    },
    {
      id: 'RES-WQ1-MISHRIF',
      name: 'West Qurna Mishrif Unit A',
      fieldId: 'FLD-WEST-QURNA',
      formationId: 'FRM-MISHRIF',
      lithology: 'Peloidal wackestone / packstone',
      driveMechanism: 'Water drive',
      depthAverage: 7920,
      remarks: 'Sweet crude, low GOR',
      isArchived: false,
      createdAt: '2024-01-15T09:15:00Z',
      updatedAt: '2024-01-15T09:15:00Z',
    },
  ];
  await db.reservoirs.bulkAdd(initialReservoirs);

  // Initial Wells
  const initialWells: WellRecord[] = [
    {
      id: 'WEL-NR-142',
      name: 'NR-142 (ش.ر-142)',
      fieldId: 'FLD-NORTH-RUMAILA',
      reservoirId: 'RES-RUMAILA-MISHRIF',
      formationId: 'FRM-MISHRIF',
      wellType: 'Producer',
      spudDate: '2022-04-18',
      surfaceCoordinates: '30.5821° N, 47.4112° E',
      totalDepth: 8250,
      remarks: 'Vertical production well, perforation at 7820-7860 ft',
      isArchived: false,
      createdAt: '2024-01-10T09:00:00Z',
      updatedAt: '2024-01-10T09:00:00Z',
    },
    {
      id: 'WEL-NR-205',
      name: 'NR-205 (ش.ر-205)',
      fieldId: 'FLD-NORTH-RUMAILA',
      reservoirId: 'RES-RUMAILA-ZUBAIR-MP',
      formationId: 'FRM-ZUBAIR',
      wellType: 'Producer',
      spudDate: '2021-11-05',
      surfaceCoordinates: '30.6120° N, 47.3890° E',
      totalDepth: 11200,
      remarks: 'Deep producer in Zubair Main Pay sand',
      isArchived: false,
      createdAt: '2024-01-10T09:10:00Z',
      updatedAt: '2024-01-10T09:10:00Z',
    },
    {
      id: 'WEL-WQ-033',
      name: 'WQ-033',
      fieldId: 'FLD-WEST-QURNA',
      reservoirId: 'RES-WQ1-MISHRIF',
      formationId: 'FRM-MISHRIF',
      wellType: 'Appraisal',
      spudDate: '2023-02-12',
      surfaceCoordinates: '30.7410° N, 47.3320° E',
      totalDepth: 8400,
      remarks: 'Appraisal core & bottom-hole sampling well',
      isArchived: false,
      createdAt: '2024-01-15T09:30:00Z',
      updatedAt: '2024-01-15T09:30:00Z',
    },
  ];
  await db.wells.bulkAdd(initialWells);

  // Initial Samples
  const initialSamples: SampleRecord[] = [
    {
      id: 'SMP-2024-001',
      sampleCode: 'NR142-M-BH1',
      fieldId: 'FLD-NORTH-RUMAILA',
      reservoirId: 'RES-RUMAILA-MISHRIF',
      formationId: 'FRM-MISHRIF',
      wellId: 'WEL-NR-142',
      fluidType: 'Black Oil',
      sampleType: 'Bottom Hole',
      samplingDate: '2024-03-12',
      samplingMethod: 'Schlumberger MDT Single Phase Chamber (SPMC)',
      samplingDepth: 7842,
      samplingPressure: 3410,
      samplingTemperature: 195,
      cylinderNumber: 'CYL-SLB-8842',
      sampleSource: 'Subsurface wireline formation tester',
      transportCondition: 'Pressurized shipping crate, sealed valve with safety caps',
      reservoirPressure: 3425,
      reservoirTemperature: 196,
      saturationPressure: 1820,
      sampleStatus: 'Valid',
      qualityNotes: 'Zero water cut, bubble point confirmed at 1820 psi @ 196°F, excellent sample validity.',
      remarks: 'Official benchmark sample for Reservoir Fluids Division simulation study',
      isArchived: false,
      createdAt: '2024-03-14T10:00:00Z',
      updatedAt: '2024-03-14T10:00:00Z',
    },
    {
      id: 'SMP-2024-002',
      sampleCode: 'NR205-Z-REC2',
      fieldId: 'FLD-NORTH-RUMAILA',
      reservoirId: 'RES-RUMAILA-ZUBAIR-MP',
      formationId: 'FRM-ZUBAIR',
      wellId: 'WEL-NR-205',
      fluidType: 'Volatile Oil',
      sampleType: 'Recombined',
      samplingDate: '2024-04-05',
      samplingMethod: 'Surface test separator gas and liquid recombined to test GOR',
      samplingDepth: 10580,
      samplingPressure: 4890,
      samplingTemperature: 232,
      cylinderNumber: 'CYL-BOC-1029 & GAS-550',
      sampleSource: 'Production Test Separator at DS-3',
      transportCondition: 'Heated transport, DOT 3AA-5000 cylinder',
      reservoirPressure: 4920,
      reservoirTemperature: 235,
      saturationPressure: 3260,
      sampleStatus: 'Valid',
      qualityNotes: 'Recombination ratio validated with separator GOR 945 scf/stb.',
      remarks: 'High API volatile oil study for Zubair Main Pay extension',
      isArchived: false,
      createdAt: '2024-04-08T11:00:00Z',
      updatedAt: '2024-04-08T11:00:00Z',
    },
    {
      id: 'SMP-2024-003',
      sampleCode: 'WQ033-M-SEP1',
      fieldId: 'FLD-WEST-QURNA',
      reservoirId: 'RES-WQ1-MISHRIF',
      formationId: 'FRM-MISHRIF',
      wellId: 'WEL-WQ-033',
      fluidType: 'Black Oil',
      sampleType: 'Separator Liquid',
      samplingDate: '2024-05-18',
      samplingMethod: 'High pressure separator liquid sampling bottle',
      samplingDepth: 7915,
      samplingPressure: 210,
      samplingTemperature: 110,
      cylinderNumber: 'CYL-CORE-401',
      sampleSource: 'Separator test vessel Unit 2',
      transportCondition: 'Ambient sealed storage',
      reservoirPressure: 3380,
      reservoirTemperature: 192,
      saturationPressure: 1650,
      sampleStatus: 'Valid',
      qualityNotes: 'BS&W 0.2%, acceptable salinity profile',
      remarks: 'Routine separator liquid PVT check',
      isArchived: false,
      createdAt: '2024-05-20T09:30:00Z',
      updatedAt: '2024-05-20T09:30:00Z',
    },
  ];
  await db.samples.bulkAdd(initialSamples);

  // Initial Analysis Records
  const initialAnalyses: AnalysisRecord[] = [
    {
      id: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      reportNumber: 'PVT-RFD-2024-044',
      laboratory: 'Central Reservoir Fluids Core Laboratory',
      testType: 'Complete PVT Study',
      analysisDate: '2024-03-22',
      analystName: 'Eng. Sarah Al-Khafaji',
      testTemperature: 196,
      saturationPressure: 1820,
      bubblePointPressure: 1820,
      gasOilRatio: 485,
      formationVolumeFactorBo: 1.285,
      oilViscosityAtPb: 1.74,
      oilDensity: 0.852,
      gasGravity: 0.884,
      status: 'Verified',
      remarks: 'Comprehensive PVT study including CCE, Differential Liberation, Separator Test, and Viscosity',
      isArchived: false,
      createdAt: '2024-03-24T14:00:00Z',
      updatedAt: '2024-03-24T14:00:00Z',
    },
    {
      id: 'ANL-2024-102',
      sampleId: 'SMP-2024-002',
      reportNumber: 'PVT-RFD-2024-058',
      laboratory: 'Basra Oil Company Fluids Laboratory',
      testType: 'CCE',
      analysisDate: '2024-04-16',
      analystName: 'Dr. Tariq Al-Husseini',
      testTemperature: 235,
      saturationPressure: 3260,
      bubblePointPressure: 3260,
      gasOilRatio: 945,
      formationVolumeFactorBo: 1.542,
      oilViscosityAtPb: 0.62,
      oilDensity: 0.798,
      gasGravity: 0.795,
      status: 'Completed',
      remarks: 'CCE and Viscosity study on Zubair volatile sample',
      isArchived: false,
      createdAt: '2024-04-18T10:15:00Z',
      updatedAt: '2024-04-18T10:15:00Z',
    },
  ];
  await db.analysisRecords.bulkAdd(initialAnalyses);

  // Initial PVT Properties for Analysis ANL-2024-101
  const initialProperties: PVTPropertyRecord[] = [
    {
      id: 'PRP-001',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Bubble Point Pressure (Pb)',
      category: 'Saturation',
      pressure: 1820,
      temperature: 196,
      value: 1820,
      unit: 'psi',
      isMeasured: true,
      testMethod: 'Visual CCE Cell Inflexion',
      reportSource: 'Table 2.1 in PVT-RFD-2024-044',
      remarks: 'Sharp volume discontinuity observed at 1820 psig',
      isArchived: false,
    },
    {
      id: 'PRP-002',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Oil Formation Volume Factor (Bo at Pb)',
      category: 'Differential Liberation',
      pressure: 1820,
      temperature: 196,
      value: 1.285,
      unit: 'rb/stb',
      isMeasured: true,
      testMethod: 'Differential Liberation Step 1',
      reportSource: 'Table 4.2 in PVT-RFD-2024-044',
      remarks: 'Measured relative to residual oil at 60°F',
      isArchived: false,
    },
    {
      id: 'PRP-003',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Solution Gas-Oil Ratio (Rs at Pb)',
      category: 'Differential Liberation',
      pressure: 1820,
      temperature: 196,
      value: 485,
      unit: 'scf/stb',
      isMeasured: true,
      testMethod: 'Gas Metering / Differential Liberation',
      reportSource: 'Table 4.2 in PVT-RFD-2024-044',
      remarks: 'Standard condition gas liberation',
      isArchived: false,
    },
    {
      id: 'PRP-004',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Oil Viscosity at Pb',
      category: 'Viscosity',
      pressure: 1820,
      temperature: 196,
      value: 1.74,
      unit: 'cp',
      isMeasured: true,
      testMethod: 'Electromagnetic Viscometer',
      reportSource: 'Table 5.1 in PVT-RFD-2024-044',
      remarks: 'Minimum oil viscosity at saturation pressure',
      isArchived: false,
    },
    {
      id: 'PRP-005',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Oil Density at Pb',
      category: 'Saturation',
      pressure: 1820,
      temperature: 196,
      value: 0.852,
      unit: 'g/cm³',
      isMeasured: true,
      testMethod: 'High Pressure Anton Paar DMA',
      reportSource: 'Table 2.3 in PVT-RFD-2024-044',
      remarks: 'Equivalent to 34.6 °API stock tank oil',
      isArchived: false,
    },
    {
      id: 'PRP-006',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Separator GOR (Stage 1 @ 100 psig)',
      category: 'Separator Test',
      pressure: 100,
      temperature: 80,
      value: 412,
      unit: 'scf/stb',
      isMeasured: true,
      testMethod: '2-Stage Laboratory Separator Flash',
      reportSource: 'Table 6.1 in PVT-RFD-2024-044',
      remarks: 'Separator optimal pressure evaluation',
      isArchived: false,
    },
    // Composition mole%
    {
      id: 'PRP-007',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Methane (C1)',
      category: 'Composition',
      value: 36.42,
      unit: 'mol%',
      isMeasured: true,
      testMethod: 'Gas Chromatography (GC)',
      reportSource: 'Table 1.1 in PVT-RFD-2024-044',
      remarks: 'Fluid composition analysis',
      isArchived: false,
    },
    {
      id: 'PRP-008',
      analysisId: 'ANL-2024-101',
      sampleId: 'SMP-2024-001',
      propertyName: 'Heptanes Plus (C7+)',
      category: 'Composition',
      value: 41.15,
      unit: 'mol%',
      isMeasured: true,
      testMethod: 'High Temperature GC',
      reportSource: 'Table 1.1 in PVT-RFD-2024-044',
      remarks: 'C7+ molecular weight 224 g/mol, specific gravity 0.886',
      isArchived: false,
    },
  ];
  await db.pvtProperties.bulkAdd(initialProperties);

  // Initial Reports
  const initialReports: ReportRecord[] = [
    {
      id: 'REP-2024-044',
      reportNumber: 'PVT-RFD-2024-044',
      title: 'Full Reservoir Fluid Study on Mishrif Reservoir Well NR-142',
      reportDate: '2024-03-24',
      laboratory: 'Central Reservoir Fluids Core Laboratory',
      status: 'Final',
      linkedType: 'Sample',
      linkedId: 'SMP-2024-001',
      remarks: 'Primary certified technical report with official seal',
      isArchived: false,
      createdAt: '2024-03-24T14:30:00Z',
      updatedAt: '2024-03-24T14:30:00Z',
    },
    {
      id: 'REP-2024-058',
      reportNumber: 'PVT-RFD-2024-058',
      title: 'Zubair Volatile Oil PVT Study Well NR-205',
      reportDate: '2024-04-18',
      laboratory: 'Basra Oil Company Fluids Laboratory',
      status: 'Final',
      linkedType: 'Sample',
      linkedId: 'SMP-2024-002',
      remarks: 'Validated against surface separator data',
      isArchived: false,
      createdAt: '2024-04-18T11:00:00Z',
      updatedAt: '2024-04-18T11:00:00Z',
    },
  ];
  await db.reports.bulkAdd(initialReports);

  // Initial Sample PDF Attachment generated as valid PDF blob
  const samplePdfBytes = createSampleReportPdf();
  const samplePdfBlob = new Blob([samplePdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const hashBuffer = await crypto.subtle.digest('SHA-256', samplePdfBytes.buffer as ArrayBuffer);
  const samplePdfChecksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const sampleAttachment: AttachmentRecord = {
    id: 'ATT-2024-001',
    reportId: 'REP-2024-044',
    sampleId: 'SMP-2024-001',
    wellId: 'WEL-NR-142',
    linkedType: 'Sample',
    linkedId: 'SMP-2024-001',
    fileName: 'PVT-RFD-2024-044_NR142_Mishrif_Study.pdf',
    fileType: 'application/pdf',
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
    fileSize: samplePdfBlob.size,
    blob: samplePdfBlob,
    storageBackend: 'IndexedDB',
    checksum: samplePdfChecksum,
    uploadDate: '2024-03-24T15:00:00Z',
    version: 1,
    description: 'Final Certified PVT Report for Mishrif Well NR-142',
    reportNumber: 'PVT-RFD-2024-044',
    isArchived: false,
  };
  await db.attachments.add(sampleAttachment);

  // App Settings
  await db.appSettings.bulkPut([
    { key: 'language', value: 'ar' },
    { key: 'pressureUnit', value: 'psi' },
    { key: 'temperatureUnit', value: 'degF' },
    { key: 'gasVolumeUnit', value: 'scf/stb' },
    { key: 'oilVolumeUnit', value: 'rb/stb' },
    { key: 'systemInitializedAt', value: new Date().toISOString() },
    { key: 'schemaVersion', value: '1.0.0' },
  ]);

  // Initial Audit log
  await logAuditEvent({
    userId: 'USR-ADMIN',
    userName: 'System Initialization',
    actionType: 'SETTINGS_CHANGED',
    entityType: 'System',
    entityId: 'INIT-01',
    details: 'Initial database schema and reference petroleum reservoirs seeded successfully.',
  });

  console.log('Seeding completed successfully.');
}

// Minimal valid PDF generator for local offline report preview without external server
function createSampleReportPdf(): Uint8Array {
  const content = `%PDF-1.4
1 0 obj
<< /Title (PVT Laboratory Report PVT-RFD-2024-044)
   /Author (Reservoir Fluids Division)
   /Creator (PVT Analysis System) >>
endobj
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page
   /Parent 3 0 R
   /MediaBox [0 0 612 792]
   /Contents 5 0 R
   /Resources << /Font << /F1 6 0 R >> >>
>>
endobj
5 0 obj
<< /Length 440 >>
stream
BT
/F1 20 Tf
50 720 Td
(RESERVOIR FLUIDS DIVISION) Tj
/F1 14 Tf
0 -30 Td
(CENTRAL PETROLEUM PVT LABORATORY REPORT) Tj
/F1 11 Tf
0 -26 Td
(Report Number: PVT-RFD-2024-044) Tj
0 -18 Td
(Field: North Rumaila | Reservoir: Mishrif MB1 | Well: NR-142) Tj
0 -18 Td
(Sample Code: NR142-M-BH1 | Type: Bottom Hole Sample) Tj
0 -25 Td
(SUMMARY OF PVT TEST RESULTS:) Tj
0 -18 Td
(- Bubble Point Pressure (Pb): 1,820 psig @ 196 deg F) Tj
0 -18 Td
(- Solution GOR (Rs): 485 scf/stb) Tj
0 -18 Td
(- Oil FVF (Bo at Pb): 1.285 rb/stb) Tj
0 -18 Td
(- Oil Viscosity: 1.74 cp @ Pb) Tj
0 -18 Td
(- Density: 0.852 g/cm3 (34.6 deg API)) Tj
0 -30 Td
(Certified Offline Archive Copy - Reservoir Fluids Division) Tj
ET
endstream
endobj
6 0 obj
<< /Type /Font
   /Subtype /Type1
   /BaseFont /Helvetica-Bold
>>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000135 00000 n 
0000000185 00000 n 
0000000244 00000 n 
0000000388 00000 n 
0000000880 00000 n 
trailer
<< /Size 7 /Root 2 0 R /Info 1 0 R >>
startxref
965
%%EOF`;

  return new TextEncoder().encode(content);
}
