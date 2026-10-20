import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * توکن دستگاه کاربر برای اعلان فشاری (FCM).
 * هر ورود/نصب، توکن خود را ثبت می‌کند؛ توکن‌های منقضی با DELETE غیرفعال می‌شوند.
 */
@Entity('device_tokens')
export class DeviceToken extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token!: string;

  @Column({ type: 'varchar', length: 24 })
  platform!: 'android' | 'ios' | 'web';

  /** طعم اپ (مکانیک/پیک) — برای انتخاب قالب اعلان */
  @Column({ type: 'varchar', length: 24, nullable: true })
  appFlavor: 'mechanic' | 'courier' | 'web' | null = null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null = null;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;
}
