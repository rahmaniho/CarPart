import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import { BaseEntity } from '../../../database/base.entity';
import { User } from './user.entity';

/** نشست کاربر (رفرش توکن). هش توکن ذخیره می‌شود، نه خود توکن. */
@Entity('user_sessions')
export class UserSession extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ length: 128 })
  refreshTokenHash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceInfo!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column()
  expiresAt!: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  revokeReason!: string | null;
}
