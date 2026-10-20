import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID('4', { message: 'شناسه سفارش معتبر نیست.' })
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;
}

export class VerifyPaymentDto {
  @IsOptional()
  @IsUUID('4')
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  authority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  signature?: string;

  /** وضعیت بازگشتی از درگاه (مانند OK در زرین‌پال) */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gatewayStatus?: string;
}

export class SandboxConfirmDto {
  @IsUUID('4')
  orderId!: string;

  @IsOptional()
  @IsIn(['paid', 'failed'], { message: 'نتیجه باید paid یا failed باشد.' })
  decision?: 'paid' | 'failed';
}

export class RequestRefundDto {
  @IsUUID('4')
  orderId!: string;

  @IsString({ message: 'دلیل درخواست بازپرداخت الزامی است.' })
  @MaxLength(500)
  reason!: string;
}

export class ResolveRefundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ExecuteRefundDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;
}
