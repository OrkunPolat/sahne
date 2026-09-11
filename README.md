# Sahne

Mentimeter × Kahoot birleşimi canlı etkileşim platformu. Deneme projesi; oturum başına 50 katılımcı.

- Spec: [docs/SPEC.md](docs/SPEC.md) · Servis sözleşmesi: [docs/API.md](docs/API.md)

## Çalıştırma

```bash
cp .env.example .env
pnpm install
pnpm db:up        # Postgres (docker, :5433)
pnpm db:push      # şema
pnpm dev          # realtime :4100, host :3000, play :5173
```

Host: http://localhost:3000 → oturum oluştur → slayt ekle → Sun.
Katılımcı: http://localhost:5173 → 6 haneli kod + takma ad.

## Yapı

```
apps/host        Next.js — düzenleyici + büyük ekran
apps/play        Vite React — katılımcı kumandası
services/realtime Node ws + REST + Postgres (tek otorite)
packages/protocol Zod şemaları (slayt, mesaj, durum)
packages/engine   saf puanlama / tally / liderlik / durum makinesi (testli)
packages/i18n     TR/EN sözlük, tip güvenli t()
packages/ui       token'lar, 4 tema, primitives
```

## Deploy

| Parça | Nerede | Not |
|---|---|---|
| host | https://sahne-host.vercel.app | Vercel proje `sahne-host`, root `apps/host` |
| play | https://sahne-play.vercel.app | Vercel proje `sahne-play`, `apps/play/dist` statik |
| realtime | henüz yok | WebSocket + Postgres gerektirir, Vercel'de çalışmaz. `services/realtime/Dockerfile` + `fly.toml` hazır. |

Realtime'ı barındırdıktan sonra deploy edilmiş istemcilere adresi ver:
`https://sahne-host.vercel.app/?api=https://REALTIME_ADRESI` ve `https://sahne-play.vercel.app/?api=https://REALTIME_ADRESI`
(adres localStorage'da kalır; WebSocket adresi otomatik türetilir). Kalıcı çözüm: Vercel env `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` (host) ve `VITE_API_URL` ile yeniden build.

Yeniden deploy:
```bash
pnpm --filter @sahne/play build && cp apps/play/vercel.json apps/play/dist/ && (cd apps/play/dist && vercel deploy --prod --yes)
vercel deploy --prod --yes   # repo kökünden, sahne-host
```

AI slayt üretimi için realtime ortamına `ANTHROPIC_API_KEY` (isteğe bağlı `ANTHROPIC_MODEL`, varsayılan claude-sonnet-5).
