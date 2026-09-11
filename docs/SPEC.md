# Sahne — Canlı Etkileşim Platformu (Mentimeter × Kahoot)

> Durum: DENEME projesi. Hedef ölçek: oturum başına 50 katılımcı.
> "Sahne" geçici ad; değiştirilebilir.

## 1. Konsept

Tek oturumda iki mod:

| Mod | Esin | Kimlik | Puan | Anonim |
|---|---|---|---|---|
| **Insight** | Mentimeter | Fikir/veri toplama | Yok | Evet |
| **Game** | Kahoot | Yarışma | Süre + doğruluk + seri | Takma ad |

Her slayt kendi modunu taşır. Host bir Q&A slaydından sonraki slaytta puanlı quiz'e geçebilir. Rakiplerde bu iki dünya ayrı ürün; burada tek akış.

Farklılaştırıcılar:
- Slayt bazlı mod anahtarı.
- Tek katılımcı istemcisi, slayt moduna göre şekil değiştiren "kumanda".
- Açık uçlu / word cloud cevaplarından AI ile anında quiz sorusu üretip aynı oturumda oynatma (Faz 4, opsiyonel).
- Çok dilli ve çok temalı çekirdek (TR/EN başlangıç, 4 tema).
- Kurumsal değil, "premium etkinlik" hissi.

## 2. Kapsam (deneme)

Var:
- Host: oturum oluştur, slayt ekle/sırala, canlı sun, ilerlet, sonuç gör, oturumu bitir.
- Katılımcı: kod + takma ad, cevapla, kendi puanını/sırasını gör.
- Slayt tipleri (ilk set): Çoktan seçmeli (insight+game), Doğru/Yanlış (game), Word cloud (insight), Açık uçlu (insight), Ölçek 1–5 (insight), Başlık/içerik slaydı (statik).
- Game motoru: süre sayacı, puanlama, soru arası liderlik tablosu, final podyum.
- 4 tema, host ve katılımcı bağımsız seçer.
- TR/EN arayüz.
- Oturum sonucu JSON/CSV export (basit).

