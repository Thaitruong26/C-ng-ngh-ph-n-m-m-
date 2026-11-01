"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { getProducts } from "@/lib/api/products";
import { getDevelopmentProducts } from "@/lib/api/dev-products";
import type { Product } from "@/lib/api/types";
import { ProductImage } from "@/components/products/product-image";
import { ErrorState } from "@/components/ui/error-state";
import { ProductCardSkeleton } from "@/components/ui/loading-state";
import { useStockStore, checkIsAvailable } from "@/store/stock-store";

const formatVnd = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

// ─── Badges theo tên sản phẩm ─────────────────────────────────────────────────
const BADGES: Record<string, { label: string; bg: string; color: string }> = {
  "Cà phê sữa": { label: "BEST SELLER", bg: "#fff3cd", color: "#8a6200" },
  "Americano": { label: "Đậm vừa", bg: "#e6f4ea", color: "#2d6a4f" },
  "Cappuccino": { label: "Thủ công", bg: "#f0ecf8", color: "#5e35b1" },
  "Latte": { label: "Nhẹ nhàng", bg: "#fce4ec", color: "#b71c5d" },
  "Matcha đá xay": { label: "Mới", bg: "#e8f5e2", color: "#2d6a4f" },
};

// ─── Category icons ─────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  "Tất cả": "☕",
  "Cà phê": "☕",
  "Trà": "🍃",
  "Đá xay": "🧊",
};

// ─── Hero Banner ──────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Chào buổi sáng! ☀️" : hour < 18 ? "Chào buổi chiều! ☁️" : "Chào buổi tối! 🌙";
}

const emptySubscribe = () => () => {};

function HeroBanner() {
  const greeting = useSyncExternalStore(
    emptySubscribe,
    getGreeting,
    () => "Chào buổi sáng! ☀️",
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-6"
      style={{ background: "linear-gradient(135deg, #1a3d26 0%, #2d6a4f 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute -right-8 -top-8 size-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-10 right-10 size-28 rounded-full bg-white/5" />
      <div className="absolute top-4 right-28 size-8 rounded-full bg-white/10" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
            ☕ Rang mộc mỗi sáng
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-white">{greeting}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            Nạp năng lượng với cà phê thủ công thơm ngon từ nông trại Đắk Lắk.
          </p>
        </div>
        <div className="shrink-0">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-white/10 text-4xl shadow-inner">
            ☕
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <svg
          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--muted)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tìm đồ uống yêu thích..."
          className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
          style={{
            background: "var(--card)",
            border: "1.5px solid var(--line)",
            color: "var(--foreground)",
          }}
        />
      </div>
      {/* Filter button */}
      <button
        type="button"
        aria-label="Lọc nâng cao"
        className="flex size-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--card)", border: "1.5px solid var(--line)", color: "var(--forest)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
      </button>
    </div>
  );
}

// ─── Mobile Product Card ───────────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const badge = Object.entries(BADGES).find(([k]) => product.name.includes(k))?.[1];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex gap-3 rounded-2xl p-3 transition"
      style={{
        background: "var(--card)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--line)",
      }}
    >
      {/* Image */}
      <div
        className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl"
        style={{ background: "#eceee5" }}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
        />
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
          <span className="text-[10px] text-yellow-400">★</span>
          <span className="text-[10px] font-semibold text-white">4.{((product.id * 3) % 9) + 1}</span>
        </div>
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <span className="text-xs font-semibold text-white">Tạm hết</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-bold" style={{ color: "var(--forest)" }}>{product.name}</h2>
            {badge && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            {product.category === "Cà phê"
              ? "Hạt Robusta Đắk Lắk chọn lọc, rang mộc đậm vị, pha phin truyền thống."
              : product.category === "Trà"
                ? "Nguyên liệu tươi tự nhiên, vị thanh mát, không chất bảo quản."
                : "Kem tươi mát lạnh, hoà quyện cùng hương thơm đặc trưng."}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: "var(--forest)" }}>
            {formatVnd(product.price)} đ
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold group-hover:underline" style={{ color: "#31553e" }}>
            Xem chi tiết
            <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.25a.75.75 0 0 1 0 1.06l-4.5 4.25a.75.75 1 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Desktop Product Card ──────────────────────────────────────────────────────
