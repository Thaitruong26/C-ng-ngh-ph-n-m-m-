"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore, selectTotalItems } from "@/store/cart-store";

const NAV_LINKS = [
  { href: "/menu",   label: "Thực đơn" },
  { href: "/cart",   label: "Giỏ hàng", hasCart: true },
  { href: "/orders", label: "Lịch sử" },
];

/**
 * SiteHeader — Client Component (cần usePathname, useAuthStore, useCartStore).
 * Tất cả màu sắc dùng Tailwind utility classes để đảm bảo tương phản cao
 * và không bị override bởi CSS base rules.
 */
function SiteHeaderContent() {
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const hydrate = useAuthStore((s) => s.hydrate);
  const totalItems = useCartStore(selectTotalItems);
  const pathname   = usePathname();

  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7dc] bg-[#f5f7f2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-10">

        {/* ── Logo ─────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="BrewLite — Trang chủ"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
        >
          {/* Vòng tròn xanh — text-[#fbf8ef] đảm bảo icon sáng trên nền đậm */}
          <span
            className="grid size-9 place-items-center rounded-full bg-[#183d2c] text-lg text-[#fbf8ef]"
            aria-hidden="true"
          >
            ☕
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-[#183d2c]">BrewLite</p>
            <p className="hidden text-[10px] font-medium text-[#66736a] sm:block">
              Campus Artisan Coffee
            </p>
          </div>
        </Link>

        {/* ── Desktop nav ──────────────────────────────────── */}
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map(({ href, label, hasCart }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#e9f0e9] font-semibold text-[#183d2c]"
                    : "text-[#4a6155] hover:bg-[#eef2ec] hover:text-[#183d2c]",
                ].join(" ")}
              >
                {label}
                {hasCart && totalItems > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#183d2c] text-[9px] font-bold text-white">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Auth ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {user?.role === "BARISTA" && (
            <Link
              href="/barista"
              className={[
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm",
                pathname === "/barista"
                  ? "bg-amber-700 text-white shadow-inner"
                  : "bg-amber-100 text-amber-900 hover:bg-amber-200",
              ].join(" ")}
            >
              <span>👨‍🍳</span> Quầy Barista
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-[#344b3c] sm:block">
                {user.fullName.split(" ").pop()}
              </span>
              {/* Avatar button — text-white đảm bảo chữ trắng trên nền xanh */}
              <button
                onClick={signOut}
                className="flex size-9 items-center justify-center rounded-full bg-[#183d2c] text-sm font-bold text-white transition-colors hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]"
                aria-label="Đăng xuất"
                title={`Đăng xuất (${user.email})`}
              >
                {user.fullName.charAt(0).toUpperCase()}
              </button>
            </div>
          ) : (
            /* Nút Đăng nhập — text-white Tailwind class đảm bảo chữ trắng */
            <Link
              href="/login"
              className="rounded-full bg-[#183d2c] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]"
              style={{ color: "#fff" }}
            >
              Đăng nhập
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}


export function SiteHeader() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-30 border-b border-[#e5e7dc] bg-[#f5f7f2]/95 backdrop-blur-md h-16" />
      }
    >
      <SiteHeaderContent />
    </Suspense>
  );
}
