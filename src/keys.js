// API 키는 이 폰(이 홈 화면 앱)의 저장 공간에만 둬요. 서버로 보내지 않아요.
// 다른 사람이 같은 주소로 들어와도 그 사람 폰엔 키가 없어서 쓸 수 없어요.

const KEY = "ai-audio-capture-keys";

export function loadKeys() {
  try {
    const raw = localStorage.getItem(KEY);
    const k = raw ? JSON.parse(raw) : {};
    return { soniox: k.soniox || "", anthropic: k.anthropic || "", googleClientId: k.googleClientId || "" };
  } catch {
    return { soniox: "", anthropic: "", googleClientId: "" };
  }
}

export function saveKeys(keys) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
    return true;
  } catch {
    return false;
  }
}

export function clearKeys() {
  try { localStorage.removeItem(KEY); } catch {}
}