function DesktopProductCard({ product }: { product: Product }) {
  const badge = Object.entries(BADGES).find(([k]) => product.name.includes(k))?.[1];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-[1.4rem] transition duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
        outlineColor: "var(--forest)",
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "#eceee5" }}>
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span
          className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "rgba(251,248,239,.95)", color: "#345541" }}
        >
          {product.category}
        </span>
        {badge && (
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: "rgba(0,0,0,.5)" }}
            >
              Tạm hết hàng
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold" style={{ color: "#21372b" }}>{product.name}</h2>
          <span className="shrink-0 text-sm font-bold" style={{ color: "var(--forest)" }}>
            {formatVnd(product.price)}đ
          </span>
        </div>
        <div
          className="mt-4 flex items-center justify-between border-t pt-3 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <span>{product.inStock ? "✓ Sẵn sàng phục vụ" : "Tạm hết hàng"}</span>
          <span className="font-semibold group-hover:underline" style={{ color: "#31553e" }}>Xem món →</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Trang Menu ───────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showFixtures, setShowFixtures] = useState(false);
  const availability = useStockStore((state) => state.availability);
  const hydrateStock = useStockStore((state) => state.hydrate);

  useEffect(() => {
    hydrateStock();
    const sync = () => hydrateStock();
    window.addEventListener("brewlite:stock-availability-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("brewlite:stock-availability-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [hydrateStock]);

  const query = useQuery({
    queryKey: ["products", { category, page: 1, limit: 20 }],
    queryFn: () => getProducts({ category: category || undefined, page: 1, limit: 20 }),
    enabled: !showFixtures,
  });

  const fixtureResult = useMemo(
    () => (showFixtures ? getDevelopmentProducts(category || undefined) : null),
    [category, showFixtures],
  );

  const result = fixtureResult ?? query.data;

  // Lọc theo search ở client (API không cần search cho Sprint 1)
  const products = useMemo(() => {
    const allProducts = (result?.data ?? []).filter((p) =>
      checkIsAvailable(p, availability),
    );
    return search.trim()
      ? allProducts.filter((p) =>
          p.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
      : allProducts;
  }, [result, search, availability]);

  const categories = useMemo(() => {
    const all = [
      ...(query.data?.data ?? []),
      ...(showFixtures ? getDevelopmentProducts().data : []),
    ].filter((p) => checkIsAvailable(p, availability));
    return Array.from(new Set(all.map((p) => p.category)));
  }, [query.data, showFixtures, availability]);

  const isLoading = !showFixtures && query.isPending;
  const isError = !showFixtures && query.isError;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 md:max-w-7xl md:px-10 md:py-8">

      {/* ── Hero ── */}
      <HeroBanner />

      {/* ── Search ── */}
      <div className="mt-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* ── Category pills ── */}
      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Lọc theo danh mục"
      >
        {["", ...categories].map((value) => {
          const label = value || "Tất cả";
          const icon = CATEGORY_ICONS[label] ?? "🍹";
          const active = category === value;
          return (
            <button
              key={value || "all"}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(value)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
              style={
                active
                  ? { background: "var(--forest)", color: "#fff", boxShadow: "0 2px 8px rgba(24,61,44,.2)" }
                  : { background: "var(--card)", color: "#42594a", border: "1px solid var(--line)" }
              }
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Section header ── */}
      <div className="mt-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-bold" style={{ color: "var(--forest)" }}>
          Món nổi bật hôm nay
          <span
            className="inline-block size-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
        </h1>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: "#e8f5e2", color: "#2d6a4f" }}
        >
          -10% Sinh viên
        </span>
      </div>

      {/* ── Badge dữ liệu mẫu ── */}
      {showFixtures && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{ background: "#fff7df", border: "1px solid #d2bb78", color: "#735f2d" }}
        >
          <span>⚠</span>
          <span>Dữ liệu mẫu xem trước · không lấy từ máy chủ</span>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="mt-4 space-y-3">
          <ErrorState
            message={
              query.error instanceof ApiError
                ? query.error.message
                : "Đã xảy ra lỗi khi tải thực đơn."
            }
            onRetry={() => void query.refetch()}
          />
          <div className="text-center">
            <button
              onClick={() => setShowFixtures(true)}
              className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-80"
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "#244532",
              }}
            >
              Xem dữ liệu mẫu theo tài liệu API
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {result && products.length === 0 && !isLoading && (
        <div
          className="mt-8 rounded-2xl border border-dashed px-6 py-12 text-center"
          style={{ borderColor: "var(--line)", background: "rgba(255,255,255,.6)" }}
        >
          <span className="text-3xl" aria-hidden="true">☕</span>
          <h2 className="mt-3 text-base font-semibold" style={{ color: "#21372b" }}>
            {search ? `Không tìm thấy "${search}"` : "Chưa có món trong danh mục này"}
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {search ? "Thử tìm với từ khóa khác." : "Thử chọn danh mục khác để khám phá thêm."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--forest)" }}
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      )}

      {/* ── Product list ── */}
      {result && products.length > 0 && (
        <>
          {/* Mobile: danh sách dọc */}
          <div className="mt-4 space-y-3 md:hidden">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Desktop: lưới 2–4 cột */}
          <div className="mt-6 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <DesktopProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
