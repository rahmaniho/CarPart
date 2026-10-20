import type { Http } from '../http';
import type { AuthSession, OtpRequestResult, RegisterResult, SessionUser } from '../types';

export interface AuthApi {
  requestOtp(mobile: string, purpose?: 'login' | 'mobile_verify' | 'password_reset'): Promise<OtpRequestResult>;
  verifyOtp(mobile: string, code: string, purpose?: 'login' | 'mobile_verify' | 'password_reset'): Promise<AuthSession>;
  login(mobile: string, password: string): Promise<AuthSession>;
  register(input: {
    mobile: string;
    fullName: string;
    role: 'mechanic' | 'seller' | 'courier';
    password?: string;
    workshopName?: string;
    storeName?: string;
    city?: string;
    acceptTerms?: boolean;
  }): Promise<RegisterResult>;
  refresh(): Promise<AuthSession>;
  logout(): Promise<void>;
  me(): Promise<SessionUser>;
}

export function authApi(http: Http): AuthApi {
  return {
    requestOtp: (mobile, purpose = 'login') => http.post<OtpRequestResult>('/auth/otp/request', { mobile, purpose }, { anonymous: true }),
    verifyOtp: (mobile, code, purpose = 'login') => http.post<AuthSession>('/auth/otp/verify', { mobile, code, purpose }, { anonymous: true }),
    login: (mobile, password) => http.post<AuthSession>('/auth/login', { mobile, password }, { anonymous: true }),
    register: (input) => http.post<RegisterResult>('/auth/register', input, { anonymous: true }),
    refresh: () => http.post<AuthSession>('/auth/refresh', {}, { anonymous: true }),
    logout: async () => {
      await http.post<void>('/auth/logout', {});
    },
    me: () => http.get<SessionUser>('/auth/me'),
  };
}
