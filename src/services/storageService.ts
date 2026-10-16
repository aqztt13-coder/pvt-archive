import { db, logAuditEvent } from '../db/pvtDb';
import type { AttachmentRecord } from '../types';

const OPFS_VAULT_DIR = 'pvt_vault';

export async function isOPFSSupported(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      const root = await navigator.storage.getDirectory();
      return !!root;
    }
  } catch {
    return false;
  }
  return false;
}

export async function computeArrayBufferSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getOPFSVaultDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (await isOPFSSupported()) {
      const root = await navigator.storage.getDirectory();
      return await root.getDirectoryHandle(OPFS_VAULT_DIR, { create: true });
    }
  } catch (err) {
    console.warn('OPFS directory access unavailable, falling back to IndexedDB Blobs:', err);
  }
  return null;
}

export interface SaveAttachmentInput {
  file: File | Blob;
  fileName: string;
  reportId?: string;
  sampleId?: string;
  wellId?: string;
  reservoirId?: string;
  fieldId?: string;
  analysisId?: string;
  linkedType: AttachmentRecord['linkedType'];
  linkedId: string;
  description?: string;
  reportNumber?: string;
  userId: string;
  userName: string;
  onProgress?: (percent: number) => void;
}

export async function saveAttachment(input: SaveAttachmentInput): Promise<AttachmentRecord> {
  const id = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fileExt = input.fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = input.file.type || 'application/octet-stream';
  const fileSize = input.file.size;

  if (input.onProgress) input.onProgress(15);

  const arrayBuffer = await input.file.arrayBuffer();
  if (input.onProgress) input.onProgress(45);

  // Calculate cryptographic SHA-256 checksum
  const checksum = await computeArrayBufferSHA256(arrayBuffer);
  if (input.onProgress) input.onProgress(70);

  let storageBackend: 'OPFS' | 'IndexedDB' = 'IndexedDB';
  let blobToStoreInIndexedDB: Blob | undefined = input.file;

  // Attempt OPFS storage first
  const opfsDir = await getOPFSVaultDir();
  if (opfsDir) {
    try {
      const fileHandle = await opfsDir.getFileHandle(`${id}.bin`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(arrayBuffer);
      await writable.close();

      // Verify read-back from OPFS to guarantee data integrity
      const writtenFile = await fileHandle.getFile();
      const readBuffer = await writtenFile.arrayBuffer();
      const verifiedChecksum = await computeArrayBufferSHA256(readBuffer);

      if (verifiedChecksum === checksum) {
        storageBackend = 'OPFS';
        // When stored in OPFS, we keep IndexedDB lightweight or hold blob as secondary fallback
        blobToStoreInIndexedDB = input.file;
      }
    } catch (opfsErr) {
      console.warn('OPFS write failed, relying on IndexedDB Blob:', opfsErr);
      storageBackend = 'IndexedDB';
      blobToStoreInIndexedDB = input.file;
    }
  }

  if (input.onProgress) input.onProgress(90);

  const record: AttachmentRecord = {
    id,
    reportId: input.reportId,
    sampleId: input.sampleId,
    wellId: input.wellId,
    reservoirId: input.reservoirId,
    fieldId: input.fieldId,
    analysisId: input.analysisId,
    linkedType: input.linkedType,
    linkedId: input.linkedId,
    fileName: input.fileName,
    fileType: mimeType,
    mimeType,
    fileExtension: fileExt,
    fileSize,
    blob: blobToStoreInIndexedDB,
    storageBackend,
    checksum,
    uploadDate: now,
    version: 1,
    description: input.description,
    reportNumber: input.reportNumber,
    isArchived: false,
  };

  await db.attachments.add(record);

  await logAuditEvent({
    userId: input.userId,
    userName: input.userName,
    actionType: 'UPLOAD_ATTACHMENT',
    entityType: 'Attachment',
    entityId: id,
    details: `Saved ${input.fileName} (${Math.round(fileSize / 1024)} KB, SHA-256: ${checksum.substring(0, 10)}...) via ${storageBackend}.`,
  });

  if (input.onProgress) input.onProgress(100);

  return record;
}

export async function getAttachmentBlob(id: string): Promise<Blob> {
  const record = await db.attachments.get(id);
  if (!record) {
    throw new Error(`Attachment record ${id} not found in database.`);
  }

  // 1. Try retrieving from OPFS if recorded as OPFS
  if (record.storageBackend === 'OPFS') {
    const opfsDir = await getOPFSVaultDir();
    if (opfsDir) {
      try {
        const fileHandle = await opfsDir.getFileHandle(`${id}.bin`);
        const file = await fileHandle.getFile();
        if (file && file.size > 0) {
          return file;
        }
      } catch (err) {
        console.warn(`OPFS read failed for ${id}, falling back to IndexedDB copy:`, err);
      }
    }
  }

  // 2. Return IndexedDB Blob
  if (record.blob && record.blob.size > 0) {
    return record.blob;
  }

  throw new Error(`Binary file content for ${record.fileName} (${id}) is missing or corrupted.`);
}

export async function verifyAttachmentIntegrity(id: string): Promise<{
  valid: boolean;
  expectedChecksum: string;
  calculatedChecksum: string;
  size: number;
  storageBackend: 'OPFS' | 'IndexedDB';
}> {
  const record = await db.attachments.get(id);
  if (!record) {
    throw new Error(`Attachment ${id} not found.`);
  }

  const blob = await getAttachmentBlob(id);
  const buffer = await blob.arrayBuffer();
  const calculatedChecksum = await computeArrayBufferSHA256(buffer);

  const valid = calculatedChecksum === record.checksum;
  return {
    valid,
    expectedChecksum: record.checksum,
    calculatedChecksum,
    size: blob.size,
    storageBackend: record.storageBackend,
  };
}

export async function renameAttachment(
  id: string,
  newFileName: string,
  userId: string,
  userName: string
): Promise<void> {
  const record = await db.attachments.get(id);
  if (!record) throw new Error('Attachment not found');

  const oldName = record.fileName;
  const newExt = newFileName.split('.').pop()?.toLowerCase() || record.fileExtension;

  await db.attachments.update(id, {
    fileName: newFileName.trim(),
    fileExtension: newExt,
  });

  await logAuditEvent({
    userId,
    userName,
    actionType: 'UPDATE_RECORD',
    entityType: 'Attachment',
    entityId: id,
    details: `Renamed file from "${oldName}" to "${newFileName}".`,
  });
}

export async function archiveAttachment(
  id: string,
  archive: boolean,
  userId: string,
  userName: string
): Promise<void> {
  const record = await db.attachments.get(id);
  if (!record) throw new Error('Attachment not found');

  await db.attachments.update(id, { isArchived: archive });

  await logAuditEvent({
    userId,
    userName,
    actionType: archive ? 'ARCHIVE_RECORD' : 'UPDATE_RECORD',
    entityType: 'Attachment',
    entityId: id,
    details: `Attachment "${record.fileName}" ${archive ? 'archived' : 'restored'}.`,
  });
}

export async function replaceAttachmentVersion(
  oldId: string,
  newFile: File,
  userId: string,
  userName: string,
  onProgress?: (percent: number) => void
): Promise<AttachmentRecord> {
  const oldRecord = await db.attachments.get(oldId);
  if (!oldRecord) throw new Error('Existing attachment not found to replace version.');

  // Archive previous version
  await db.attachments.update(oldId, { isArchived: true });

  // Save new version
  const newRecord = await saveAttachment({
    file: newFile,
    fileName: newFile.name,
    reportId: oldRecord.reportId,
    sampleId: oldRecord.sampleId,
    wellId: oldRecord.wellId,
    reservoirId: oldRecord.reservoirId,
    fieldId: oldRecord.fieldId,
    analysisId: oldRecord.analysisId,
    linkedType: oldRecord.linkedType,
    linkedId: oldRecord.linkedId,
    description: `Version ${oldRecord.version + 1} of ${oldRecord.fileName}`,
    reportNumber: oldRecord.reportNumber,
    userId,
    userName,
    onProgress,
  });

  // Link version hierarchy
  await db.attachments.update(newRecord.id, {
    version: oldRecord.version + 1,
    replacedVersionId: oldId,
  });

  await logAuditEvent({
    userId,
    userName,
    actionType: 'UPLOAD_ATTACHMENT',
    entityType: 'Attachment',
    entityId: newRecord.id,
    details: `Uploaded Version ${oldRecord.version + 1} for ${oldRecord.fileName} (replaces ${oldId}).`,
  });

  return newRecord;
}
