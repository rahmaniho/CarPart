import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * نمونه موقعیت زنده پیک.
 * حریم خصوصی: فقط برای مأموریت فعال و فقط در اختیار کاربران مجاز همان مأموریت قرار می‌گیرد
 * (پیک، مکانیکِ همان سفارش، مدیر). سوابق قدیمی توسط فرایند زمان‌بندی‌شده پاکسازی می‌شوند.
 */
@Entity('courier_locations')
@Index(['courierId', 'recordedAt'])
@Index(['deliveryId', 'recordedAt'])
export class CourierLocation extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  courierId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  deliveryId!: string | null;

  @Column({ type: 'float' })
  lat!: number;

  @Column({ type: 'float' })
  lng!: number;

  @Column({ type: 'float', nullable: true })
  accuracyM!: number | null;

  @Column({ type: 'float', nullable: true })
  speedKmh!: number | null;

  @Column({ type: 'float', nullable: true })
  heading!: number | null;

  @Index()
  @Column()
  recordedAt!: Date;

  @Column({ length: 32, default: 'app' })
  source!: 'app' | 'mock' | 'manual';
}
