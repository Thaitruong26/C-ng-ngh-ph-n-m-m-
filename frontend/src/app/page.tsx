import Link from "next/link";

export default function Home() {
  return (
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
  );
}
