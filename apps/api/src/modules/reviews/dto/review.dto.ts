import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsUUID('4')
  orderId!: string;

  @IsIn(['seller', 'courier'], { message: 'هدف بازخورد باید seller یا courier باشد.' })
  targetType!: 'seller' | 'courier';

  @Type(() => Number)
  @IsInt({ message: 'امتیاز باید عدد صحیح بین ۱ تا ۵ باشد.' })
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  hadIssue?: boolean;
}

export class ModerateReviewDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderationNote?: string;
}
