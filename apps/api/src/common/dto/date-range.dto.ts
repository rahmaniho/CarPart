import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @IsISO8601({}, { message: 'تاریخ شروع معتبر نیست.' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'تاریخ پایان معتبر نیست.' })
  to?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
