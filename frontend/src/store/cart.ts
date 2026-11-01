"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MOCK_CART_ITEMS } from "@/lib/mock-checkout";

export type Size = "S" | "M" | "L";
export type CartTopping = { id: number; name: string; price: number };

export type CartItem = {
  /** Khóa duy nhất của một dòng: cùng sản phẩm + size + bộ topping */
  key: string;
  id?: string;
  productId: number;
  name: string;
  productName?: string;
  imageUrl: string;
  size: Size;
  sizeSurcharge: number;
  toppings: CartTopping[];
  toppingIds?: number[];
  basePrice: number;
  quantity: number;
  qty?: number;
  lineTotal?: number;
  note?: string;
};

/** Giới hạn theo api.md (POST /orders): mỗi dòng 1–20 phần, tối đa 30 dòng, tối đa 3 topping. */
export const MAX_QTY_PER_ITEM = 20;
export const MAX_CART_LINES = 30;
export const MAX_TOPPINGS = 3;

export type NewCartItem = Partial<CartItem> & {
  productId: number;
  size: Size;
  name?: string;
  productName?: string;
};

export const clampQty = (qty: number) =>
  Math.max(1, Math.min(MAX_QTY_PER_ITEM, Math.floor(qty)));

export const cartItemKey = (
  productId: number,
  size: Size,
  toppingIds: number[],
) =>
  `${productId}-${size}-${[...toppingIds].sort((a, b) => a - b).join(",")}`;

/** Giá 1 phần theo api.md mục 4.1: giá gốc + phụ thu size + tổng giá topping. */
export const itemUnitPrice = (
  item: Pick<CartItem, "basePrice" | "sizeSurcharge" | "toppings">,
) =>
  (item.basePrice || 0) +
  (item.sizeSurcharge || 0) +
  (item.toppings || []).reduce((sum, topping) => sum + topping.price, 0);

export const calculateItemUnitPrice = itemUnitPrice;

export const itemLineTotal = (item: CartItem) =>
  itemUnitPrice(item) * (item.quantity ?? item.qty ?? 1);

export type CartState = {
  items: CartItem[];
  promoCode: string | null;
  discountAmount: number;
  /** Thêm món; trả về false nếu giỏ đã đủ số dòng tối đa. */
  addItem: (item: NewCartItem, quantity?: number) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  updateQty: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  setPromoCode: (code: string | null, discountAmount?: number) => void;
  loadSampleCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
};

// Selector dùng chung: tổng số ly (hiện trên biểu tượng giỏ) và tạm tính.
export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + (item.quantity ?? item.qty ?? 0), 0);

export const selectSubtotal = (state: CartState) =>
  state.items.reduce((sum, item) => sum + itemLineTotal(item), 0);

export const selectTotalItems = selectCartCount;
export const selectTotalAmount = selectSubtotal;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      discountAmount: 0,

      addItem: (item, quantity = 1) => {
        const toppingIds = (item.toppings || []).map((t) => t.id);
        const key =
          item.key ||
          item.id ||
          cartItemKey(item.productId, item.size, toppingIds);
        const name = item.productName || item.name || "Sản phẩm";
        const productName = name;
        const items = get().items;
        const existing = items.find((row) => row.key === key || row.id === key);
        if (existing) {
          const newQty = clampQty(existing.quantity + quantity);
          set({
            items: items.map((row) =>
              row.key === key || row.id === key
                ? {
                    ...row,
                    quantity: newQty,
                    qty: newQty,
                    lineTotal: itemUnitPrice(row) * newQty,
                  }
                : row,
            ),
          });
          return true;
        }
        if (items.length >= MAX_CART_LINES) return false;
        const initialQty = clampQty(
          quantity || item.quantity || item.qty || 1,
        );
        const newItem: CartItem = {
          ...item,
          key,
          id: key,
          name,
          productName,
          imageUrl: item.imageUrl || "/img/cappuccino.jpg",
          quantity: initialQty,
          qty: initialQty,
          size: item.size,
          sizeSurcharge: item.sizeSurcharge || (item.size === "M" ? 5000 : item.size === "L" ? 10000 : 0),
          toppings: item.toppings || [],
          toppingIds,
          basePrice: item.basePrice || 0,
          lineTotal: itemUnitPrice(item) * initialQty,
        };
        set({ items: [...items, newItem] });
        return true;
      },

      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.key !== key && item.id !== key)
              : state.items.map((item) => {
                  if (item.key === key || item.id === key) {
                    const newQty = clampQty(quantity);
                    return {
                      ...item,
                      quantity: newQty,
                      qty: newQty,
                      lineTotal: itemUnitPrice(item) * newQty,
                    };
                  }
                  return item;
                }),
        })),

      updateQty: (key, quantity) => get().setQuantity(key, quantity),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter(
            (item) => item.key !== key && item.id !== key,
          ),
        })),

      clearCart: () =>
        set({ items: [], promoCode: null, discountAmount: 0 }),

      setPromoCode: (promoCode, discountAmount = 0) =>
        set({ promoCode, discountAmount }),

      loadSampleCart: () => {
        const sampleItems: CartItem[] = MOCK_CART_ITEMS.map((item) => {
          const key =
            item.id ||
            cartItemKey(
              item.productId,
              item.size,
              item.toppings.map((t) => t.id),
            );
          return {
            key,
            id: key,
            productId: item.productId,
            name: item.productName,
            productName: item.productName,
            imageUrl: item.imageUrl || "/img/cappuccino.jpg",
            size: item.size,
            sizeSurcharge: item.sizeSurcharge || 0,
            toppings: item.toppings || [],
            toppingIds: item.toppings.map((t) => t.id),
            quantity: item.quantity,
            qty: item.quantity,
            basePrice: item.basePrice || 0,
            lineTotal:
              (item.basePrice +
                (item.sizeSurcharge || 0) +
                item.toppings.reduce((s, t) => s + t.price, 0)) *
              item.quantity,
            note: item.note,
          };
        });
        set({
          items: sampleItems,
          promoCode: "GIAM10",
          discountAmount: 10000,
        });
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce((sum, item) => sum + itemLineTotal(item), 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const discount = get().discountAmount || 0;
        return Math.max(0, subtotal - discount);
      },
    }),
    {
      name: "brewlite-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        promoCode: state.promoCode,
        discountAmount: state.discountAmount,
      }),
    },
  ),
);

/**
 * true khi giỏ hàng đã được nạp lại từ localStorage.
 */
export function useCartHydrated() {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
