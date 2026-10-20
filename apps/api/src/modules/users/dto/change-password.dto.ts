import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' })
  @Matches(/^(?=.*[a-zA-Z\u0600-\u06FF])(?=.*\d).+$/, {
    message: 'رمز عبور باید حداقل شامل یک حرف و یک رقم باشد.',
  })
  newPassword!: string;
}
