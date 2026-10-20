import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreatePayoutDto {
  @IsIn(['seller', 'courier'], { message: 'نوع گیرنده باید seller یا courier باشد.' })
  recipientType!: 'seller' | 'courier';

  @IsUUID('4')
  recipientId!: string;

  @IsString({ message: 'تاریخ شروع بازه الزامی است.' })
  periodFrom!: string;

  @IsString({ message: 'تاریخ پایان بازه الزامی است.' })
  periodTo!: string;
}

export class ProcessPayoutDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SetCommissionRateDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  ratePercent?: number | null;
}
