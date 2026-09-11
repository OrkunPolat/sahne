import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../lib/i18n";

type Step = "code" | "nick";

export function Join({
  step, code, busy, onCode, onNick,
}: { step: Step; code: string; busy: boolean; onCode: (code: string) => void; onNick: (nickname: string) => void }) {
  const { t } = useI18n();
  const [raw, setRaw] = useState(code);
  const [nick, setNick] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const digits = raw.replace(/\D/g, "").slice(0, 6);
  const formatted = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;

  const submitCode = (e: FormEvent) => { e.preventDefault(); if (digits.length === 6 && !busy) onCode(digits); };
  const submitNick = (e: FormEvent) => { e.preventDefault(); const n = nick.trim(); if (n && !busy) onNick(n); };

  return (
    <div className="p-center s-fade-in">
      <div className="p-stack" style={{ marginBottom: 8 }}>
        <h1 className="p-h1">{t("common.appName")}</h1>
        <p className="p-sub">{t("play.tagline")}</p>
      </div>

      {step === "code" ? (
        <form className="s-card s-card--glow p-card p-stack" onSubmit={submitCode}>
          <label className="p-label" htmlFor="code">{t("play.enterCode")}</label>
          <input
            ref={inputRef} id="code" className="s-input p-code" inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code"
            placeholder={t("play.codePlaceholder")} value={formatted} maxLength={7}
            onChange={(e) => setRaw(e.target.value)} enterKeyHint="go"
          />
          <button type="submit" className="s-btn s-btn--primary s-btn--lg p-btn-block" disabled={digits.length !== 6 || busy}>
            {busy ? t("common.loading") : t("play.continue")}
          </button>
        </form>
      ) : (
        <form className="s-card s-card--glow p-card p-stack" onSubmit={submitNick}>
          <div className="p-label">{t("play.enterCode")} · {code.slice(0, 3)} {code.slice(3)}</div>
          <label className="p-label" htmlFor="nick">{t("play.nickname")}</label>
          <input
            ref={inputRef} id="nick" className="s-input p-nick" placeholder={t("play.nicknamePlaceholder")} maxLength={20}
            value={nick} onChange={(e) => setNick(e.target.value)} autoComplete="nickname" enterKeyHint="go"
          />
          <button type="submit" className="s-btn s-btn--primary s-btn--lg p-btn-block" disabled={!nick.trim() || busy}>
            {busy ? t("common.loading") : t("common.join")}
          </button>
        </form>
      )}
    </div>
  );
}
