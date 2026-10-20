import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'carpart:isPublic';
/** مسیرهای عمومی که نیاز به احراز هویت ندارند. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
