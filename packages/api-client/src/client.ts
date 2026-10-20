import { Http, type HttpOptions } from './http';
import { authApi, type AuthApi } from './api/auth';
import { catalogApi, type CatalogApi } from './api/catalog';
import { ordersApi, paymentsApi, requestsApi, type OrdersApi, type PaymentsApi, type RequestsApi } from './api/orders';
import {
  couriersApi,
  deliveryApi,
  notificationsApi,
  workshopsApi,
  type CouriersApi,
  type DeliveryApi,
  type NotificationsApi,
  type WorkshopsApi,
} from './api/logistics';
import {
  adminApi,
  auditApi,
  financeApi,
  settingsApi,
  supportApi,
  type AdminApi,
  type AuditApi,
  type FinanceApi,
  type SettingsApi,
  type SupportApi,
} from './api/platform';
import { LocalStorageTokenStore, type TokenStore } from './tokens';

export interface ApiClientOptions {
  baseUrl: string;
  tokens?: TokenStore;
  fetchImpl?: typeof fetch;
  onSessionExpired?: () => void;
}

/**
 * کلاینت یکپارچه API کارپارت.
 * همهٔ ماژول‌های دامنه از همین شیء در دسترس‌اند:
 *
 * ```ts
 * const api = createApiClient({ baseUrl: 'http://localhost:4000/api/v1' });
 * const offers = await api.catalog.search({ q: 'لنت ترمز' });
 * ```
 */
export class ApiClient {
  readonly http: Http;
  readonly auth: AuthApi;
  readonly catalog: CatalogApi;
  readonly orders: OrdersApi;
  readonly requests: RequestsApi;
  readonly payments: PaymentsApi;
  readonly workshops: WorkshopsApi;
  readonly couriers: CouriersApi;
  readonly delivery: DeliveryApi;
  readonly notifications: NotificationsApi;
  readonly admin: AdminApi;
  readonly settings: SettingsApi;
  readonly audit: AuditApi;
  readonly finance: FinanceApi;
  readonly support: SupportApi;

  constructor(options: ApiClientOptions) {
    const httpOptions: HttpOptions = {
      baseUrl: options.baseUrl,
      tokens: options.tokens ?? new LocalStorageTokenStore(),
      fetchImpl: options.fetchImpl,
      onSessionExpired: options.onSessionExpired,
    };
    this.http = new Http(httpOptions);
    this.auth = authApi(this.http);
    this.catalog = catalogApi(this.http);
    this.orders = ordersApi(this.http);
    this.requests = requestsApi(this.http);
    this.payments = paymentsApi(this.http);
    this.workshops = workshopsApi(this.http);
    this.couriers = couriersApi(this.http);
    this.delivery = deliveryApi(this.http);
    this.notifications = notificationsApi(this.http);
    this.admin = adminApi(this.http);
    this.settings = settingsApi(this.http);
    this.audit = auditApi(this.http);
    this.finance = financeApi(this.http);
    this.support = supportApi(this.http);
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
