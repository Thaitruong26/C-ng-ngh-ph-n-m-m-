"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth-store";

function AuthEvents() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();

    const sync = () => {
      hydrate();
      // Xóa và làm mới cache query để tài khoản mới không dùng lại cache cũ của tài khoản trước
      queryClient.clear();
      queryClient.invalidateQueries();
    };

    const unauthorized = () => {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    };

    window.addEventListener("brewlite:auth-change", sync);
    window.addEventListener("brewlite:unauthorized", unauthorized);

    return () => {
      window.removeEventListener("brewlite:auth-change", sync);
      window.removeEventListener("brewlite:unauthorized", unauthorized);
    };
  }, [hydrate, queryClient, router]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <AuthEvents />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}
