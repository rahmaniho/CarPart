import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type FileKind =
  | 'product'
  | 'part'
  | 'part-request'
  | 'delivery-proof'
  | 'document'
  | 'avatar'
  | 'return'
  | 'ticket';

/** فایل بارگذاری‌شده — مسیر و مشخصات امن نگهداری می‌شود، نه محتوای فایل. */
@Entity('file_assets')
@Index(['ownerId', 'kind'])
export class FileAsset extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ length: 32 })
  kind!: FileKind;

  @Column({ length: 300 })
  url!: string;

  @Column({ length: 300 })
  storagePath!: string;

  @Column({ length: 32 })
  storageProvider!: 'local' | 's3';

  @Column({ length: 120 })
  mimeType!: string;

  @Column({ length: 32 })
  originalName!: string;

  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) } })
  sizeBytes!: number;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isPublic!: boolean;
}
