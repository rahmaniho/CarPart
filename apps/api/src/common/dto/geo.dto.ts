import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class LatLngDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'عرض جغرافیایی باید عدد باشد.' })
  @Min(-90, { message: 'عرض جغرافیایی نامعتبر است.' })
  @Max(90, { message: 'عرض جغرافیایی نامعتبر است.' })
  lat!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'طول جغرافیایی باید عدد باشد.' })
  @Min(-180, { message: 'طول جغرافیایی نامعتبر است.' })
  @Max(180, { message: 'طول جغرافیایی نامعتبر است.' })
  lng!: number;
}

export class LocationDto {
  @IsOptional()
  @Type(() => LatLngDto)
  location?: LatLngDto;
}
