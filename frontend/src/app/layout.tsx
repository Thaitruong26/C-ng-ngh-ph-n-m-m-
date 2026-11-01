import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartBar } from "@/components/layout/cart-bar";

/* ── Google Fonts qua next/font (zero layout shift, tự host) ── */
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BrewLite — Cà phê, theo cách của bạn",
    template: "%s | BrewLite",
  },
  description: "Khám phá thực đơn BrewLite và đặt món yêu thích.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme="light"
      style={{ colorScheme: "light" }}
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased bg-[#f5f7f2] text-[#21372b]">
        <AppProviders>
          <SiteHeader />
          {/* pb-32 trên mobile để tránh bị CartBar + BottomNav che nội dung */}
          <main className="flex-1 pb-32 md:pb-0">{children}</main>
          <SiteFooter />
          {/* Chỉ hiện trên mobile (md:hidden bên trong component) */}
          <CartBar />
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
