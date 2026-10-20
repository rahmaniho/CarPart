import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Workshop } from './workshop.entity';

/** آدرس‌های تحویل تعمیرگاه (می‌تواند چند آدرس باشد — شعبه، انبار، محل تعمیر). */
@Entity('workshop_addresses')
export class WorkshopAddress extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  workshopId!: string;

  @ManyToOne(() => Workshop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workshopId' })
  workshop!: Workshop;

  @Column({ length: 100 })
  title!: string;

  @Column({ length: 160 })
  receiverName!: string;

  @Column({ length: 20 })
  phone!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'text' })
  addressText!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'float', nullable: true })
  lat!: number | null;

  @Column({ type: 'float', nullable: true })
  lng!: number | null;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: true })
  isActive!: boolean;
}
