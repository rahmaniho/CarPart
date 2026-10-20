import { Column, Entity, Index } from 'typeorm';
import type { Role } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/**
 * تاریخچه عملیات حساس (حسابرسی).
 * این جدول فقط افزودنی است؛ هیچ سطری از آن حذف یا ویرایش نمی‌شود.
 */
@Entity('audit_logs')
@Index(['resource', 'resourceId'])
@Index(['actorId', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  actorMobile!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  actorName!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  actorRoles!: Role[] | null;

  /** نوع انجام‌دهنده: کاربر، مدیر یا خود سامانه */
  @Column({ length: 16, default: 'user' })
  actorType!: 'user' | 'system';

  @Index()
  @Column({ length: 96 })
  action!: string;

  @Index()
  @Column({ length: 64 })
  resource!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'text' })
  faDescription!: string;

  @Column({ type: 'simple-json', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @Column({ length: 16, default: 'success' })
  status!: 'success' | 'failure';

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;
}
