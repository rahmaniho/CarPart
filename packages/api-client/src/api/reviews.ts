import type { Http } from '../http';
import type { PageResult } from '../types';

export interface ReviewRow {
  id: string;
  orderId: string;
  targetType: 'seller' | 'courier';
  targetId: string;
  rating: number;
  comment?: string | null;
  hadIssue?: boolean;
  isPublished?: boolean;
  createdAt: string;
  [k: string]: unknown;
}

export interface ReviewsApi {
  create(input: { orderId: string; targetType: 'seller' | 'courier'; rating: number; comment?: string; hadIssue?: boolean }): Promise<ReviewRow>;
  mine(query?: { page?: number; pageSize?: number }): Promise<PageResult<ReviewRow>>;
  publicForTarget(targetType: 'seller' | 'courier', targetId: string, query?: { page?: number; pageSize?: number }): Promise<PageResult<ReviewRow>>;
  stats(targetType: 'seller' | 'courier', targetId: string): Promise<Record<string, unknown>>;
}

export function reviewsApi(http: Http): ReviewsApi {
  return {
    create: (input) => http.post<ReviewRow>('/reviews', input),
    mine: (query = {}) => http.get<PageResult<ReviewRow>>('/reviews/mine', { query }),
    publicForTarget: (targetType, targetId, query = {}) => http.get<PageResult<ReviewRow>>('/public/reviews', { query: { targetType, targetId, ...query } }),
    stats: (targetType, targetId) => http.get<Record<string, unknown>>('/public/reviews/stats', { query: { targetType, targetId } }),
  };
}
