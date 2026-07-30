"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook guard: kiểm tra user hiện tại có role === "ADMIN" hay không.
 *   - Loading spinner trong lúc chờ /api/auth/me
 *   - Không auth → redirect /login
 *   - Auth nhưng không phải ADMIN → redirect /login (kèm error)
 *
 * Dùng ở đầu mỗi admin page hoặc trong admin layout để gate một lần.
 */
export function useAdminGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        const data = await res.json();

        if (cancelled) return;

        if (!data?.user) {
          router.replace("/login");
          return;
        }
        if (data.user.role !== "ADMIN") {
          router.replace("/login?error=admin_only");
          return;
        }
        setIsAdmin(true);
      } catch {
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { ready, isAdmin };
}
