import type { Permission, Role } from '@carpart/contract';

export interface AccessTokenPayload {
  sub: string;
  mobile: string;
  roles: Role[];
  sessionId: string;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  typ: 'refresh';
  jti: string;
}

export type ProfileKind = 'workshop' | 'seller' | 'courier' | null;

/** کاربر احراز هویت‌شده در طول درخواست — توسط JwtAuthGuard ساخته می‌شود. */
export interface RequestUser {
  id: string;
  mobile: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  sessionId: string;
  profileId: string | null;
  profileKind: ProfileKind;
  verificationStatus: string | null;
  isActive: boolean;
  city: string | null;
}