Yok (bilinçli):
- Hesap/auth (host için tarayıcıda saklanan gizli host anahtarı yeter).
- Ödeme, plan, limit.
- Slayt import (PPT/PDF).
- Takım modu.
- Self-paced / ödev modu.
- AI üretim (Faz 4'e ertelendi, deneme kapsamı dışı).

## 3. Mimari

```
apps/
  host/          Next.js (App Router) — creator + büyük ekran sunum
  play/          Vite + React — katılımcı kumandası (Kahoot.it deseni: ayrı, hafif, hesapsız)
packages/
  ui/            tasarım sistemi: token'lar, temalar, primitives
  i18n/          sözlükler + tip güvenli t()
  protocol/      paylaşılan Zod şemaları: slayt tipleri, ws mesajları, puanlama
  engine/        saf fonksiyonlar: puan hesabı, liderlik, durum makinesi (test edilebilir)
services/
  realtime/      Node ws sunucusu (oturum durumu bellekte + Postgres'e yazım)
```

Neden ayrı `play` uygulaması: Kahoot.it'in yaptığı gibi. Katılımcı bundle'ı küçük kalır, Next.js runtime'ı taşımaz, 4G'de anında açılır.

Neden kendi ws sunucusu (Supabase Realtime yerine): oturum durumu (hangi slayt açık, sayaç ne zaman başladı, cevaplar kilitli mi) tek otoritede olmalı. Host tarayıcısı kapansa da oturum yaşar; tekrar bağlanınca kaldığı yerden devam eder. 50 kişi için tek process yeter.

Veri: Postgres (Supabase yerel de olabilir, sadece DB olarak). ORM: Drizzle.

## 4. Veri modeli

```
session        id, code(6 hane), host_secret, title, theme_default, locale_default, state(lobby|live|ended), current_slide_idx, created_at
slide          id, session_id, idx, type, mode(insight|game), payload(jsonb), time_limit_s, points
participant    id, session_id, nickname, avatar_seed, joined_at, last_seen
answer         id, slide_id, participant_id, value(jsonb), answered_at, ms_taken, is_correct, points_awarded
```

Puanlama (engine, saf):
```
base = 1000 (slayt payload override edebilir)
speed_factor = 1 - (ms_taken / time_limit_ms) / 2     -> [0.5, 1]
points = correct ? round(base * speed_factor) : 0
streak_bonus = min(streak, 5) * 100  (streak ≥ 2 ise)
```

## 5. Realtime protokol (ws, JSON, Zod ile doğrulanır)

Client → Server:
- `host:join {code, host_secret}`
- `host:next`, `host:prev`, `host:reveal`, `host:end`
- `player:join {code, nickname}` → `player:joined {participant_id, token}`
- `player:answer {slide_id, value}`

Server → Client:
- `state:snapshot` (bağlanınca / yeniden bağlanınca tam durum)
- `slide:open {slide, started_at, time_limit_s}` (sayaç sunucu zamanıyla, istemci fark hesaplar)
- `slide:tally {counts | cloud | distribution}` (insight modunda canlı, game modunda sadece reveal sonrası)
- `slide:reveal {correct, leaderboard_top10, your: {points, rank, delta}}`
- `session:ended {podium}`

Durum makinesi (session): `lobby → live(slide_open → slide_locked → slide_revealed)* → ended`.

## 6. Tasarım dili — "premium"

İlke: az renk, çok boşluk, büyük tipografi, yumuşak hareket. Kahoot'un parlak çocuksu tonu yok; Mentimeter'ın kurumsal düzlüğü de yok.

Tipografi: display için geometrik/serifsiz güçlü bir aile (ör. "Instrument Sans" veya "Bricolage Grotesque"), metin için okunaklı sans; büyük ekranda soru ≥ 56px.

Hareket: slayt geçişi 300ms ease-out; sayaç dairesel ve yumuşak; liderlik tablosunda sıra değişimi FLIP animasyonu; podyum sıralı yükselme. Reduced-motion'a saygı.

Yüzeyler: hafif cam (backdrop-blur) paneller, ince 1px kenarlıklar, düşük opaklıkta gradyan zemin. Gölge yerine ışık.

### Temalar (4)

Tümü token bazlı; tema = token seti. Host ve katılımcı bağımsız seçer, localStorage'da kalır, oturumun varsayılanı override edilebilir.

| id | Zemin | Vurgu | Metin | His |
|---|---|---|---|---|
| `midnight-gold` | gece laciverti | altın/amber | fildişi | lüks etkinlik |
| `obsidian-neon` | siyaha yakın | elektrik mavisi/mor | soğuk beyaz | teknoloji/oyun |
| `cream-forest` | açık krem | orman yeşili + bakır | koyu antrasit | editorial, sakin |
| `burgundy-champagne` | derin bordo | şampanya | sıcak beyaz | otel lüksü |

Token grupları: `bg.base / bg.elevated / bg.glass`, `fg.primary / fg.muted`, `accent / accent.soft`, `border`, `success / danger`, `answer.1..4` (aşağıda), `radius`, `shadow-glow`.

### Cevap butonları (renk + şekil, zarif)

Kahoot'un 4 şekil desenini korur: ▲ ◆ ● ■. Renkler her temada palete uydurulmuş, mat/derin sürümler; parlak doygun değil. Her temada kontrast testinden geçer: `packages/ui/src/contrast.test.ts` (etiket 4.5:1, buton/zemin 3:1, butonlar arası ton farkı ≥40°). Renk körlüğü için şekil her zaman görünür.

## 7. i18n

- `packages/i18n`: `tr.json`, `en.json`; anahtarlar tip güvenli (`t('lobby.join_cta')`).
- Dil: tarayıcıdan algıla → kullanıcı seçimi override → localStorage.
- Oturum içeriği (soru metinleri) host'un yazdığı gibi, çevrilmez. Arayüz çevrilir.
- Sayı/tarih formatı `Intl`.
- Yeni dil = tek JSON dosyası.

## 8. Fazlar (bağımlılık sırası, süre tahmini yok)

1. ✅ **Temel** — monorepo, `protocol` + `engine` (puanlama testli), Postgres şema, ws sunucusu, host'ta oturum oluştur + katılımcı katıl + çoktan seçmeli tek slayt uçtan uca. Tema/dil altyapısı bu fazda kurulur, tek tema ile.
2. ✅ **Slayt seti + game döngüsü** — kalan slayt tipleri, sayaç, reveal, liderlik, podyum, yeniden bağlanma.
3. ✅ **Premium cila** — 4 tema tamam, hareket, tipografi, büyük ekran/telefon ayrımı, kontrast testleri, EN sözlük tamam.
4. **Opsiyonel** — export, AI'dan quiz üretimi, takım modu.

## 9. Açık kararlar

- Font seçimi (lisans: Google Fonts yeterli).
- Oturum kodu: 6 hane sayısal mı, 4 harf mi? (telefonda sayısal klavye avantajı → 6 hane).
- Katılımcı avatarı: seed'den üretilen soyut şekil (kütüphanesiz) önerisi.
- Deploy: deneme olduğundan yerel; ileride tek VPS + Docker Compose.
