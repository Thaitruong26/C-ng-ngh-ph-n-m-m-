"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth-store";

function AuthEvents() {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();

    const sync = () => hydrate();

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
  }, [hydrate, router]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
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