import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/** سابقه استفاده از کوپن — برای اعمال محدودیت هر کاربر و حسابرسی تخفیف‌ها. */
@Entity('coupon_redemptions')
@Index(['couponId', 'userId'])
@Index(['couponId', 'orderId'], { unique: true })
export class CouponRedemption extends BaseEntity {
  @Column({ length: 36 })
  couponId!: string;

  @Index()
  @Column({ length: 36 })
  userId!: string;

  @Index()
  @Column({ length: 36 })
  orderId!: string;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  discountAmount!: number;

  @Column({ length: 32, default: 'applied' })
  status!: 'applied' | 'reversed';

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  reversedAt!: Date | null;
}
