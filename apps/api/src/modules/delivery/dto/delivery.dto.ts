import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class AcceptMissionDto {
  @IsUUID('4')
  deliveryId!: string;
}

export class RejectMissionDto {
  @IsUUID('4')
  deliveryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class PickupDto {
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'کد دریافت باید ۴ تا ۸ رقم باشد.' })
  pickupCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class DeliverDto {
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'کد تأیید تحویل باید ۴ تا ۸ رقم باشد.' })
  otp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class FailAttemptDto {
  @IsString()
  @Length(5, 500, { message: 'دلیل عدم تحویل باید حداقل ۵ نویسه باشد.' })
  reason!: string;

  @IsOptional()
  @IsIn(['retry', 'cancel'], { message: 'اقدام بعدی باید retry یا cancel باشد.' })
  nextAction?: 'retry' | 'cancel';
}

export class CourierArrivalDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
