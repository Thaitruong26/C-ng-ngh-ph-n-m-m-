"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import { LoadingState } from "@/components/ui/loading-state";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
    if (password.length < 6) nextErrors.password = "Mật khẩu cần có ít nhất 6 ký tự.";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      const token = result.accessToken || (result as unknown as { access_token?: string }).access_token || "";
      setSession(token, result.user);
      const params = new URLSearchParams(window.location.search);
      const requestedPath = params.get("next");
      let destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/menu";
      if (result.user.role === "BARISTA" && (!requestedPath || requestedPath === "/menu")) {
        destination = "/barista";
      }
      router.replace(destination);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Không thể đăng nhập lúc này. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillBarista() {
    setEmail("barista@brewlite.com");
    setPassword("Barista@123");
    setErrors({});
    setFormError("");
  }

  function fillCustomer() {
    setEmail("demo@brewlite.com");
    setPassword("Demo@1234");
    setErrors({});
    setFormError("");
  }

  return <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 md:px-10">
    <div className="hidden rounded-[2rem] bg-[#e9f0e9] p-10 md:block"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">BrewLite · Chào mừng trở lại</p><h1 className="mt-5 text-4xl font-semibold leading-tight text-[#183d2c]">Khoảnh khắc cà phê tiếp theo đang chờ bạn.</h1><p className="mt-4 leading-7 text-[#66736a]">Đăng nhập để tiếp tục hành trình thưởng thức cùng BrewLite hoặc quản lý quầy pha chế.</p><div className="mt-9 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-[#183d2c] text-xl text-white">☕</span><span className="text-sm font-semibold text-[#31553e]">Thơm lành mỗi ngày</span></div></div>
    <div className="mx-auto w-full max-w-md">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Tài khoản BrewLite</p>
      <h2 className="mt-3 text-3xl font-semibold text-[#183d2c]">Đăng nhập</h2>
      <p className="mt-2 text-sm text-[#66736a]">Nhập thông tin tài khoản của bạn để tiếp tục.</p>
      {formError && <div role="alert" className="mt-5 rounded-xl border border-[#e8c5b5] bg-[#fff8f3] px-4 py-3 text-sm text-[#713d2a]">{formError}</div>}
      
      {/* Quick login demo accounts */}
      <div className="mt-5 rounded-xl border border-[#dce3da] bg-[#f8faf7] p-3 text-xs text-[#526356]">
        <p className="font-semibold text-[#254130] mb-1.5">Tài khoản demo mẫu:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fillBarista}
            className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            👨‍🍳 Barista: barista@brewlite.com
          </button>
          <button
            type="button"
            onClick={fillCustomer}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
          >
            👤 Khách: demo@brewlite.com
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#344b3c]">Email</label><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} className="w-full rounded-xl border border-[#d9e0d7] bg-white px-4 py-3 outline-none transition focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]" placeholder="ban@email.com" />{errors.email && <p id="email-error" className="mt-1.5 text-sm text-[#a1452d]">{errors.email}</p>}</div>
        <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#344b3c]">Mật khẩu</label><input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} className="w-full rounded-xl border border-[#d9e0d7] bg-white px-4 py-3 outline-none transition focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]" placeholder="Ít nhất 6 ký tự" />{errors.password && <p id="password-error" className="mt-1.5 text-sm text-[#a1452d]">{errors.password}</p>}</div>
        <button type="submit" disabled={submitting} className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#183d2c] px-5 font-semibold text-white transition hover:bg-[#24563e] disabled:cursor-wait disabled:opacity-70">{submitting ? "Đang đăng nhập..." : "Đăng nhập"}</button>
      </form>
      {submitting && <LoadingState label="Đang xác thực tài khoản..." />}
      <p className="mt-6 text-center text-sm text-[#66736a]">Chưa có tài khoản? <Link href="/register" className="font-semibold text-[#24563e] underline underline-offset-4">Tạo tài khoản</Link></p>
    </div>
  </section>;
}
