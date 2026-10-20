import type { QualityGrade } from '@carpart/contract';
import { create } from 'zustand';

export interface CartItem {
  sellerProductId: string;
  partId: string;
  partNameFa: string;
  sku?: string | null;
  sellerId: string;
  sellerName: string;
  branchName?: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  quality: QualityGrade;
  estimatedDeliveryFee?: number;
}

interface CartState {
  items: CartItem[];
  selectedVehicleId: string | null;
  setVehicleId: (id: string | null) => void;
  addItem: (item: CartItem, replaceDifferentSeller?: boolean) => { ok: true } | { ok: false; conflictSellerName: string };
  setQuantity: (sellerProductId: string, quantity: number) => void;
  removeItem: (sellerProductId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'carpart_cart_v1';

function loadInitial(): Pick<CartState, 'items' | 'selectedVehicleId'> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { items: [], selectedVehicleId: null };
    const parsed = JSON.parse(raw) as Partial<Pick<CartState, 'items' | 'selectedVehicleId'>>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      selectedVehicleId: parsed.selectedVehicleId ?? null,
    };
  } catch {
    return { items: [], selectedVehicleId: null };
  }
}

function persist(state: Pick<CartState, 'items' | 'selectedVehicleId'>): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // نادیده‌گرفتن خطای فضای ذخیره‌سازی مرورگر
  }
}

export const useCartStore = create<CartState>((set, get) => {
  const initial = loadInitial();
  return {
    items: initial.items,
    selectedVehicleId: initial.selectedVehicleId,

    setVehicleId: (id) => {
      set({ selectedVehicleId: id });
      persist({ items: get().items, selectedVehicleId: id });
    },

    addItem: (incoming, replaceDifferentSeller = false) => {
      const current = get().items;
      if (current.length > 0 && current[0].sellerId !== incoming.sellerId) {
        if (!replaceDifferentSeller) {
          return { ok: false, conflictSellerName: current[0].sellerName };
        }
        const replaced = [{ ...incoming, quantity: Math.max(1, Math.min(incoming.quantity, incoming.maxStock)) }];
        set({ items: replaced });
        persist({ items: replaced, selectedVehicleId: get().selectedVehicleId });
        return { ok: true };
      }

      const existing = current.find((it) => it.sellerProductId === incoming.sellerProductId);
      const next = existing
        ? current.map((it) =>
            it.sellerProductId === incoming.sellerProductId
              ? { ...it, quantity: Math.min(it.maxStock, it.quantity + incoming.quantity), unitPrice: incoming.unitPrice }
              : it,
          )
        : [...current, { ...incoming, quantity: Math.max(1, Math.min(incoming.quantity, incoming.maxStock)) }];
      set({ items: next });
      persist({ items: next, selectedVehicleId: get().selectedVehicleId });
      return { ok: true };
    },

    setQuantity: (sellerProductId, quantity) => {
      const current = get().items;
      const next =
        quantity <= 0
          ? current.filter((it) => it.sellerProductId !== sellerProductId)
          : current.map((it) =>
              it.sellerProductId === sellerProductId ? { ...it, quantity: Math.min(it.maxStock, quantity) } : it,
            );
      set({ items: next });
      persist({ items: next, selectedVehicleId: get().selectedVehicleId });
    },

    removeItem: (sellerProductId) => {
      const next = get().items.filter((it) => it.sellerProductId !== sellerProductId);
      set({ items: next });
      persist({ items: next, selectedVehicleId: get().selectedVehicleId });
    },

    clear: () => {
      set({ items: [] });
      persist({ items: [], selectedVehicleId: get().selectedVehicleId });
    },
  };
});
