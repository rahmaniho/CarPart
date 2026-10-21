import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { QualityGrade } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import { Order } from './order.entity';

/** قلم سفارش — قیمت و مشخصات در زمان ثبت سفارش قفل (snapshot) می‌شوند. */
@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column({ type: 'uuid', nullable: true })
  sellerProductId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  partId!: string | null;

  @Column({ length: 200 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 96, nullable: true })
  sku!: string | null;

  @Column({ type: 'varchar', length: 96, nullable: true })
  technicalCode!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  brandName!: string | null;

  @Column({ length: 32, default: 'unknown' })
  quality!: QualityGrade;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  unitPrice!: number;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  lineTotal!: number;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  /** وضعیت اقلام در فرایندهای مرجوعی */
  @Column({ default: 0 })
  returnedQuantity!: number;

  @Column({ type: 'simple-json', nullable: true })
  snapshot!: Record<string, unknown> | null;
}
