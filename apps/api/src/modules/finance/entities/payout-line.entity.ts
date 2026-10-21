import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import { Payout } from './payout.entity';

/** سطرهای تشکیل‌دهنده یک تسویه — برای شفافیت و حسابرسی دقیق. */
@Entity('payout_lines')
export class PayoutLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  payoutId!: string;

  @ManyToOne(() => Payout, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payoutId' })
  payout!: Payout;

  @Column({ length: 32 })
  kind!: 'sale' | 'delivery' | 'refund_reversal' | 'adjustment';

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  deliveryId!: string | null;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  amount!: number;

  @Column({ type: 'text' })
  faDescription!: string;
}
