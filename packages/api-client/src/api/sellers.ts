import type { Http } from '../http';
import type { OrderDetail, OrderEventRow, OrderRow, PageResult, QuoteRow, RequestRow } from '../types';

export interface SellerProfile {
  id: string;
  userId: string;
  storeName: string;
  legalName?: string | null;
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  description?: string | null;
  verificationStatus: string;
  isActive: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  payoutInfo?: Record<string, string> | null;
  [k: string]: unknown;
}

export interface SellerBranchRow {
  id: string;
  name: string;
  city?: string | null;
  addressText?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
  preparationMinutes?: number;
  [k: string]: unknown;
}

export interface SellerProductRow {
  id: string;
  partId: string;
  branchId?: string | null;
  sku?: string | null;
  price: number;
  listPrice?: number | null;
  stock: number;
  reservedStock?: number;
  availableStock?: number;
  quality?: string;
  isActive: boolean;
  part?: { id: string; nameFa: string; [k: string]: unknown } | null;
  updatedAt?: string;
  [k: string]: unknown;
}

export interface CreateProductInput {
  partId?: string;
  newPart?: { nameFa: string; brandId?: string; categoryId?: string; technicalCode?: string; oemCode?: string };
  branchId?: string;
  sku?: string;
  price: number;
  listPrice?: number | null;
  stock: number;
  quality?: string;
  isGenuineClaimed?: boolean;
  preparationMinutes?: number;
  warrantyNote?: string;
  returnPolicy?: string;
}

export interface SubmitQuoteInput {
  items: Array<{ sellerProductId: string; quantity: number; unitPrice: number }>;
  preparationMinutes: number;
  note?: string;
  deliveryFee?: number;
  validMinutes?: number;
}

/**
 * APIهای پنل فروشنده: پروفایل و شعبه‌ها، محصولات/موجودی، سفارش‌ها،
 * درخواست‌های تأمین و پیشنهاد قیمت، و امور مالی (کمیسیون/تسویه).
 */
export interface SellersApi {
  me(): Promise<SellerProfile>;
  update(input: Partial<SellerProfile>): Promise<SellerProfile>;
  submitReview(): Promise<SellerProfile>;
  dashboard(): Promise<Record<string, unknown>>;
  branches(): Promise<SellerBranchRow[]>;
  addBranch(input: Partial<SellerBranchRow>): Promise<SellerBranchRow>;
  updateBranch(id: string, input: Partial<SellerBranchRow>): Promise<SellerBranchRow>;
  products(query?: { page?: number; pageSize?: number; q?: string }): Promise<PageResult<SellerProductRow>>;
  createProduct(input: CreateProductInput): Promise<SellerProductRow>;
  updateProduct(id: string, input: Partial<CreateProductInput>): Promise<SellerProductRow>;
  setPrice(id: string, price: number, listPrice?: number | null): Promise<SellerProductRow>;
  setStock(id: string, input: { delta?: number; absoluteStock?: number; reason: 'initial' | 'restock' | 'adjustment' | 'return'; note?: string }): Promise<SellerProductRow>;
  setActive(id: string, isActive: boolean): Promise<SellerProductRow>;
  orders(query?: { status?: string; page?: number; pageSize?: number }): Promise<PageResult<OrderRow>>;
  orderDetail(id: string): Promise<OrderDetail>;
  orderEvents(id: string): Promise<OrderEventRow[]>;
  transitionOrder(id: string, to: string, reason?: string): Promise<OrderDetail>;
  requests(query?: { page?: number; pageSize?: number; status?: string }): Promise<PageResult<RequestRow>>;
  requestDetail(id: string): Promise<RequestRow & { items?: Array<Record<string, unknown>> }>;
  submitQuote(requestId: string, input: SubmitQuoteInput): Promise<QuoteRow>;
  myQuotes(query?: { page?: number; pageSize?: number; status?: string }): Promise<PageResult<QuoteRow>>;
  quoteStats(): Promise<Record<string, unknown>>;
  withdrawQuote(id: string): Promise<QuoteRow>;
  financeSummary(): Promise<Record<string, unknown>>;
  commissionRate(): Promise<Record<string, unknown>>;
  commissions(query?: { page?: number; pageSize?: number }): Promise<PageResult<Record<string, unknown>>>;
  payouts(query?: { page?: number; pageSize?: number }): Promise<PageResult<Record<string, unknown>>>;
  storePublic(id: string): Promise<Record<string, unknown>>;
}

export function sellersApi(http: Http): SellersApi {
  return {
    me: () => http.get<SellerProfile>('/sellers/me'),
    update: (input) => http.put<SellerProfile>('/sellers/me', input),
    submitReview: () => http.post<SellerProfile>('/sellers/me/submit-review', {}),
    dashboard: () => http.get<Record<string, unknown>>('/sellers/me/dashboard'),
    branches: () => http.get<SellerBranchRow[]>('/sellers/me/branches'),
    addBranch: (input) => http.post<SellerBranchRow>('/sellers/me/branches', input),
    updateBranch: (id, input) => http.patch<SellerBranchRow>(`/sellers/me/branches/${id}`, input),
    products: (query = {}) => http.get<PageResult<SellerProductRow>>('/sellers/me/products', { query }),
    createProduct: (input) => http.post<SellerProductRow>('/sellers/me/products', input),
    updateProduct: (id, input) => http.patch<SellerProductRow>(`/sellers/me/products/${id}`, input),
    setPrice: (id, price, listPrice) => http.post<SellerProductRow>(`/sellers/me/products/${id}/price`, { price, listPrice }),
    setStock: (id, input) => http.post<SellerProductRow>(`/sellers/me/products/${id}/stock`, input),
    setActive: (id, isActive) => http.post<SellerProductRow>(`/sellers/me/products/${id}/active`, { isActive }),
    orders: (query = {}) => http.get<PageResult<OrderRow>>('/seller/orders', { query }),
    orderDetail: (id) => http.get<OrderDetail>(`/seller/orders/${id}`),
    orderEvents: (id) => http.get<OrderEventRow[]>(`/seller/orders/${id}/events`),
    transitionOrder: (id, to, reason) => http.post<OrderDetail>(`/seller/orders/${id}/transition`, { to, reason }),
    requests: (query = {}) => http.get<PageResult<RequestRow>>('/seller/requests', { query }),
    requestDetail: (id) => http.get<RequestRow & { items?: Array<Record<string, unknown>> }>(`/seller/requests/${id}`),
    submitQuote: (requestId, input) => http.post<QuoteRow>(`/seller/requests/${requestId}/quotes`, input),
    myQuotes: (query = {}) => http.get<PageResult<QuoteRow>>('/seller/quotes', { query }),
    quoteStats: () => http.get<Record<string, unknown>>('/seller/quotes/stats'),
    withdrawQuote: (id) => http.post<QuoteRow>(`/seller/quotes/${id}/withdraw`, {}),
    financeSummary: () => http.get<Record<string, unknown>>('/seller/finance/summary'),
    commissionRate: () => http.get<Record<string, unknown>>('/seller/finance/commission-rate'),
    commissions: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/seller/finance/commissions', { query }),
    payouts: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/seller/finance/payouts', { query }),
    storePublic: (id) => http.get<Record<string, unknown>>(`/public/sellers/${id}`),
  };
}
