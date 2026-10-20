import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import { BaseEntity } from '../../../database/base.entity';

export type OtpPurpose = 'login' | 'mobile_verify' | 'password_reset' | 'delivery_confirm';

/** کد یکبارمصرف — فقط هش کد ذخیره می‌شود و پس از مصرف یا انقضا بی‌اثر است. */
@Entity('otp_codes')
@Index(['mobile', 'purpose'])
export class OtpCode extends BaseEntity {
  @Column({ length: 16 })
  mobile!: string;

  @Column({ length: 128 })
  codeHash!: string;

  @Column({ length: 32 })
  purpose!: OtpPurpose;

  @Column()
  expiresAt!: Date;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  consumedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  /** شناسه منبع (مانند شناسه مأموریت) برای کدهای تأیید تحویل */
  @Column({ type: 'varchar', length: 64, nullable: true })
  subjectId!: string | null;
}
