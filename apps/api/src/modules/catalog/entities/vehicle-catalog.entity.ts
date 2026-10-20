import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** سازنده خودرو (مانند: ایران‌خودرو، سایپا، تویوتا). */
@Entity('vehicle_makes')
export class VehicleMake extends BaseEntity {
  @Column({ length: 160 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nameEn!: string | null;

  @Index({ unique: true })
  @Column({ length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  country!: string | null;

  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;
}

/** مدل خودرو (مانند: پژو ۲۰۶، پراید ۱۳۱). */
@Entity('vehicle_models')
export class VehicleModel extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  makeId!: string;

  @ManyToOne(() => VehicleMake, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'makeId' })
  make!: VehicleMake;

  @Column({ length: 160 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nameEn!: string | null;

  @Index()
  @Column({ length: 200 })
  slug!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  bodyType!: string | null;

  @Column({ type: 'int', nullable: true })
  yearFrom!: number | null;

  @Column({ type: 'int', nullable: true })
  yearTo!: number | null;

  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ default: true })
  isActive!: boolean;
}

/**
 * تیپ/واریانت خودرو (مانند: ۲۰۶ تیپ ۵ موتور TU5).
 * سازگاری قطعه در سطح تیپ دقیق‌ترین حالت است؛ اگر تیپ نامشخص باشد،
 * سامانه سازگاری را «نامشخص» اعلام می‌کند و هرگز قطعی نمی‌گوید.
 */
@Entity('vehicle_variants')
export class VehicleVariant extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  modelId!: string;

  @ManyToOne(() => VehicleModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'modelId' })
  model!: VehicleModel;

  @Column({ length: 160 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  engine!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gearbox!: string | null;

  @Column({ type: 'int', nullable: true })
  yearFrom!: number | null;

  @Column({ type: 'int', nullable: true })
  yearTo!: number | null;

  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ default: true })
  isActive!: boolean;
}
