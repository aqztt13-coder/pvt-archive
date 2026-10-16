import JSZip from 'jszip';
import { db, logAuditEvent } from '../db/pvtDb';
import { getAttachmentBlob, computeArrayBufferSHA256, isOPFSSupported, getOPFSVaultDir } from './storageService';
import type { AttachmentRecord } from '../types';

export interface BackupManifest {
  version: string;
  appName: string;
  createdAt: string;
  isEncrypted: boolean;
  counts: {
    fields: number;
    reservoirs: number;
    formations: number;
    wells: number;
    samples: number;
    analyses: number;
    pvtProperties: number;
    reports: number;
    attachments: number;
    users: number;
    auditLogs: number;
  };
  checksums: Record<string, string>; // attachmentId -> SHA-256
}

// AES-GCM Encryption / Decryption using Web Crypto API
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createFullBackup(password?: string): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();

  // Export structured tables
  const fields = await db.fields.toArray();
  const reservoirs = await db.reservoirs.toArray();
  const formations = await db.formations.toArray();
  const wells = await db.wells.toArray();
  const samples = await db.samples.toArray();
  const analyses = await db.analysisRecords.toArray();
  const pvtProperties = await db.pvtProperties.toArray();
  const reports = await db.reports.toArray();
  const users = await db.localUsers.toArray();
  const auditLogs = await db.auditLogs.toArray();
  const appSettings = await db.appSettings.toArray();
  const attachments = await db.attachments.toArray();

  const checksums: Record<string, string> = {};

  // Add binary attachments into attachments/ folder
  const attachmentsFolder = zip.folder('attachments');

  for (const att of attachments) {
    checksums[att.id] = att.checksum;
    if (attachmentsFolder) {
      try {
        const fileBlob = await getAttachmentBlob(att.id);
        const arrayBuf = await fileBlob.arrayBuffer();
        attachmentsFolder.file(att.id, arrayBuf);
      } catch (err) {
        console.warn(`Could not read attachment ${att.id} during backup creation:`, err);
        if (att.blob) {
          attachmentsFolder.file(att.id, att.blob);
        }
      }
    }
  }

  const manifest: BackupManifest = {
    version: '2.0.0',
    appName: 'PVT Analysis System - Reservoir Fluids Division',
    createdAt: new Date().toISOString(),
    isEncrypted: !!password,
    counts: {
      fields: fields.length,
      reservoirs: reservoirs.length,
      formations: formations.length,
      wells: wells.length,
      samples: samples.length,
      analyses: analyses.length,
      pvtProperties: pvtProperties.length,
      reports: reports.length,
      attachments: attachments.length,
      users: users.length,
      auditLogs: auditLogs.length,
    },
    checksums,
  };

  const databaseData = {
    fields,
    reservoirs,
    formations,
    wells,
    samples,
    analyses,
    pvtProperties,
    reports,
    users,
    auditLogs,
    appSettings,
    attachmentsMeta: attachments.map(att => ({
      id: att.id,
      reportId: att.reportId,
      sampleId: att.sampleId,
      wellId: att.wellId,
      reservoirId: att.reservoirId,
      fieldId: att.fieldId,
      analysisId: att.analysisId,
      linkedType: att.linkedType,
      linkedId: att.linkedId,
      fileName: att.fileName,
      fileType: att.fileType,
      mimeType: att.mimeType,
      fileExtension: att.fileExtension,
      fileSize: att.fileSize,
      storageBackend: att.storageBackend,
      checksum: att.checksum,
      uploadDate: att.uploadDate,
      version: att.version,
      description: att.description,
      reportNumber: att.reportNumber,
      isArchived: att.isArchived,
      replacedVersionId: att.replacedVersionId,
    })),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('database.json', JSON.stringify(databaseData, null, 2));

  const rawZipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  let finalBlob: Blob = rawZipBlob;
  let filename = `PVT_System_Backup_${new Date().toISOString().slice(0, 10)}.zip`;

  if (password && password.trim()) {
    // Encrypt the ZIP buffer with AES-GCM
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const rawBuffer = await rawZipBlob.arrayBuffer();

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      rawBuffer
    );

    // Structure: [16 bytes salt] [12 bytes IV] [encrypted bytes]
    const encryptedCombined = new Uint8Array(salt.byteLength + iv.byteLength + encryptedData.byteLength);
    encryptedCombined.set(salt, 0);
    encryptedCombined.set(iv, salt.byteLength);
    encryptedCombined.set(new Uint8Array(encryptedData), salt.byteLength + iv.byteLength);

    finalBlob = new Blob([encryptedCombined], { type: 'application/octet-stream' });
    filename = `PVT_System_Backup_${new Date().toISOString().slice(0, 10)}.pvtbackup`;
  }

  return { blob: finalBlob, filename };
}

export async function inspectBackupFile(file: File, password?: string): Promise<{
  manifest: BackupManifest;
  zip: JSZip;
}> {
  let fileBuffer = await file.arrayBuffer();

  // If encrypted file (.pvtbackup or user provided password)
  if (password && password.trim()) {
    const bytes = new Uint8Array(fileBuffer);
    if (bytes.length < 28) {
      throw new Error('Invalid backup file length.');
    }
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const encryptedContent = bytes.slice(28);

    const key = await deriveKey(password, salt);
    try {
      fileBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedContent
      );
    } catch {
      throw new Error('Incorrect decryption password or corrupted backup file.');
    }
  }

  const zip = await JSZip.loadAsync(fileBuffer);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('manifest.json missing from backup archive.');
  }

  const manifestText = await manifestFile.async('text');
  const manifest: BackupManifest = JSON.parse(manifestText);

  return { manifest, zip };
}

