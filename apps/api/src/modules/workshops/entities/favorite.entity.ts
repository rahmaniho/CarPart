import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type FavoriteKind = 'part' | 'seller' | 'product' | 'request';

/** علاقه‌مندی‌ها و موارد پرتکرار ذخیره‌شده توسط کاربر. */
@Entity('favorites')
@Index(['userId', 'kind', 'refId'], { unique: true })
export class Favorite extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ length: 16 })
  kind!: FavoriteKind;

  @Column({ type: 'uuid' })
  refId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  label!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  snapshot!: Record<string, unknown> | null;
}
