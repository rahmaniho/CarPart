import type { Http } from '../http';
import type { PageResult, SearchOffer, VehicleRow } from '../types';

export interface CatalogApi {
  search(query: {
    q?: string;
    categoryId?: string;
    brandId?: string;
    vehicleId?: string;
    city?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PageResult<SearchOffer>>;
  parts(query?: Record<string, string | number | undefined>): Promise<PageResult<Record<string, unknown>>>;
  part(id: string): Promise<Record<string, unknown>>;
  categories(): Promise<Array<Record<string, unknown>>>;
  brands(): Promise<Array<Record<string, unknown>>>;
  vehicleMakes(): Promise<Array<Record<string, unknown>>>;
  vehicleModels(makeId: string): Promise<Array<Record<string, unknown>>>;
  vehicleVariants(modelId: string): Promise<Array<Record<string, unknown>>>;
  vehicles(): Promise<VehicleRow[]>;
}

export function catalogApi(http: Http): CatalogApi {
  return {
    search: (query) => http.get<PageResult<SearchOffer>>('/catalog/search', { query }),
    parts: (query = {}) => http.get<PageResult<Record<string, unknown>>>('/catalog/parts', { query }),
    part: (id) => http.get<Record<string, unknown>>(`/catalog/parts/${id}`),
    categories: () => http.get<Array<Record<string, unknown>>>('/catalog/categories'),
    brands: () => http.get<Array<Record<string, unknown>>>('/catalog/brands'),
    vehicleMakes: () => http.get<Array<Record<string, unknown>>>('/catalog/vehicle-makes'),
    vehicleModels: (makeId) => http.get<Array<Record<string, unknown>>>('/catalog/vehicle-models', { query: { makeId } }),
    vehicleVariants: (modelId) => http.get<Array<Record<string, unknown>>>('/catalog/vehicle-variants', { query: { modelId } }),
    vehicles: () => http.get<VehicleRow[]>('/workshops/me/vehicles'),
  };
}
