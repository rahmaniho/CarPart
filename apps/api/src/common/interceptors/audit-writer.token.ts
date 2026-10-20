import type { RequestUser } from '../types/auth';

export const AUDIT_WRITER = Symbol('AUDIT_WRITER');

export interface AuditEntryInput {
  action: string;
  resource: string;
  resourceId?: string | null;
  faDescription: string;
  actor: Pick<RequestUser, 'id' | 'mobile' | 'fullName' | 'roles'> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  status?: 'success' | 'failure';
  errorMessage?: string | null;
}

export interface AuditWriter {
  record(entry: AuditEntryInput): Promise<unknown>;
}
