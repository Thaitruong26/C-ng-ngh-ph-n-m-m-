import Link from "next/link";
import { ProductImage } from "@/components/products/product-image";

/**
 * Trang chủ — Server Component (không "use client").
 * Tất cả hover effect dùng Tailwind CSS, không có JS event handler.
 */
export default function Home() {
  return (
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

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/menu"
            className="group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-[#183d2c] px-8 text-base font-semibold text-white shadow-md transition-colors duration-200 hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
          >
            Khám phá thực đơn
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              ↗
            </span>
          </Link>
          <Link
            href="/checkout"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-6 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
          >
            Thanh toán (FE3)
          </Link>
        </div>

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
  );
}
