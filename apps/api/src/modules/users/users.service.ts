import { Injectable, Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { CurrentUserDto } from '@carpart/contract';
import { permissionsOf } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { hashToken, hashPassword, verifyPassword } from '../../common/utils/crypto';
import { ProfilesService } from '../profiles/profiles.service';
import { AuditService } from '../audit/audit.service';
import { User } from './entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { UsersRepository } from './users.repository';
import { AdminUpdateUserDto, ChangePasswordDto, ListUsersQueryDto, UpdateProfileDto } from './dto';

export interface UserDetail extends CurrentUserDto {
  email: string | null;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  displayName: string | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly profiles: ProfilesService,
    private readonly audit: AuditService,
  ) {}

  async toDto(user: User): Promise<UserDetail> {
    const summary = await this.profiles.summaryFor(user);
    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      roles: user.roles ?? [],
      permissions: permissionsOf(user.roles ?? []),
      email: user.email ?? null,
      isActive: user.isActive && summary.isActive,
      profileId: summary.profileId,
      profileKind: summary.profileKind,
      verificationStatus: summary.verificationStatus,
      city: summary.city,
      createdAt: user.createdAt?.toISOString?.() ?? new Date().toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      displayName: summary.displayName,
    };
  }

  async getMe(userId: string): Promise<UserDetail> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('کاربر');
    return this.toDto(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDetail> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('کاربر');
    const before = { fullName: user.fullName, email: user.email, city: user.city };
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.preferences) {
      user.preferences = {
        channels: dto.preferences.channels ?? user.preferences?.channels ?? ['inapp', 'sms'],
        quietHoursStart: dto.preferences.quietHoursStart ?? user.preferences?.quietHoursStart ?? null,
        quietHoursEnd: dto.preferences.quietHoursEnd ?? user.preferences?.quietHoursEnd ?? null,
        language: 'fa',
      };
    }
    const saved = await this.users.save(user);
    if (before.fullName !== saved.fullName || before.email !== saved.email) {
      await this.audit.recordSystem('user.profile_updated', 'user', saved.id, `کاربر اطلاعات پروفایل خود را ویرایش کرد.`, {
        before,
        after: { fullName: saved.fullName, email: saved.email, city: saved.city },
      });
    }
    return this.toDto(saved);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ ok: true }> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) throw new NotFoundException('کاربر');
    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new AppException('برای تغییر رمز، وارد کردن رمز فعلی الزامی است.', ErrorCodes.VALIDATION_FAILED);
      }
      const valid = await verifyPassword(dto.currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppException('رمز عبور فعلی درست نیست.', ErrorCodes.VALIDATION_FAILED);
      }
    }
    user.passwordHash = await hashPassword(dto.newPassword);
    await this.users.save(user);
    // پس از تغییر رمز، همه نشست‌های دیگر باطل می‌شوند (مدیریت امن نشست‌ها)
    const revoked = await this.users.sessionRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokeReason: 'تغییر رمز عبور' },
    );
    await this.audit.recordSystem('user.password_changed', 'user', userId, 'رمز عبور کاربر تغییر کرد.', {
      revokedSessions: revoked.affected ?? 0,
    });
    return { ok: true };
  }

  async list(query: ListUsersQueryDto): Promise<PageResult<UserDetail>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const qb = this.users.repo.createQueryBuilder('user');
    if (query.search) {
      qb.andWhere('(user.fullName LIKE :q OR user.mobile LIKE :q)', { q: `%${query.search}%` });
    }
    if (query.city) qb.andWhere('user.city = :city', { city: query.city });
    if (query.status === 'active') qb.andWhere('user.isActive = :true', { true: true });
    if (query.status === 'inactive') qb.andWhere('user.isActive = :false', { false: false });
    qb.orderBy('user.createdAt', 'DESC').skip(skip).take(take);
    const [rows, total] = await qb.getManyAndCount();
    let items = rows;
    if (query.role) items = rows.filter((row) => (row.roles ?? []).includes(query.role!));
    return buildPage(await Promise.all(items.map((row) => this.toDto(row))), query.role ? items.length : total, query.page ?? 1, query.pageSize ?? 20);
  }

  async adminUpdate(userId: string, dto: AdminUpdateUserDto, actorId: string): Promise<UserDetail> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('کاربر');
    const before = { isActive: user.isActive, roles: user.roles, fullName: user.fullName };
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.roles?.length) user.roles = dto.roles;
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    const saved = await this.users.save(user);
    await this.audit.record({
      action: 'user.admin_update',
      resource: 'user',
      resourceId: saved.id,
      faDescription: `تغییر اطلاعات کاربر ${saved.fullName} (${saved.mobile})`,
      actor: await this.actorSummary(actorId),
      before: before as unknown as Record<string, unknown>,
      after: { isActive: saved.isActive, roles: saved.roles, fullName: saved.fullName, adminNote: dto.adminNote ?? null },
      metadata: null,
    });
    return this.toDto(saved);
  }

  private async actorSummary(actorId: string) {
    const actor = await this.users.findById(actorId);
    return actor ? { id: actor.id, mobile: actor.mobile, fullName: actor.fullName, roles: actor.roles } : null;
  }

  async listSessions(userId: string): Promise<Array<{ id: string; deviceInfo: string | null; ip: string | null; createdAt: string; lastUsedAt: string | null; expiresAt: string; revoked: boolean }>> {
    const rows = await this.users.sessionRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((row) => ({
      id: row.id,
      deviceInfo: row.deviceInfo,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      revoked: Boolean(row.revokedAt),
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ ok: true }> {
    const session = await this.users.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('نشست');
    session.revokedAt = new Date();
    session.revokeReason = 'لغو توسط کاربر';
    await this.users.sessionRepo.save(session);
    return { ok: true };
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    return this.users.sessionRepo.findOne({ where: { refreshTokenHash: hashToken(refreshToken) } });
  }
}
