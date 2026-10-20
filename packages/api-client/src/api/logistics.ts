import type { Http } from '../http';
import type {
  AddressRow,
  CourierProfile,
  DeliveryMission,
  NotificationRow,
  PageResult,
  VehicleRow,
} from '../types';

export interface WorkshopsApi {
  me(): Promise<Record<string, unknown>>;
  update(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  vehicles(): Promise<VehicleRow[]>;
  addVehicle(input: Record<string, unknown>): Promise<VehicleRow>;
  updateVehicle(id: string, input: Record<string, unknown>): Promise<VehicleRow>;
  addresses(): Promise<AddressRow[]>;
  addAddress(input: Record<string, unknown>): Promise<AddressRow>;
  updateAddress(id: string, input: Record<string, unknown>): Promise<AddressRow>;
}

export interface CouriersApi {
  me(): Promise<CourierProfile>;
  update(input: Record<string, unknown>): Promise<CourierProfile>;
  dashboard(): Promise<Record<string, unknown>>;
  setAvailability(isOnline: boolean): Promise<CourierProfile>;
  sendLocation(lat: number, lng: number): Promise<{ ok: boolean }>;
}

export interface DeliveryApi {
  list(query?: { status?: 'offers' | 'active' | 'history' | 'all'; page?: number; pageSize?: number }): Promise<PageResult<DeliveryMission>>;
  detail(id: string): Promise<DeliveryMission>;
  events(id: string): Promise<Array<Record<string, unknown>>>;
  accept(id: string): Promise<DeliveryMission>;
  reject(id: string, reason?: string): Promise<DeliveryMission>;
  pickup(id: string, code: string): Promise<DeliveryMission>;
  transit(id: string): Promise<DeliveryMission>;
  deliver(id: string, otp: string): Promise<DeliveryMission>;
  fail(id: string, reason: string): Promise<DeliveryMission>;
  orderTracking(orderId: string): Promise<Record<string, unknown>>;
}

export interface NotificationsApi {
  list(query?: { page?: number; pageSize?: number; unreadOnly?: boolean }): Promise<PageResult<NotificationRow>>;
  unreadCount(): Promise<{ count: number }>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  registerDeviceToken(input: { token: string; platform: 'android' | 'ios' | 'web'; appFlavor?: 'mechanic' | 'courier' | 'seller' | 'web' }): Promise<{ id: string; platform: string; appFlavor?: string | null }>;
  unregisterDeviceToken(token: string): Promise<{ removed: boolean }>;
  deviceTokens(): Promise<Array<{ id: string; platform: string; appFlavor?: string | null; lastSeenAt?: string | null }>>;
}

export function workshopsApi(http: Http): WorkshopsApi {
  return {
    me: () => http.get<Record<string, unknown>>('/workshops/me'),
    update: (input) => http.put<Record<string, unknown>>('/workshops/me', input),
    vehicles: () => http.get<VehicleRow[]>('/workshops/me/vehicles'),
    addVehicle: (input) => http.post<VehicleRow>('/workshops/me/vehicles', input),
    updateVehicle: (id, input) => http.patch<VehicleRow>(`/workshops/me/vehicles/${id}`, input),
    addresses: () => http.get<AddressRow[]>('/workshops/me/addresses'),
    addAddress: (input) => http.post<AddressRow>('/workshops/me/addresses', input),
    updateAddress: (id, input) => http.patch<AddressRow>(`/workshops/me/addresses/${id}`, input),
  };
}

export function couriersApi(http: Http): CouriersApi {
  return {
    me: () => http.get<CourierProfile>('/couriers/me'),
    update: (input) => http.put<CourierProfile>('/couriers/me', input),
    dashboard: () => http.get<Record<string, unknown>>('/couriers/me/dashboard'),
    setAvailability: (isOnline) => http.post<CourierProfile>('/couriers/me/availability', { isOnline }),
    sendLocation: async (lat, lng) => {
      await http.post('/couriers/me/location', { lat, lng });
      return { ok: true };
    },
  };
}

export function deliveryApi(http: Http): DeliveryApi {
  return {
    list: (query = {}) => http.get<PageResult<DeliveryMission>>('/courier/deliveries', { query }),
    detail: (id) => http.get<DeliveryMission>(`/courier/deliveries/${id}`),
    events: (id) => http.get<Array<Record<string, unknown>>>(`/courier/deliveries/${id}/events`),
    accept: (id) => http.post<DeliveryMission>(`/courier/deliveries/${id}/accept`, {}),
    reject: (id, reason) => http.post<DeliveryMission>(`/courier/deliveries/${id}/reject`, { reason }),
    pickup: (id, code) => http.post<DeliveryMission>(`/courier/deliveries/${id}/pickup`, { code }),
    transit: (id) => http.post<DeliveryMission>(`/courier/deliveries/${id}/transit`, {}),
    deliver: (id, otp) => http.post<DeliveryMission>(`/courier/deliveries/${id}/deliver`, { otp }),
    fail: (id, reason) => http.post<DeliveryMission>(`/courier/deliveries/${id}/fail`, { reason }),
    orderTracking: (orderId) => http.get<Record<string, unknown>>(`/orders/${orderId}/tracking`),
  };
}

export function notificationsApi(http: Http): NotificationsApi {
  return {
    list: (query = {}) => http.get<PageResult<NotificationRow>>('/notifications', { query }),
    unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
    markRead: async (id) => {
      await http.post(`/notifications/${id}/read`);
    },
    markAllRead: async () => {
      await http.post('/notifications/read-all');
    },
    registerDeviceToken: (input) => http.post('/notifications/device-tokens', input),
    unregisterDeviceToken: (token) => http.delete(`/notifications/device-tokens/${encodeURIComponent(token)}`),
    deviceTokens: () => http.get('/notifications/device-tokens'),
  };
}
