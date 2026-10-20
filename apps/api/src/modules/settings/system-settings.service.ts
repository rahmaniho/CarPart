import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import { SystemSetting, type SettingValueType } from './entities/system-setting.entity';
import { DEFAULT_SETTINGS, type DefaultSetting } from './default-settings';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * سرویس تنظیمات سامانه با کش کوتاه‌مدت درون‌فرایندی.
 * همه تعرفه‌ها، مهلت‌ها و وزن‌های رتبه‌بندی از اینجا خوانده می‌شوند.
 */
@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 15_000;

  constructor(
    @InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  /** ایجاد تنظیمات پیش‌فرض (فقط در صورت نبودن) — برای نصب تازه. */
  async ensureDefaults(): Promise<number> {
    const existing = await this.repo.find({ where: { key: In(DEFAULT_SETTINGS.map((s) => s.key)) } });
    const existingKeys = new Set(existing.map((s) => s.key));
    const missing = DEFAULT_SETTINGS.filter((s) => !existingKeys.has(s.key));
    if (!missing.length) return 0;
    await this.repo.save(
      missing.map((def) => this.fromDefault(def)),
    );
    this.invalidate();
    this.logger.log(`${missing.length} تنظیم پیش‌فرض سامانه ایجاد شد.`);
    return missing.length;
  }

  private fromDefault(def: DefaultSetting): SystemSetting {
    const entity = new SystemSetting();
    entity.key = def.key;
    entity.group = def.group;
    entity.valueType = def.valueType;
    entity.value = def.value;
    entity.defaultValue = def.value;
    entity.faLabel = def.faLabel;
    entity.description = def.description ?? null;
    entity.unit = def.unit ?? null;
    entity.constraints = def.constraints ?? null;
    entity.isPublic = def.isPublic ?? false;
    return entity;
  }

  private readCache(key: string): { hit: boolean; value?: unknown } {
    const entry = this.cache.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return { hit: false };
    }
    return { hit: true, value: entry.value };
  }

  private writeCache(key: string, value: unknown): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  /** خواندن مقدار خام یک تنظیم (با مقدار بازگشتی). */
  async getRaw<T = unknown>(key: string, fallback: T): Promise<T> {
    const cached = this.readCache(key);
    if (cached.hit) return cached.value as T;
    const setting = await this.repo.findOne({ where: { key } });
    const value = (setting?.value ?? setting?.defaultValue ?? fallback) as T;
    this.writeCache(key, value);
    return value;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const value = await this.getRaw<number>(key, fallback);
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const value = await this.getRaw<string>(key, fallback);
    return typeof value === 'string' && value.length ? value : fallback;
  }

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const value = await this.getRaw<boolean>(key, fallback);
    return typeof value === 'boolean' ? value : fallback;
  }

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const value = await this.getRaw<T>(key, fallback);
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value as T;
  }

  /** فهرست همه تنظیمات (برای پنل مدیریت). */
  async listAll(group?: string): Promise<SystemSetting[]> {
    const rows = group ? await this.repo.find({ where: { group }, order: { group: 'ASC', key: 'ASC' } }) : await this.repo.find({ order: { group: 'ASC', key: 'ASC' } });
    return rows;
  }

  /** تنظیمات عمومی (بدون نیاز به احراز هویت). */
  async listPublic(): Promise<Array<{ key: string; value: unknown; faLabel: string }>> {
    const rows = await this.repo.find({ where: { isPublic: true } });
    return rows.map((r) => ({ key: r.key, value: r.value ?? r.defaultValue, faLabel: r.faLabel }));
  }

  /** به‌روزرسانی یک تنظیم با اعتبارسنجی محدوده مجاز. */
  async set(key: string, value: unknown, actorId?: string | null): Promise<SystemSetting> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) {
      throw new AppException(`تنظیم «${key}» در سامانه تعریف نشده است.`, ErrorCodes.SETTING_INVALID, { statusCode: 404 });
    }
    const coerced = this.coerce(setting.valueType, value);
    this.validateConstraints(setting, coerced);
    setting.value = coerced;
    setting.updatedBy = actorId ?? null;
    const saved = await this.repo.save(setting);
    this.cache.delete(key);
    return saved;
  }

  private coerce(valueType: SettingValueType, value: unknown): unknown {
    switch (valueType) {
      case 'number': {
        const num = Number(value);
        if (!Number.isFinite(num)) throw new AppException('مقدار باید عدد باشد.', ErrorCodes.SETTING_INVALID);
        return num;
      }
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (['true', 'false', '1', '0'].includes(String(value))) return String(value) === 'true' || String(value) === '1';
        throw new AppException('مقدار باید boolean باشد.', ErrorCodes.SETTING_INVALID);
      case 'json': {
        if (typeof value === 'object' && value !== null) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            throw new AppException('مقدار JSON معتبر نیست.', ErrorCodes.SETTING_INVALID);
          }
        }
        throw new AppException('مقدار باید JSON باشد.', ErrorCodes.SETTING_INVALID);
      }
      case 'string':
      default:
        if (typeof value !== 'string') throw new AppException('مقدار باید رشته باشد.', ErrorCodes.SETTING_INVALID);
        return value;
    }
  }

  private validateConstraints(setting: SystemSetting, value: unknown): void {
    const constraints = setting.constraints;
    if (!constraints) return;
    if (setting.valueType === 'number' && typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        throw new AppException(`حداقل مقدار مجاز ${constraints.min} است.`, ErrorCodes.SETTING_INVALID);
      }
      if (constraints.max !== undefined && value > constraints.max) {
        throw new AppException(`حداکثر مقدار مجاز ${constraints.max} است.`, ErrorCodes.SETTING_INVALID);
      }
    }
    if (constraints.enum?.length && !constraints.enum.includes(String(value))) {
      throw new AppException(`مقدار باید یکی از ${constraints.enum.join('، ')} باشد.`, ErrorCodes.SETTING_INVALID);
    }
  }

  invalidate(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
