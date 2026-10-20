import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import type { RequestUser } from '../../common/types/auth';
import type { FileKind } from './entities/file-asset.entity';
import { FilesService } from './files.service';

const KINDS: FileKind[] = ['product', 'part', 'part-request', 'delivery-proof', 'document', 'avatar', 'return', 'ticket'];

@ApiTags('فایل')
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'بارگذاری فایل (تصویر محصول، مدرک، رسید تحویل)' })
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body('kind') kind: FileKind,
  ) {
    if (!file) throw new BadRequestException('فایلی ارسال نشد.');
    if (!KINDS.includes(kind)) throw new BadRequestException('نوع فایل معتبر نیست.');
    return this.files.upload(user, kind, file);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'فایل‌های بارگذاری‌شده من' })
  list(@CurrentUser() user: RequestUser, @Query('kind') kind?: FileKind, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.files.listMine(user.id, { kind, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'محدودیت‌های بارگذاری' })
  info() {
    return this.files.storageInfo();
  }

  @Get(':id/raw')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'دریافت محتوای فایل (فایل‌های خصوصی فقط برای مالک و مدیر)' })
  async raw(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser | undefined, @Res() response: Response) {
    const { buffer, asset } = await this.files.read(id, user ?? null);
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', asset.isPublic ? 'public, max-age=86400' : 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(buffer);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions('catalog:manage')
  @Audit({ action: 'file.deactivate', resource: 'file', fa: 'غیرفعال‌سازی فایل' })
  @ApiOperation({ summary: 'غیرفعال‌سازی فایل' })
  deactivate(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.deactivate(id, user);
  }
}
