import type { Http } from '../http';
import type {
  AdminDashboard,
  AdminUserRow,
  AuditRow,
  DailySeriesPoint,
  OrderRow,
  PageResult,
  SettingRow,
  TicketRow,
  VerificationRow,
} from '../types';

export interface AdminApi {
  dashboard(rangeDays?: number): Promise<AdminDashboard>;
  dailyReport(days?: number): Promise<DailySeriesPoint[]>;
  topSellers(rangeDays?: number): Promise<Array<Record<string, unknown>>>;
  verificationCounts(): Promise<{ seller: number; courier: number; workshop: number }>;
  verifications(kind: 'seller' | 'courier' | 'workshop', status?: string): Promise<VerificationRow[]>;
  approve(kind: 'seller' | 'courier' | 'workshop', id: string, note?: string): Promise<unknown>;
  reject(kind: 'seller' | 'courier' | 'workshop', id: string, reason: string): Promise<unknown>;
  suspend(kind: 'seller' | 'courier' | 'workshop', id: string, reason: string): Promise<unknown>;
  users(query?: { q?: string; role?: string; page?: number; pageSize?: number }): Promise<PageResult<AdminUserRow>>;
  user(id: string): Promise<AdminUserRow>;
  updateUser(id: string, input: { roles?: string[]; isActive?: boolean; fullName?: string }): Promise<AdminUserRow>;
  orders(query?: { status?: string; sellerId?: string; page?: number; pageSize?: number }): Promise<PageResult<OrderRow>>;
  orderStatistics(days?: number): Promise<Record<string, unknown>>;
  deliveries(query?: { page?: number; pageSize?: number }): Promise<PageResult<Record<string, unknown>>>;
  deliveryStatistics(): Promise<Record<string, unknown>>;
}

export interface SettingsApi {
  public(): Promise<SettingRow[]>;
  announcements(): Promise<Array<Record<string, unknown>>>;
  adminList(): Promise<SettingRow[]>;
  adminUpdate(key: string, value: string | number | boolean): Promise<SettingRow>;
}

export interface AuditApi {
  list(query?: { page?: number; pageSize?: number; action?: string }): Promise<PageResult<AuditRow>>;
  summary(): Promise<Record<string, unknown>>;
}

export interface FinanceApi {
  adminSummary(from?: string, to?: string): Promise<Record<string, unknown>>;
  sellerSummary(): Promise<Record<string, unknown>>;
  courierPayouts(query?: { page?: number; pageSize?: number }): Promise<PageResult<Record<string, unknown>>>;
  adminPayouts(query?: { page?: number; pageSize?: number; status?: string }): Promise<PageResult<Record<string, unknown>>>;
}

export interface SupportApi {
  myTickets(query?: { page?: number; pageSize?: number }): Promise<PageResult<TicketRow>>;
  openTicket(input: { subject: string; body: string; orderId?: string; priority?: string }): Promise<TicketRow>;
  ticketMessages(id: string): Promise<Array<Record<string, unknown>>>;
  replyTicket(id: string, body: string): Promise<Record<string, unknown>>;
}

export function adminApi(http: Http): AdminApi {
  return {
    dashboard: (rangeDays = 30) => http.get<AdminDashboard>('/admin/dashboard', { query: { rangeDays } }),
    dailyReport: (days = 14) => http.get<DailySeriesPoint[]>('/admin/reports/daily', { query: { days } }),
    topSellers: (rangeDays = 30) => http.get<Array<Record<string, unknown>>>('/admin/reports/top-sellers', { query: { rangeDays } }),
    verificationCounts: () => http.get<{ seller: number; courier: number; workshop: number }>('/admin/verifications/counts'),
    verifications: (kind, status = 'PENDING_REVIEW') => http.get<VerificationRow[]>(`/admin/verifications/${kind}`, { query: { status } }),
    approve: (kind, id, note) => http.post(`/admin/verifications/${kind}/${id}/approve`, { note }),
    reject: (kind, id, reason) => http.post(`/admin/verifications/${kind}/${id}/reject`, { reason }),
    suspend: (kind, id, reason) => http.post(`/admin/verifications/${kind}/${id}/suspend`, { reason }),
    users: (query = {}) => http.get<PageResult<AdminUserRow>>('/admin/users', { query }),
    user: (id) => http.get<AdminUserRow>(`/admin/users/${id}`),
    updateUser: (id, input) => http.patch<AdminUserRow>(`/admin/users/${id}`, input),
    orders: (query = {}) => http.get<PageResult<OrderRow>>('/admin/orders', { query }),
    orderStatistics: (days = 30) => http.get<Record<string, unknown>>('/admin/orders/statistics', { query: { days } }),
    deliveries: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/admin/deliveries', { query }),
    deliveryStatistics: () => http.get<Record<string, unknown>>('/admin/deliveries/statistics'),
  };
}

export function settingsApi(http: Http): SettingsApi {
  return {
    public: () => http.get<SettingRow[]>('/public/settings'),
    announcements: () => http.get<Array<Record<string, unknown>>>('/public/announcements'),
    adminList: () => http.get<SettingRow[]>('/admin/settings'),
    adminUpdate: (key, value) => http.patch<SettingRow>(`/admin/settings/${encodeURIComponent(key)}`, { value }),
  };
}

export function auditApi(http: Http): AuditApi {
  return {
    list: (query = {}) => http.get<PageResult<AuditRow>>('/admin/audit', { query }),
    summary: () => http.get<Record<string, unknown>>('/admin/audit/summary'),
  };
}

export function financeApi(http: Http): FinanceApi {
  return {
    adminSummary: (from, to) => http.get<Record<string, unknown>>('/admin/finance/summary', { query: { from, to } }),
    sellerSummary: () => http.get<Record<string, unknown>>('/seller/finance/summary'),
    courierPayouts: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/courier/finance/payouts', { query }),
    adminPayouts: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/admin/finance/payouts', { query }),
  };
}

export function supportApi(http: Http): SupportApi {
  return {
    myTickets: (query = {}) => http.get<PageResult<TicketRow>>('/support/tickets', { query }),
    openTicket: (input) => http.post<TicketRow>('/support/tickets', input),
    ticketMessages: (id) => http.get<Array<Record<string, unknown>>>(`/support/tickets/${id}/messages`),
    replyTicket: (id, body) => http.post<Record<string, unknown>>(`/support/tickets/${id}/messages`, { body }),
  };
}
