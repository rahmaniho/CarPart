import { SetMetadata } from '@nestjs/common';
import type { Role } from '@carpart/contract';

export const ROLES_KEY = 'carpart:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
