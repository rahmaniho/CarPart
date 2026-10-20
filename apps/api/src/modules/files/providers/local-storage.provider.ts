import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageProvider, StoredFile, UploadInput } from '../storage-provider.interface';

/**
 * فراهم‌کننده ذخیره‌سازی روی دیسک محلی.
 *
 * نام فایل هرگز از نام ارسالی کاربر ساخته نمی‌شود (جلوگیری از path traversal)؛
 * پسوند از نوع محتوای اعتبارسنجی‌شده تعیین می‌شود.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  constructor(private readonly options: () => { rootDir: string; publicBaseUrl: string }) {}

  private extensionFor(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return map[mimeType] ?? 'bin';
  }

  async save(input: UploadInput): Promise<StoredFile> {
    const { rootDir, publicBaseUrl } = this.options();
    const now = new Date();
    const relative = join(input.kind, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `${randomUUID()}.${this.extensionFor(input.mimeType)}`);
    const absolute = join(rootDir, relative);
    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, input.buffer);
    return {
      storagePath: relative,
      url: `${publicBaseUrl.replace(/\/$/, '')}/${relative.split(/[\\/]/).join('/')}`,
      sizeBytes: input.buffer.byteLength,
      mimeType: input.mimeType,
      checksum: createHash('sha256').update(input.buffer).digest('hex'),
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const { rootDir } = this.options();
    return readFile(join(rootDir, storagePath));
  }

  async remove(storagePath: string): Promise<void> {
    const { rootDir } = this.options();
    await rm(join(rootDir, storagePath), { force: true });
  }
}
