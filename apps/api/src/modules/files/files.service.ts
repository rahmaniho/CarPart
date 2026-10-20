import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import type { RequestUser } from '../../common/types/auth';
import { FileAsset, type FileKind } from './entities/file-asset.entity';
import { LocalStorageProvider } from './providers/local-storage.provider';
import type { StorageProvider } from './storage-provider.interface';

const IMAGE_KINDS: FileKind[] = ['product', 'part', 'part-request', 'delivery-proof', 'return', 'ticket', 'avatar'];

/** امضای بایتی فایل‌های مجاز — برای اطمینان از تطابق محتوا با نوع اعلامی. */
const MAGIC_SIGNATURES: Array<{ mime: string; test: (buffer: Buffer) => boolean }> = [
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'application/pdf', test: (b) => b.length > 4 && b.subarray(0, 5).toString('ascii') === '%PDF-' },
];

export interface UploadResult {
  id: string;
  kind: FileKind;
  url: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
}

/** بارگذاری و مدیریت فایل‌ها با اعتبارسنجی نوع، اندازه و امضای محتوا. */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly storage: StorageProvider;

  constructor(
    @InjectRepository(FileAsset) private readonly assets: Repository<FileAsset>,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {
    this.storage = new LocalStorageProvider(() => ({
      rootDir: this.config.storage.localDir,
      publicBaseUrl: `${this.config.app.apiUrl.replace(/\/$/, '')}/files/raw`,
    }));
  }

  private detectMimeType(buffer: Buffer, declared: string): string | null {
    const detected = MAGIC_SIGNATURES.find((signature) => signature.test(buffer));
    if (!detected) return null;
    // اگر نوع اعلامی با محتوا مطابقت نداشت، نوع واقعی محتوا مبنا است
    if (declared && detected.mime !== declared && !declared.startsWith('image/') && declared !== 'application/pdf') return null;
    return detected.mime;
  }

  async upload(
    user: RequestUser | null,
    kind: FileKind,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<UploadResult> {
    const maxBytes = this.config.storage.maxFileMb * 1024 * 1024;
    if (!file.buffer?.byteLength) {
      throw new AppException('فایلی دریافت نشد.', ErrorCodes.VALIDATION_FAILED);
    }
    if (file.size > maxBytes || file.buffer.byteLength > maxBytes) {
      throw new AppException(
        `حجم فایل بیش از حد مجاز (${this.config.storage.maxFileMb} مگابایت) است.`,
        ErrorCodes.FILE_TOO_LARGE,
        { statusCode: 413 },
      );
    }

    const mimeType = this.detectMimeType(file.buffer, file.mimetype);
    if (!mimeType) {
      throw new AppException(
        'نوع فایل پشتیبانی نمی‌شود. فقط jpg، png، webp و pdf مجاز است.',
        ErrorCodes.FILE_TYPE_NOT_ALLOWED,
        { statusCode: 415 },
      );
    }
    if (kind === 'document' && mimeType !== 'application/pdf') {
      throw new AppException('برای مدارک فقط فایل pdf مجاز است.', ErrorCodes.FILE_TYPE_NOT_ALLOWED, { statusCode: 415 });
    }
    if (IMAGE_KINDS.includes(kind) && !mimeType.startsWith('image/')) {
      throw new AppException('برای این بخش فقط فایل تصویری مجاز است.', ErrorCodes.FILE_TYPE_NOT_ALLOWED, { statusCode: 415 });
    }

    const stored = await this.storage.save({ buffer: file.buffer, originalName: file.originalname, mimeType, kind });
    const asset = await this.assets.save(
      this.assets.create({
        ownerId: user?.id ?? null,
        kind,
        url: stored.url,
        storagePath: stored.storagePath,
        storageProvider: this.storage.name,
        mimeType: stored.mimeType,
        originalName: file.originalname.slice(0, 180),
        sizeBytes: stored.sizeBytes,
        width: null,
        height: null,
        checksum: stored.checksum,
        isActive: true,
        // تصاویر عمومی کاتالوگ و محصول عمومی هستند؛ مدارک و رسیدهای تحویل خصوصی می‌مانند
        isPublic: ['product', 'part', 'avatar'].includes(kind),
      }),
    );
    return { id: asset.id, kind: asset.kind, url: asset.url, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, isPublic: asset.isPublic };
  }

  async listMine(userId: string, query: { kind?: FileKind; page?: number; pageSize?: number } = {}): Promise<PageResult<FileAsset>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { ownerId: userId, isActive: true };
    if (query.kind) where.kind = query.kind;
    const [items, total] = await this.assets.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async findById(id: string): Promise<FileAsset> {
    const asset = await this.assets.findOne({ where: { id, isActive: true } });
    if (!asset) throw new NotFoundException('فایل');
    return asset;
  }

  /** خواندن محتوای فایل با بررسی دسترسی. */
  async read(assetId: string, user: RequestUser | null): Promise<{ buffer: Buffer; asset: FileAsset }> {
    const asset = await this.findById(assetId);
    const isStaff = Boolean(user && (user.roles.includes('admin') || user.roles.includes('operator')));
    if (!asset.isPublic && !isStaff && asset.ownerId !== user?.id) {
      throw new AppException('دسترسی به این فایل ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    try {
      const buffer = await this.storage.read(asset.storagePath);
      return { buffer, asset };
    } catch {
      throw new NotFoundException('محتوای فایل');
    }
  }

  async deactivate(assetId: string, user: RequestUser): Promise<{ ok: true }> {
    const asset = await this.findById(assetId);
    const isStaff = user.roles.includes('admin') || user.roles.includes('operator');
    if (!isStaff && asset.ownerId !== user.id) {
      throw new AppException('دسترسی به حذف این فایل ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    asset.isActive = false;
    await this.assets.save(asset);
    return { ok: true };
  }

  storageInfo(): { provider: string; maxFileMb: number; allowedMime: string[] } {
    return {
      provider: this.storage.name,
      maxFileMb: this.config.storage.maxFileMb,
      allowedMime: MAGIC_SIGNATURES.map((signature) => signature.mime),
    };
  }
}
