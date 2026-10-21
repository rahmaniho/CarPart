import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { VehicleType } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';
import { VehicleModel, VehicleVariant } from '../../catalog/entities/vehicle-catalog.entity';
import { Workshop } from './workshop.entity';

/** خودروهای ثبت‌شده توسط تعمیرگاه — برای سفارش مجدد سریع و بررسی سازگاری قطعه. */
@Entity('vehicles')
export class Vehicle extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  workshopId!: string;

  @ManyToOne(() => Workshop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workshopId' })
  workshop!: Workshop;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  modelId!: string | null;

  @ManyToOne(() => VehicleModel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'modelId' })
  model!: VehicleModel | null;

  @Column({ type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne(() => VehicleVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variantId' })
  variant!: VehicleVariant | null;

  @Column({ length: 32, default: 'car' })
  vehicleType!: VehicleType;

  @Column({ type: 'int', nullable: true })
  yearFrom!: number | null;

  @Column({ type: 'int', nullable: true })
  yearTo!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  engine!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gearbox!: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  plate!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  vin!: string | null;

  /** مقادیر آزاد واردشده توسط کاربر وقتی مدل در فهرست سامانه وجود ندارد */
  @Column({ type: 'varchar', length: 120, nullable: true })
  freeMakeName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  freeModelName!: string | null;

  @Column({ default: false })
  isPrimary!: boolean;

  @Column({ default: true })
  isActive!: boolean;
}
