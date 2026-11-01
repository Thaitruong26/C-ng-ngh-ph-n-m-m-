"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MOCK_CART_ITEMS } from "@/lib/mock-checkout";
import { Size, ToppingSnapshot } from "@/types/order";

/** Một dòng trong giỏ hàng, tương thích với cả FE2 và FE3 */
export interface CartItem {
  id: string;
  productId: number;
  name: string;
  productName: string;
  imageUrl: string;
  size: Size;
  sizeSurcharge: number;
  toppingIds: number[];
  toppings: ToppingSnapshot[];
  qty: number;
  quantity: number;
  basePrice: number;
  lineTotal: number;
  note?: string;
}

export type NewCartItemInput = Partial<CartItem> & {
  productId: number;
  size: Size;
  name?: string;
  productName?: string;
};

export function calculateItemUnitPrice(item: {
  basePrice?: number;
  sizeSurcharge?: number;
  toppings?: { price: number }[];
  lineTotal?: number;
  qty?: number;
  quantity?: number;
}): number {
  if (item.basePrice !== undefined) {
    const toppingsTotal = (item.toppings || []).reduce((sum, t) => sum + t.price, 0);
    return item.basePrice + (item.sizeSurcharge || 0) + toppingsTotal;
  }
  const qty = item.quantity ?? item.qty ?? 1;
  return item.lineTotal ? Math.round(item.lineTotal / qty) : 0;
}

export function toCartItem(raw: NewCartItemInput): CartItem {
  const name = raw.productName || raw.name || "Sản phẩm";
  const productName = raw.productName || raw.name || "Sản phẩm";
  const qty = raw.quantity ?? raw.qty ?? 1;
  const quantity = qty;
  const basePrice = raw.basePrice ?? 0;
  const sizeSurcharge =
    raw.sizeSurcharge ?? (raw.size === "M" ? 5000 : raw.size === "L" ? 10000 : 0);
  const toppings = raw.toppings || [];
  const toppingIds = raw.toppingIds || toppings.map((t) => t.id);
  const unitPrice = calculateItemUnitPrice({
    basePrice,
    sizeSurcharge,
    toppings,
  });
  const lineTotal = raw.lineTotal ?? unitPrice * qty;

  return {
    id:
      raw.id ||
      `${raw.productId}-${raw.size}-${[...toppingIds].sort((a, b) => a - b).join(",")}`,
    productId: raw.productId,
    name,
    productName,
    imageUrl: raw.imageUrl || "",
    size: raw.size,
    sizeSurcharge,
    toppingIds,
    toppings,
    qty,
    quantity,
    basePrice,
    lineTotal,
    note: raw.note,
  };
}

interface CartState {
  items: CartItem[];
  promoCode: string | null;
  discountAmount: number;
  addItem: (item: NewCartItemInput) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setPromoCode: (code: string | null, discountAmount?: number) => void;
  loadSampleCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      discountAmount: 0,

      addItem: (item) => {
        const fullItem = toCartItem(item);
        set((state) => {
          const existing = state.items.find((i) => i.id === fullItem.id);
          if (existing) {
            const newQty = existing.quantity + fullItem.quantity;
            const unitPrice = calculateItemUnitPrice(existing);
            return {
              items: state.items.map((i) =>
                i.id === fullItem.id
                  ? {
                      ...i,
                      qty: newQty,
                      quantity: newQty,
                      lineTotal: unitPrice * newQty,
                    }
                  : i,
              ),
            };
          }
          return { items: [...state.items, fullItem] };
        });
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) => {
        if (qty <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => {
            if (i.id !== id) return i;
            const unitPrice = calculateItemUnitPrice(i);
            return {
              ...i,
              qty,
              quantity: qty,
              lineTotal: unitPrice * qty,
            };
          }),
        }));
      },

      clearCart: () => set({ items: [], promoCode: null, discountAmount: 0 }),

      setPromoCode: (promoCode, discountAmount = 0) =>
        set({ promoCode, discountAmount }),

      loadSampleCart: () => {
        const sampleItems = MOCK_CART_ITEMS.map((item) =>
          toCartItem({
            id: item.id,
            productId: item.productId,
            name: item.productName,
            productName: item.productName,
            imageUrl: item.imageUrl,
            basePrice: item.basePrice,
            size: item.size,
            sizeSurcharge: item.sizeSurcharge,
            toppings: item.toppings,
            toppingIds: item.toppings.map((t) => t.id),
            quantity: item.quantity,
            qty: item.quantity,
            note: item.note,
          }),
        );
        set({
          items: sampleItems,
          promoCode: "GIAM10",
          discountAmount: 10000,
        });
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce(
          (sum, item) => sum + calculateItemUnitPrice(item) * item.quantity,
          0,
        );
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const discount = get().discountAmount || 0;
        return Math.max(0, subtotal - discount);
      },
    }),
    { name: "brewlite.cart" },
  ),
);

/** Tổng số lượng tất cả items trong giỏ. */
export function selectTotalItems(state: CartState) {
  return state.items.reduce((sum, i) => sum + (i.quantity ?? i.qty ?? 0), 0);
}

/** Tổng tiền giỏ hàng (chỉ để hiển thị; server sẽ tính lại khi đặt đơn). */
export function selectTotalAmount(state: CartState) {
  return state.items.reduce(
    (sum, i) =>
      sum +
      (i.lineTotal ||
        calculateItemUnitPrice(i) * (i.quantity ?? i.qty ?? 1)),
    0,
  );
}
