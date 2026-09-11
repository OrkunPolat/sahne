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
