"use client";

// ===========================================================
// components/admin/email/use-api.ts — Load a JSON admin endpoint into state,
// with reload(). A null url loads nothing (e.g. while a param is unknown).
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/admin/email/api";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let live = true;
    api<T>(url).then((res) => {
      if (!live) return;
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.message);
      }
    });
    return () => {
      live = false;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading: data === null && error === null, reload, setData };
}
