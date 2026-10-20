import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import type { Role } from '@carpart/contract';
import { NotFoundException } from '../../common/errors/app-error';
import { Announcement } from './entities/announcement.entity';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audienceRoles?: Role[] | null;
  tone?: Announcement['tone'];
  isActive?: boolean;
  expiresAt?: Date | null;
}

@Injectable()
export class AnnouncementService {
  constructor(@InjectRepository(Announcement) private readonly repo: Repository<Announcement>) {}

  /** اعلان‌های فعال مناسب یک نقش. */
  async findActiveForRoles(roles: Role[]): Promise<Announcement[]> {
    const now = new Date();
    const rows = await this.repo.find({
      where: {
        isActive: true,
        publishedAt: LessThanOrEqual(now),
      },
      order: { publishedAt: 'DESC' },
      take: 20,
    });
    return rows.filter((row) => {
      if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return false;
      const audience = row.audienceRoles;
      if (!audience?.length) return true;
      return roles.some((role) => audience.includes(role));
    });
  }

  async list(): Promise<Announcement[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async create(input: CreateAnnouncementInput, actorId: string): Promise<Announcement> {
    const entity = this.repo.create({
      title: input.title,
      body: input.body,
      audienceRoles: input.audienceRoles ?? null,
      tone: input.tone ?? 'info',
      isActive: input.isActive ?? true,
      publishedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
      createdBy: actorId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, patch: Partial<CreateAnnouncementInput>): Promise<Announcement> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('اعلان');
    Object.assign(entity, patch);
    return this.repo.save(entity);
  }

  async deactivate(id: string): Promise<Announcement> {
    return this.update(id, { isActive: false });
  }
}
