import Link from "next/link";

/**
 * Trang chủ — Server Component (không "use client").
 * Tất cả hover effect dùng Tailwind CSS, không có JS event handler.
 */
export default function Home() {
  return (
<<<<<<< HEAD
    <section className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:gap-16 md:px-10 lg:py-20">

      {/* ── Left column: text content ─────────────────────── */}
      <div className="flex flex-col items-start">

        {/* Eye-brow */}
        <div className="mb-6 flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#183d2c]">
            BrewLite · Cà phê mỗi ngày
          </span>
        </div>

        {/* Headline — dùng Tailwind classes để màu không bị override */}
        <h1 className="text-[2.6rem] font-bold leading-[1.1] tracking-tight text-[#183d2c] sm:text-5xl lg:text-6xl">
          Một khoảng lặng,{" "}
          <br className="hidden sm:block" />
          <span
            className="text-[#183d2c]"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 700,
            }}
          >
            đúng vị bạn.
          </span>
        </h1>

        {/* Description */}
        <p className="mt-5 max-w-md text-base leading-7 text-[#66736a] sm:text-lg sm:leading-8">
          Chọn thức uống yêu thích từ thực đơn BrewLite. Đặt món gọn nhẹ,
          dành thêm thời gian cho điều bạn thích.
        </p>

        {/* CTA — text-white dùng Tailwind class, không dùng style={{ color }} */}
        <Link
          href="/menu"
          className="group mt-8 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-[#183d2c] px-8 text-base font-semibold text-white shadow-md transition-colors duration-200 hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
          style={{ color: "#fff" }}
        >
          Khám phá thực đơn
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            ↗
          </span>
        </Link>

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
          {[
            { icon: "☕", label: "100% Rang thủ công" },
            { icon: "🌿", label: "Nguyên liệu tươi" },
            { icon: "⚡", label: "Đặt trong 30 giây" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-sm" aria-hidden="true">{icon}</span>
              <span className="text-xs font-semibold text-[#66736a]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right column: image card ──────────────────────── */}
      <div className="relative mx-auto w-full max-w-lg">

        {/* Decorative tilted slab */}
        <div
          className="absolute -inset-3 rotate-[2deg] rounded-[2rem] bg-[#e6eadc]"
          aria-hidden="true"
        />

        {/* Main coffee photo */}
        <div className="relative overflow-hidden rounded-[1.7rem] shadow-xl">
          <ProductImage
            src="/img/ca-phe-sua.jpg"
            alt="Ly cà phê sữa BrewLite"
            className="aspect-[4/3] w-full object-cover"
          />
          {/* Subtle gradient vignette at bottom for caption legibility */}
          <div
            className="absolute inset-x-0 bottom-0 h-28 rounded-b-[1.7rem]"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,.45) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />
        </div>

        {/* Caption card — nền kem, chữ xanh, border rõ */}
        <div
          className="absolute -bottom-5 left-4 rounded-2xl border border-[#e5e7dc] bg-[#fbf8ef] px-5 py-3 shadow-lg sm:left-6"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#66736a]">
            Pha chậm, thưởng thức lâu
          </p>
          <p className="mt-0.5 font-semibold text-[#183d2c]">
            Chào ngày mới cùng BrewLite
          </p>
        </div>

        {/* Rating pill — top-right */}
        <div className="absolute -top-3 right-5 flex items-center gap-1.5 rounded-full border border-[#e5e7dc] bg-[#fbf8ef] px-3 py-1.5 shadow-md">
          <span className="text-sm text-amber-400" aria-hidden="true">★★★★★</span>
          <span className="text-xs font-bold text-[#183d2c]">4.9</span>
        </div>
      </div>

    </section>
=======
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <span className="font-bold text-xl tracking-tight text-amber-900">BrewLite</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/menu" className="hover:text-amber-800 transition-colors">Thực đơn</Link>
            <Link href="/checkout" className="hover:text-amber-800 transition-colors">Thanh toán</Link>
            <Link href="/orders/1042" className="hover:text-amber-800 transition-colors">Xác nhận đơn</Link>
            <Link href="/login" className="px-4 py-2 rounded-lg bg-amber-800 text-white hover:bg-amber-900 transition-colors">
              Đăng nhập
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-6">
          Sprint 0 Initialized
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900 max-w-2xl">
          Hương vị cà phê chuẩn vị, đặt món nhanh chóng với <span className="text-amber-800">BrewLite</span>
        </h1>
        <p className="mt-4 text-lg text-stone-600 max-w-xl">
          Hệ thống đặt món và tích điểm trực tuyến dành cho khách hàng và nhân viên quầy bar.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
          <Link
            href="/menu"
            className="px-6 py-3 rounded-xl bg-amber-800 text-white font-medium hover:bg-amber-900 transition-all shadow-sm"
          >
            Khám phá thực đơn
          </Link>
          <Link
            href="/checkout"
            className="px-6 py-3 rounded-xl bg-amber-100 text-amber-950 border border-amber-300 font-medium hover:bg-amber-200 transition-all shadow-sm"
          >
            Trang thanh toán (FE3)
          </Link>
          <Link
            href="/orders/1042"
            className="px-6 py-3 rounded-xl border border-stone-300 bg-white text-stone-700 font-medium hover:bg-stone-50 transition-all shadow-sm"
          >
            Trang xác nhận đơn #1042
          </Link>
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl border border-stone-300 bg-white text-stone-700 font-medium hover:bg-stone-50 transition-all shadow-sm"
          >
            Tài liệu API (Swagger)
          </a>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold text-stone-900">Đặt hàng tức thì</h3>
            <p className="text-sm text-stone-600 mt-1">Chọn size, topping và đặt món theo thời gian thực.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-2xl mb-2">🎁</div>
            <h3 className="font-semibold text-stone-900">Ưu đãi & Tích điểm</h3>
            <p className="text-sm text-stone-600 mt-1">Tự động tích lũy điểm thưởng và áp dụng mã giảm giá.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-stone-900">Quản lý Barista</h3>
            <p className="text-sm text-stone-600 mt-1">Giao diện tiếp nhận và cập nhật trạng thái đơn chế biến.</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        BrewLite Coffee System &copy; 2026. All rights reserved.
      </footer>
    </div>
>>>>>>> feature/khanhlinh-fe3-full
  );
}
