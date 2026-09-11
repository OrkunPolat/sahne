"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDemo } from "@/lib/demo";
import { useLocale, useT } from "@/lib/providers";

/** Paylaşılabilir demo bağlantısı: açılınca demo oturumu oluşturur ve sunuma geçer. */
export default function DemoPage() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    startDemo(locale).then((path) => { if (alive) router.replace(path); }).catch(() => { if (alive) setError(t("host.demoFailed")); });
    return () => { alive = false; };
    // Dil değişince yeniden tetiklenmesin: yalnızca ilk yüklemede.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="p-center">
      <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
        {error ? (
          <>
            <p className="h-error" role="alert">{error}</p>
            <Link className="s-btn" href="/">{t("common.appName")}</Link>
          </>
        ) : (
          <>
            <span className="h-spinner h-spinner--lg" aria-hidden />
            <p className="s-muted">{t("host.demoStarting")}</p>
          </>
        )}
      </div>
    </main>
  );
}
