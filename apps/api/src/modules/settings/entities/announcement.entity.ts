import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { Role } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/** اعلان عمومی مدیر برای کاربران (بنر در داشبوردها). */
@Entity('announcements')
export class Announcement extends BaseEntity {
  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'simple-json', nullable: true })
  audienceRoles!: Role[] | null;

  @Column({ length: 16, default: 'info' })
  tone!: 'info' | 'warning' | 'success' | 'danger';

  @Index()
  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  publishedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;
}
