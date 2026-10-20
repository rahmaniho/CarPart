import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Role } from '@carpart/contract';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsString()
  city?: string;
}