export async function restoreBackup(
  zip: JSZip,
  userId: string,
  userName: string,
  createSafetySnapshot = true
): Promise<{ success: boolean; message: string; verifiedCount: number; errorCount: number }> {
  const dbFile = zip.file('database.json');
  if (!dbFile) {
    throw new Error('database.json missing from backup package.');
  }

  const manifestFile = zip.file('manifest.json');
  let expectedChecksums: Record<string, string> = {};
  if (manifestFile) {
    const manifestText = await manifestFile.async('text');
    const parsedManifest = JSON.parse(manifestText);
    expectedChecksums = parsedManifest.checksums || {};
  }

  // Optional: Automatically trigger safety snapshot before committing destructive restore
  if (createSafetySnapshot) {
    try {
      const { blob, filename } = await createFullBackup();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `SAFETY_SNAPSHOT_PRE_RESTORE_${filename}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (snapshotErr) {
      console.warn('Safety snapshot creation failed, proceeding with caution:', snapshotErr);
    }
  }

  const dbText = await dbFile.async('text');
  const data = JSON.parse(dbText);

  let verifiedCount = 0;
  let errorCount = 0;

  // Restore database tables
  await db.transaction('rw', [
    db.fields,
    db.reservoirs,
    db.formations,
    db.wells,
    db.samples,
    db.analysisRecords,
    db.pvtProperties,
    db.reports,
    db.attachments,
    db.localUsers,
    db.auditLogs,
    db.appSettings,
  ], async () => {
    await db.fields.clear();
    await db.reservoirs.clear();
    await db.formations.clear();
    await db.wells.clear();
    await db.samples.clear();
    await db.analysisRecords.clear();
    await db.pvtProperties.clear();
    await db.reports.clear();
    await db.attachments.clear();
    await db.localUsers.clear();
    await db.appSettings.clear();

    if (data.fields?.length) await db.fields.bulkAdd(data.fields);
    if (data.reservoirs?.length) await db.reservoirs.bulkAdd(data.reservoirs);
    if (data.formations?.length) await db.formations.bulkAdd(data.formations);
    if (data.wells?.length) await db.wells.bulkAdd(data.wells);
    if (data.samples?.length) await db.samples.bulkAdd(data.samples);
    if (data.analyses?.length) await db.analysisRecords.bulkAdd(data.analyses);
    if (data.pvtProperties?.length) await db.pvtProperties.bulkAdd(data.pvtProperties);
    if (data.reports?.length) await db.reports.bulkAdd(data.reports);
    if (data.users?.length) await db.localUsers.bulkAdd(data.users);
    if (data.appSettings?.length) await db.appSettings.bulkAdd(data.appSettings);

    // Restore attachments binary blobs & verify checksums (dual write to OPFS & IndexedDB)
    const restoredAttachments: AttachmentRecord[] = [];
    if (data.attachmentsMeta?.length) {
      const opfsDir = await getOPFSVaultDir();
      for (const meta of data.attachmentsMeta) {
        const fileInZip = zip.file(`attachments/${meta.id}`);
        let blob: Blob;

        if (fileInZip) {
          const buffer = await fileInZip.async('arraybuffer');
          const calcChecksum = await computeArrayBufferSHA256(buffer);
          const expected = expectedChecksums[meta.id] || meta.checksum;

          if (expected && calcChecksum !== expected) {
            console.error(`Checksum mismatch on restore for ${meta.fileName}: expected ${expected}, got ${calcChecksum}`);
            errorCount++;
          } else {
            verifiedCount++;
          }

          // Write restored binary copy directly to OPFS if supported
          if (opfsDir) {
            try {
              const fileHandle = await opfsDir.getFileHandle(`${meta.id}.bin`, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(buffer);
              await writable.close();
            } catch (opfsErr) {
              console.warn(`Could not sync restored file ${meta.id} to OPFS:`, opfsErr);
            }
          }

          blob = new Blob([buffer], { type: meta.fileType || meta.mimeType || 'application/octet-stream' });
        } else {
          blob = new Blob([''], { type: meta.fileType || 'application/octet-stream' });
          errorCount++;
        }

        restoredAttachments.push({
          ...meta,
          blob,
        });
      }

      if (restoredAttachments.length) {
        await db.attachments.bulkAdd(restoredAttachments);
      }
    }
  });

  await logAuditEvent({
    userId,
    userName,
    actionType: 'RESTORE_EXECUTED',
    entityType: 'SystemBackup',
    entityId: `RESTORE-${Date.now()}`,
    details: `Restored ${data.samples?.length || 0} samples, ${data.reports?.length || 0} reports, ${verifiedCount} verified files (${errorCount} errors).`,
  });

  return {
    success: true,
    message: `Restore completed successfully. Verified ${verifiedCount} files (${errorCount} errors).`,
    verifiedCount,
    errorCount,
  };
}
