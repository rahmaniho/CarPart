import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/auth';
import { ChangePasswordDto, UpdateProfileDto } from './dto';
import { UsersService, type UserDetail } from './users.service';

@ApiTags('کاربران')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'دریافت اطلاعات کاربر جاری' })
  async me(@CurrentUser() user: RequestUser): Promise<UserDetail> {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'ویرایش پروفایل کاربر جاری' })
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto): Promise<UserDetail> {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('me/password')
  @ApiOperation({ summary: 'تعیین یا تغییر رمز عبور' })
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto): Promise<{ ok: true }> {
    return this.users.changePassword(user.id, dto);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'فهرست نشست‌های فعال' })
  async sessions(@CurrentUser() user: RequestUser) {
    return this.users.listSessions(user.id);
  }

  @Delete('me/sessions/:id')
  @ApiOperation({ summary: 'خروج از یک نشست خاص' })
  async revokeSession(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.revokeSession(user.id, id);
  }
}
