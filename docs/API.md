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
