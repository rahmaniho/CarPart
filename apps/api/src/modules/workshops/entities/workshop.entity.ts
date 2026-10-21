import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import type { VerificationStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/** تعمیرگاه / کارگاه مکانیک — پروفایل تجاری کاربر مکانیک. */
@Entity('workshops')
export class Workshop extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  ownerName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  nationalId!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  taxCode!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  addressText!: string | null;

  @Column({ type: 'float', nullable: true })
  lat!: number | null;

  @Column({ type: 'float', nullable: true })
  lng!: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** تخصص‌ها (مانند: جلوبندی، برق، موتور) */
  @Column({ type: 'simple-json', nullable: true })
  specialties!: string[] | null;

  @Column({ length: 32, default: 'DRAFT' })
  verificationStatus!: VerificationStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  verificationNote!: string | null;

  @Column({ default: true })
  isActive!: boolean;
}
