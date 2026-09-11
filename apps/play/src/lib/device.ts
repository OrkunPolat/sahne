/** Cihaz kimliği: bir kez üretilir, localStorage'da kalır (seri tablosu ve aynı-cihaz eşlemesi). */
const KEY = "sahne.device";
const ALPHABET = "useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict";

function random16(): string {
  const bytes = new Uint8Array(16);
  try { crypto.getRandomValues(bytes); } catch { for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256); }
  let out = "";
  for (let i = 0; i < 16; i++) out += ALPHABET[(bytes[i] ?? 0) & 63];
  return out;
}

export function getDeviceId(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && /^[A-Za-z0-9_-]{16}$/.test(v)) return v;
    const id = random16();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return random16();
  }
}
