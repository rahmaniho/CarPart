import { IsUUID } from 'class-validator';

export class IdParamDto {
  @IsUUID('4', { message: 'شناسه معتبر نیست.' })
  id!: string;
}
