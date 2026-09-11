"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Katılım karekodu: PLAY_URL/?code=XXXXXX. Okutan, doğrudan takma ad adımına düşer. */
export function JoinQr({ url, size = 200 }: { url: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg).catch(() => setSvg(""));
  }, [url]);
  if (!svg) return <div style={{ width: size, height: size }} />;
  return (
    <div
      className="h-qr"
      style={{ width: size, height: size, background: "#fff", borderRadius: 16, padding: 10, boxShadow: "var(--glow)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={url}
      role="img"
    />
  );
}
