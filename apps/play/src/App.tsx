import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AnswerValue, ClientMessage, ServerMessage, SessionSnapshot, Slide, SlidePhase, ThemeId } from "@sahne/protocol";
import { useI18n } from "./lib/i18n";
import { API_URL, wsEndpoint } from "./lib/env";
import { readAnsweredSlide, readPlayer, writeAnsweredSlide, writePlayer, type StoredPlayer } from "./lib/storage";
import { adoptSessionTheme } from "./lib/theme";
import { useSocket } from "./lib/useSocket";
import { TopBar, useThemeState } from "./components/TopBar";
import { Toast, type ToastData } from "./components/Toast";
import { ConnChip } from "./components/ConnChip";
import { Join } from "./screens/Join";
import { Lobby } from "./screens/Lobby";
import { SlideScreen } from "./screens/SlideScreen";
import { Reveal, type You } from "./screens/Reveal";
import { Ended } from "./screens/Ended";

interface Live { slide: Slide; idx: number; startedAt: number; phase: SlidePhase }
type ErrorCode = Extract<ServerMessage, { t: "error" }>["code"];

export function App() {
  const { t } = useI18n();
  const [theme, setTheme] = useThemeState();

  // --- join flow ---
  const [player, setPlayer] = useState<StoredPlayer | null>(() => readPlayer());
  const [joinStep, setJoinStep] = useState<"code" | "nick">("code");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  // --- live state ---
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [avatarSeed, setAvatarSeed] = useState<string>(() => readPlayer()?.participantId ?? "");
  const [live, setLive] = useState<Live | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [answeredSlideId, setAnsweredSlideId] = useState<string | null>(() => readAnsweredSlide());
  const [sentValue, setSentValue] = useState<AnswerValue | null>(null);
  const [reveal, setReveal] = useState<{ slideId: string; you: You | undefined } | null>(null);
  const [lastYou, setLastYou] = useState<You | null>(null);
  const [ended, setEnded] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, kind: ToastData["kind"] = "error") => {
    setToast({ id: Date.now(), text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const persistPlayer = useCallback((p: StoredPlayer | null) => { writePlayer(p); setPlayer(p); }, []);
  const markAnswered = useCallback((id: string | null) => { writeAnsweredSlide(id); setAnsweredSlideId(id); }, []);

  const leave = useCallback(() => {
    persistPlayer(null); markAnswered(null);
    setSnapshot(null); setLive(null); setReveal(null); setLastYou(null); setEnded(false); setSentValue(null);
    setJoinStep("code");
  }, [persistPlayer, markAnswered]);

  // --- inbound ---
  const playerRef = useRef(player);
  playerRef.current = player;

  const onMessage = useCallback((m: ServerMessage) => {
    switch (m.t) {
      case "player:joined": {
        const p = playerRef.current;
        persistPlayer({ code: p?.code ?? "", nickname: m.nickname, token: m.token, participantId: m.participantId });
        setAvatarSeed(m.avatarSeed);
        break;
      }
      case "state:snapshot": {
        const s = m.snapshot;
        setSnapshot(s);
        setClockOffset(s.serverNow - Date.now());
        if (adoptSessionTheme(s.meta.themeDefault)) setTheme(s.meta.themeDefault);
        const me = s.participants.find((p) => p.id === playerRef.current?.participantId);
        if (me) setAvatarSeed(me.avatarSeed);
        if (s.phase === "ended") { setEnded(true); setLive(null); break; }
        const slide = s.currentSlideIdx >= 0 ? s.slides[s.currentSlideIdx] : undefined;
        if (s.phase === "live" && slide && s.slidePhase && s.slideStartedAt !== null) {
          setLive((prev) => {
            if (prev?.slide.id !== slide.id) { setReveal(null); setSentValue(null); }
            return { slide, idx: s.currentSlideIdx, startedAt: s.slideStartedAt!, phase: s.slidePhase! };
          });
          setAnsweredSlideId((prev) => (prev === slide.id ? prev : (writeAnsweredSlide(null), null)));
        } else {
          setLive(null);
        }
        break;
      }
      case "slide:open": {
        setClockOffset(m.serverNow - Date.now());
        setLive({ slide: m.slide, idx: m.idx, startedAt: m.startedAt, phase: "open" });
        setReveal(null); setSentValue(null); markAnswered(null);
        break;
      }
      case "slide:phase":
        setLive((l) => (l ? { ...l, phase: m.phase } : l));
        break;
      case "answer:ack":
        markAnswered(m.slideId);
        break;
      case "slide:reveal": {
        setLive((l) => (l ? { ...l, phase: "revealed" } : l));
        setReveal({ slideId: m.slideId, you: m.you });
        if (m.you) setLastYou(m.you);
        break;
      }
      case "slide:tally":
      case "participants:update":
        // Katılımcı ekranında kullanılmıyor (host'a yönelik); sessizce yok say.
        break;
      case "session:ended": {
        setEnded(true);
        const me = m.podium.find((e) => e.participantId === playerRef.current?.participantId);
        if (me) setLastYou((y) => ({ correct: null, pointsAwarded: 0, streak: 0, rankDelta: 0, ...(y ?? {}), score: me.score, rank: me.rank }));
        break;
      }
      case "error":
        // handleErrorRef üzerinden yönlendirilir (aşağıda).
        break;
    }
  }, [persistPlayer, markAnswered, setTheme]);

  const handleError = (code: ErrorCode) => {
    showToast(t(`error.${code}`));
    switch (code) {
      case "kicked":
      case "session_ended":
      case "bad_code":
        leave();
        break;
      case "nickname_taken":
      case "session_full": {
        const p = playerRef.current;
        persistPlayer(null);
        if (p) { setJoinCode(p.code); setJoinStep("nick"); }
        break;
      }
      case "invalid": {
        // Resume başarısız (token geçersiz) → temiz başla.
        const p = playerRef.current;
        if (p?.token) { persistPlayer(null); setJoinCode(p.code); setJoinStep("nick"); }
        break;
      }
      case "not_open":
        markAnswered(null); setSentValue(null);
        break;
      case "already_answered":
        if (live) markAnswered(live.slide.id);
        break;
      default:
        break;
    }
  };
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const hello = useCallback((): ClientMessage | null => {
    const p = playerRef.current;
    if (!p) return null;
    if (p.token) return { t: "player:resume", code: p.code, token: p.token };
    return { t: "player:join", code: p.code, nickname: p.nickname };
  }, []);

  const { status, send } = useSocket({
    url: wsEndpoint(),
    enabled: player !== null && !ended,
    hello,
    onMessage: useCallback((m: ServerMessage) => (m.t === "error" ? handleErrorRef.current(m.code) : onMessage(m)), [onMessage]),
    onInvalid: (raw) => console.warn("[play] unrecognized message", raw),
  });

  // --- join handlers ---
  // Karekod ile geliş: ?code=XXXXXX → doğrula ve takma ad adımına geç.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("code");
    if (q && /^\d{6}$/.test(q)) {
      history.replaceState(null, "", location.pathname);
      void onCode(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCode = async (code: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/join/${code}`);
      if (res.status === 404) { showToast(t("error.bad_code")); return; }
      if (!res.ok) { showToast(t("error.invalid")); return; }
      const info = (await res.json()) as { title?: string; themeDefault?: ThemeId; localeDefault?: string; phase?: string };
      if (info.phase === "ended") { showToast(t("error.session_ended")); return; }
      if (info.themeDefault && adoptSessionTheme(info.themeDefault)) setTheme(info.themeDefault);
      setJoinCode(code); setJoinStep("nick");
    } catch {
      showToast(t("play.networkError"));
    } finally { setBusy(false); }
  };
  const onNick = (nickname: string) => {
    markAnswered(null);
    persistPlayer({ code: joinCode, nickname, token: null, participantId: null });
  };

  const onAnswer = (value: AnswerValue) => {
    if (!live) return;
    setSentValue(value);
    markAnswered(live.slide.id);
    if (!send({ t: "player:answer", slideId: live.slide.id, value })) {
      markAnswered(null); setSentValue(null);
      showToast(t("play.networkError"));
    }
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // --- screen selection ---
  let screen: ReactNode;
  const nickname = player?.nickname ?? "";
  const seed = avatarSeed || player?.participantId || nickname;

  if (!player) {
    screen = <Join step={joinStep} code={joinCode} busy={busy} onCode={onCode} onNick={onNick} />;
  } else if (ended) {
    const me = snapshot?.participants.find((p) => p.id === player.participantId);
    const computedRank = me && snapshot ? [...snapshot.participants].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id) + 1 : null;
    screen = <Ended nickname={nickname} avatarSeed={seed} rank={lastYou?.rank ?? computedRank} score={lastYou?.score ?? me?.score ?? null} onLeave={leave} />;
  } else if (live && reveal && reveal.slideId === live.slide.id) {
    screen = <Reveal slide={live.slide} you={reveal.you} />;
  } else if (live) {
    screen = (
      <SlideScreen
        key={live.slide.id}
        slide={live.slide}
        startedAt={live.startedAt}
        clockOffset={clockOffset}
        locked={live.phase !== "open"}
        sent={answeredSlideId === live.slide.id}
        sentValue={sentValue}
        onAnswer={onAnswer}
      />
    );
  } else if (!snapshot) {
    screen = <div className="p-center"><div className="p-state"><div className="p-sub">{t("common.loading")}</div></div></div>;
  } else {
    screen = <Lobby nickname={nickname} avatarSeed={seed} title={snapshot.meta.title} />;
  }

  return (
    <div className="p-root">
      <TopBar theme={theme} onTheme={setTheme} />
      <main className="p-main">{screen}</main>
      <ConnChip status={status} />
      <Toast toast={toast} />
    </div>
  );
}
