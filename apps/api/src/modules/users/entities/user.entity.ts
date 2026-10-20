import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { NotificationChannel, Role } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

export interface UserPreferences {
  channels: NotificationChannel[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  language?: 'fa';
}

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 16 })
  mobile!: string;

  @Column({ length: 160 })
  fullName!: string;

  @Index()
  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  /** هش رمز عبور (scrypt). در صورت خالی بودن، ورود فقط با کد یکبارمصرف ممکن است. */
  @Column({ type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  roles!: Role[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isMobileVerified!: boolean;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  lastLoginAt!: Date | null;

  @Column({ default: 0 })
  failedLoginCount!: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  preferences!: UserPreferences | null;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
