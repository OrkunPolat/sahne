# Servis sözleşmesi (Faz 1)

Tek servis: `services/realtime` (Node, port `REALTIME_PORT`=4100). Hem REST hem WS aynı porttan.
Host app (Next.js, :3000) ve play app (Vite, :5173) yalnızca bu servisle konuşur. DB'ye sadece realtime dokunur.

## REST (JSON, CORS: *)

- `POST /api/sessions` body `{ title, themeDefault?, localeDefault? }` → `201 { id, code, hostSecret, title, themeDefault, localeDefault }`
- `GET /api/sessions/:id` header `x-host-secret` → `{ meta: SessionMeta, slides: Slide[], phase }`
- `PUT /api/sessions/:id/slides` header `x-host-secret`, body `{ slides: Slide[] }` (tam liste, idx'e göre sıralanır) → `200 { slides }`. Oturum `live` ise 409.
- `GET /api/sessions/:id/results` header `x-host-secret` → `{ slides: [{ slide, tally }], leaderboard }`
- `GET /api/join/:code` → `200 { title, themeDefault, localeDefault, phase }` veya 404 (play ekranı kod doğrulamak için)
- `GET /health` → `{ ok: true }`

Hatalar: `{ error: { code, message } }`, 401 (secret), 404, 409, 422 (zod).

## WS

`ws://host:4100/ws`. Mesajlar `@sahne/protocol` `ClientMessage` / `ServerMessage`, JSON string.

Bağlantı yaşam döngüsü:
- İlk mesaj `host:join` ya da `player:join` / `player:resume` olmalı; aksi halde `error invalid` + kapat.
- Başarılı host:join → `state:snapshot` (tam durum). Katılımcı değişince `participants:update`.
- Başarılı player:join → `player:joined {participantId, token, ...}` ardından `state:snapshot`. Token, aynı cihazın yeniden bağlanması için (localStorage'da).
- `player:resume {code, token}` → varsa aynı participant'ı bağlar, `state:snapshot`.
- Her `state:snapshot.serverNow` istemcinin saat farkı hesabı için (offset = serverNow - Date.now()).

Host aksiyonları `@sahne/engine` `transition()` ile doğrulanır; geçersizse `error invalid`.
- `host:start` / `host:next` → yeni slayt: herkese `slide:open`.
- `host:lock` → `slide:phase locked`.
- `host:reveal` → herkese `slide:reveal`; her katılımcıya kendi `you` alanı ile, host'a `you` olmadan. Puanlı slaytta cevap vermeyenlerin serisi sıfırlanır.
- Süre dolunca sunucu otomatik `lock` yapar (timeLimitS + 500ms tolerans). Otomatik reveal YOK; host tetikler.
- `host:end` → `session:ended {podium: top 3}`; ardından bağlantılar kapatılabilir.

Katılımcı:
- `player:answer` yalnızca `slidePhase === "open"` ve slide id güncel slayt ise; aksi `error not_open`. Aynı slayta ikinci cevap `error already_answered`. Değer `validateAnswerForSlide` ile doğrulanır. Başarılıysa `answer:ack`.
- Insight modunda her cevaptan sonra host'a `slide:tally` (canlı). Game modunda host'a yalnızca `answeredCount` güncellemesi (`slide:tally` tally alanı gönderilir ama host UI reveal öncesi sadece sayacı gösterir).

Canlı durum bellekte (Map<code, LiveSession>); `answer` ve skorlar Postgres'e yazılır (async, hata olsa oturum devam eder). Sunucu yeniden başlarsa canlı oturumlar kaybolur (deneme kapsamı).

MAX_PARTICIPANTS = 50 → `error session_full`. Takma ad benzersiz (case-insensitive) → `error nickname_taken`.

# Dalga 2 eklemeleri (2026-09-11)

## REST
- `POST /api/demo` body `{ locale? }` → `201` create-session cevabıyla aynı + `isDemo: true`. Sunucu 3 örnek slayt yükler (MC game, word_cloud, true_false). Kayıt yok. Demo oturumlar 2 saat sonra silinir.
- `POST /api/ai/generate` body `AiBody` (session gerekmez) → `{ slides }`. Anasayfa "konudan oturum" için: host bunu çağırır, sonra `POST /api/sessions` + `PUT slides`.
- `POST /api/sessions/:id/import-pdf` header `x-host-secret`, body `{ pdfBase64, count?, locale?, mode? }` (≤ 8 MB) → `{ slides }`. pdf-parse ile metin çıkarılır, AI'ya "bu metinden soru üret" olarak gider. AI kapalıysa 503.
- `PUT /api/sessions/:id/settings` header `x-host-secret`, body `{ teams?: Team[], seriesKey?: string|null }` → `{ meta }`. Oturum live iken 409.
- `GET /api/sessions/:id/series` header `x-host-secret` → `{ seriesKey, sessions: number, leaderboard: [{ deviceId, nickname, totalScore, sessionsPlayed, wins }] }`. Aynı `seriesKey`'li, bitmiş oturumlarda `device_id` bazında toplam. deviceId'siz katılımcılar dışarıda.
- `GET /api/public/:token/results` → `{ title, endedAt, slides: [{ slide, tally }], leaderboard, teams }`. Host secret gerekmez. Token oturum bitince üretilir (`session:ended.publicToken`).
- `GET /api/join/:code` cevabına `teams: Team[]` eklendi (katılımcı takım seçsin).

## WS
- `player:join` `deviceId?`, `teamId?` alır. Takım modu açıkken teamId yoksa `pickTeam` ile atanır; geçersiz teamId → `error bad_team`. `player:joined.teamId` döner.
- `player:react {emoji}`: kişi başı 2/sn; aşınca `error rate_limited` (bağlantı kapanmaz). Herkese `reaction {emoji, participantId}`.
- qa slaydı: `player:answer {kind:"question"}` aynı katılımcıdan birden çok kabul (`allowsMultipleAnswers`), kişi başı en fazla 5. `player:upvote {slideId, questionId}` toggle. Her değişimde **herkese** `slide:tally {kind:"questions"}` (katılımcılar oylayabilsin diye; diğer slayt tiplerinde tally sadece host'a).
- `slide:reveal` → `fastest` (puanlı slaytta en hızlı 3 doğru), `teams` (takım modu açıksa).
- `session:ended` → `teams`, `publicToken`.

## DB
- `sessions`: `teams jsonb default '[]'`, `series_key text null`, `public_token text null unique`, `is_demo bool default false`, `ended_at timestamptz null`.
- `participants`: `device_id text null`, `team_id text null`.
- `answers.id` qa için soru kimliği olarak kullanılır. Upvote'lar bellekte (deneme).
