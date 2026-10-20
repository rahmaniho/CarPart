import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Role } from '@carpart/contract';
import { User } from './entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { OtpCode } from './entities/otp-code.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
  ) {}

  get repo(): Repository<User> {
    return this.users;
  }

  get sessionRepo(): Repository<UserSession> {
    return this.sessions;
  }

  get otpRepo(): Repository<OtpCode> {
    return this.otps;
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.users.createQueryBuilder('user').addSelect('user.passwordHash').where('user.id = :id', { id }).getOne();
  }

  findByMobile(mobile: string): Promise<User | null> {
    return this.users.findOne({ where: { mobile } });
  }

  findByMobileWithPassword(mobile: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.mobile = :mobile', { mobile })
      .getOne();
  }

  async create(data: Partial<User>): Promise<User> {
    const entity = this.users.create(data);
    return this.users.save(entity);
  }

  async save(user: User): Promise<User> {
    return this.users.save(user);
  }

  async hasRole(role: Role): Promise<boolean> {
    const count = await this.users.count();
    if (count === 0) return false;
    // نقش‌ها در ستون JSON نگهداری می‌شوند؛ فیلتر در حافظه انجام می‌شود (حجم کاربران کم است)
    const rows = await this.users.find({ select: { id: true, roles: true } });
    return rows.some((row) => (row.roles ?? []).includes(role));
  }

  async countByRole(role: Role): Promise<number> {
    const rows = await this.users.find({ select: { id: true, roles: true, isActive: true } });
    return rows.filter((row) => (row.roles ?? []).includes(role) && row.isActive).length;
  }
}
