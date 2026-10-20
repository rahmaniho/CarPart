import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerProduct } from './seller-product.entity';

export type InventoryReason = 'initial' | 'restock' | 'adjustment' | 'sale' | 'reservation' | 'release' | 'return' | 'order_cancel';

/**
 * دفتر حرکت موجودی — هر تغییر موجودی با دلیل، مقدار و موجودی پس از تغییر ثبت می‌شود.
 * این جدول حسابرسی موجودی را ممکن می‌کند و هیچ سطری از آن حذف نمی‌شود.
 */
@Entity('inventory_movements')
@Index(['sellerProductId', 'createdAt'])
export class InventoryMovement extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  sellerProductId!: string;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId' })
  sellerProduct!: SellerProduct;

  @Column({ length: 36 })
  branchId!: string;

  /** مقدار تغییر (مثبت: افزایش، منفی: کاهش) */
  @Column()
  delta!: number;

  @Column()
  stockAfter!: number;

  @Column({ length: 32 })
  reason!: InventoryReason;

  @Column({ type: 'varchar', length: 36, nullable: true })
  orderId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ length: 16, default: 'user' })
  actorType!: 'user' | 'system';
}
