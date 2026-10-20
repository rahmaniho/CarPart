import { Column, Index } from 'typeorm';
import { BaseEntity } from '../database/base.entity';

export class Meta extends BaseEntity {
  @Index()
  @Column({ length: 36, nullable: true })
  actorId!: string | null;

  @Column({ length: 16, nullable: true })
  plain!: string;

  @Column({ nullable: true })
  whenAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  count!: number | null;
}
