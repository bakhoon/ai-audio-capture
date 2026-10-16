import { useState } from "react";
import { clearKeys, saveKeys } from "./keys.js";

export default function Settings({ keys, onDone, onDemo, canClose }) {
  const [soniox, setSoniox] = useState(keys.soniox);
  const [anthropic, setAnthropic] = useState(keys.anthropic);
  const [googleClientId, setGoogleClientId] = useState(keys.googleClientId);
  const [msg, setMsg] = useState("");

  function save(e) {
    e.preventDefault();
    const next = { soniox: soniox.trim(), anthropic: anthropic.trim(), googleClientId: googleClientId.trim() };
    if (!next.soniox) {
      setMsg("Soniox 키는 꼭 필요해요.");
      return;
    }
    if (!saveKeys(next)) {
      setMsg("저장에 실패했어요. 사생활 보호 모드인지 확인해 주세요.");
      return;
    }
    onDone(next);
  }

  function wipe() {
    clearKeys();
    setSoniox("");
    setAnthropic("");
    setGoogleClientId("");
    onDone({ soniox: "", anthropic: "", googleClientId: "" }, true);
  }

  return (
    <div className="app settings">
      <header className="top">
        <h1>설정</h1>
        {canClose && (
          <button type="button" className="btn small" onClick={() => onDone(keys)}>닫기</button>
        )}
      </header>

      <form className="panel" onSubmit={save}>
        <p className="note">
          키는 이 폰의 이 앱 안에만 저장돼요. 서버로 보내지 않아서, 다른 사람이 같은 주소로 들어와도 쓸 수 없어요.
        </p>

        <label className="field">
          <span>Soniox API 키 (필수)</span>
          <input type="password" autoComplete="off" value={soniox} onChange={(e) => setSoniox(e.target.value)} placeholder="console.soniox.com 에서 발급" />
        </label>

        <label className="field">
          <span>Anthropic API 키 (요약용)</span>
          <input type="password" autoComplete="off" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} placeholder="없으면 데모 요약" />
        </label>

        <label className="field">
          <span>Google 클라이언트 ID (Drive 저장용)</span>
          <input type="text" autoComplete="off" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="없으면 이 폰에만 저장" />
        </label>

        {msg && <p className="error" role="alert">{msg}</p>}

        <button type="submit" className="btn primary">저장하고 시작</button>
        {!keys.soniox && (
          <button type="button" className="btn small" onClick={onDemo}>키 없이 데모로 둘러보기</button>
        )}
        {(keys.soniox || keys.anthropic || keys.googleClientId) && (
          <button type="button" className="btn danger" onClick={wipe}>이 폰에서 키 모두 지우기</button>
        )}
      </form>
    </div>
  );
}
