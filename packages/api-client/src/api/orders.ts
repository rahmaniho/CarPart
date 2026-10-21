import type { Http } from '../http';
import type {
  DeliveryTracking,
  OrderDetail,
  OrderEventRow,
  OrderRow,
  PageResult,
  PaymentReadiness,
  PaymentRow,
  QuoteComparisonRow,
  QuoteRow,
  RequestRow,
} from '../types';

export interface OrdersApi {
  list(query?: { status?: string; page?: number; pageSize?: number }): Promise<PageResult<OrderRow>>;
  detail(id: string): Promise<OrderDetail>;
  events(id: string): Promise<OrderEventRow[]>;
  create(input: {
    items: Array<{ sellerProductId: string; quantity: number }>;
    deliveryAddressId?: string;
    couponCode?: string;
    notes?: string;
    urgency?: string;
    vehicleId?: string;
    saveAsDraft?: boolean;
  }, idempotencyKey?: string): Promise<OrderDetail>;
  checkout(id: string, idempotencyKey?: string): Promise<OrderDetail>;
  transition(id: string, to: string, reason?: string): Promise<OrderDetail>;
  cancel(id: string, reason: string): Promise<OrderDetail>;
  tracking(orderId: string): Promise<DeliveryTracking>;
}

export interface RequestsApi {
  list(query?: { status?: string; page?: number; pageSize?: number }): Promise<PageResult<RequestRow>>;
  detail(id: string): Promise<RequestRow>;
  create(input: {
    titleFa: string;
    partNameFa: string;
    quantity: number;
    urgency: string;
    description?: string;
    vehicleId?: string;
    deliveryAddressId?: string;
    deadlineMinutes?: number;
  }): Promise<RequestRow>;
  cancel(id: string, reason?: string): Promise<RequestRow>;
  quotes(id: string): Promise<{ request: RequestRow; quotes: QuoteComparisonRow[] }>;
  acceptQuote(quoteId: string, idempotencyKey?: string): Promise<OrderRow>;
  myQuotes(query?: { status?: string; page?: number; pageSize?: number }): Promise<PageResult<QuoteRow>>;
}

export interface PaymentsApi {
  readiness(): Promise<PaymentReadiness>;
  create(input: { orderId: string; method?: string; returnUrl?: string }, idempotencyKey?: string): Promise<PaymentRow>;
  verify(input: { orderId: string; refId?: string; authority?: string }): Promise<PaymentRow>;
  sandboxConfirm(input: { orderId: string; decision: 'paid' | 'failed' }): Promise<PaymentRow>;
  refund(input: { orderId: string; reason: string }, idempotencyKey?: string): Promise<Record<string, unknown>>;
  myRefunds(query?: { page?: number; pageSize?: number }): Promise<PageResult<Record<string, unknown>>>;
}

export function ordersApi(http: Http): OrdersApi {
  return {
    list: (query = {}) => http.get<PageResult<OrderRow>>('/orders', { query }),
    detail: (id) => http.get<OrderDetail>(`/orders/${id}`),
    events: (id) => http.get<OrderEventRow[]>(`/orders/${id}/events`),
    create: (input, idempotencyKey) =>
      http.post<OrderDetail>('/orders', input, idempotencyKey ? { idempotencyKey } : {}),
    checkout: (id, idempotencyKey) => http.post<OrderDetail>(`/orders/${id}/checkout`, {}, idempotencyKey ? { idempotencyKey } : {}),
    transition: (id, to, reason) => http.post<OrderDetail>(`/orders/${id}/transition`, { to, reason }),
    cancel: (id, reason) => http.post<OrderDetail>(`/orders/${id}/cancel`, { reason }),
    tracking: (orderId) => http.get<DeliveryTracking>(`/orders/${orderId}/tracking`),
  };
}

export function requestsApi(http: Http): RequestsApi {
  return {
    list: (query = {}) => http.get<PageResult<RequestRow>>('/requests', { query }),
    detail: (id) => http.get<RequestRow>(`/requests/${id}`),
    create: (input) => http.post<RequestRow>('/requests', input),
    cancel: (id, reason) => http.post<RequestRow>(`/requests/${id}/cancel`, { reason }),
    quotes: (id) => http.get<{ request: RequestRow; quotes: QuoteComparisonRow[] }>(`/requests/${id}/quotes`),
    acceptQuote: (quoteId, idempotencyKey) =>
      http.post<OrderRow>(`/requests/quotes/${quoteId}/accept`, {}, idempotencyKey ? { idempotencyKey } : {}),
    myQuotes: (query = {}) => http.get<PageResult<QuoteRow>>('/seller/quotes', { query }),
  };
}

export function paymentsApi(http: Http): PaymentsApi {
  return {
    readiness: () => http.get<PaymentReadiness>('/payments/readiness'),
    create: (input, idempotencyKey) => http.post<PaymentRow>('/payments', input, idempotencyKey ? { idempotencyKey } : {}),
    verify: (input) => http.post<PaymentRow>('/payments/verify', input),
    sandboxConfirm: (input) => http.post<PaymentRow>('/payments/sandbox/confirm', input),
    refund: (input, idempotencyKey) =>
      http.post<Record<string, unknown>>('/payments/refunds', input, idempotencyKey ? { idempotencyKey } : {}),
    myRefunds: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/payments/refunds/mine', { query }),
  };
}
