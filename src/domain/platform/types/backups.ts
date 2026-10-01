/** Типы раздела «platform»: backups. */
import type { ISODateTime, Id } from '@/domain/core';

// ─────────────────────────── Копии и выгрузка (F-00-183) ───────────────────────────

export interface BackupCounts {
  clients: number;
  bookings: number;
  services: number;
  staff: number;
}

export interface BackupCopy {
  id: Id;
  businessId: Id;
  at: ISODateTime;
  kind: 'auto' | 'manual';
  counts: BackupCounts;
  sizeKb: number;
}

export type ExportWhat = 'clients' | 'bookings';

export interface ExportLogEntry {
  id: Id;
  businessId: Id;
  what: ExportWhat;
  rows: number;
  at: ISODateTime;
}

export interface ExportFile {
  fileName: string;
  csv: string;
  rows: number;
}
