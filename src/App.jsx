import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SonioxClient } from "@soniox/speech-to-text-web";
import { buildLines, clock, linesToText, DEMO_SCRIPT, demoTokens } from "./captions.js";
import { loadGoogle, requestToken, hasValidToken, saveToDrive } from "./drive.js";
import { loadKeys } from "./keys.js";
import { summarize } from "./summarize.js";
import Settings from "./Settings.jsx";

const SUMMARY_EVERY_MS = 2 * 60 * 1000; // 2분마다 자동 요약 + 저장
const MIN_NEW_CHARS = 60; // 새로 쌓인 말이 이보다 적으면 요약은 건너뛰고 저장만
const LOCAL_KEY = "mokjang-caption-backup";

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function sessionTitle() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd} 한eng AI record (${clock(d.getTime())})`;
}

export default function App() {
  const [keys, setKeys] = useState(loadKeys);
  const [demoMode, setDemoMode] = useState(false);
  const [showSettings, setShowSettings] = useState(() => !loadKeys().soniox);
  const config = {
    soniox: Boolean(keys.soniox),
    claude: Boolean(keys.anthropic),
    googleClientId: keys.googleClientId || null,
    loaded: true,
    keys,
  };
  const [rec, setRec] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [nonFinal, setNonFinal] = useState([]);
  const [ver, setVer] = useState(0);
  const [summary, setSummary] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { where: 'drive' | 'local', at, needsLogin }
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [atBottom, setAtBottom] = useState(true);

  const finalRef = useRef([]);
  const clientRef = useRef(null);
  const demoTimerRef = useRef(null);
  const wakeRef = useRef(null);
  const listRef = useRef(null);
  const titleRef = useRef(null);
  const fileIdRef = useRef(null);
  const lastLenRef = useRef(0);
  const nextSummaryRef = useRef(0);
  const startedAtRef = useRef(0);
  const elapsedBaseRef = useRef(0);
  const linesRef = useRef([]);
  const summaryRef = useRef([]);
  const configRef = useRef(config);
  const busyRef = useRef(false);

  const lines = useMemo(() => buildLines([...finalRef.current, ...nonFinal]), [ver, nonFinal]);
  linesRef.current = lines;
  summaryRef.current = summary;
  configRef.current = config;

  // Google 클라이언트 ID 가 있으면 로그인 도구 미리 불러오기
  useEffect(() => {
    if (keys.googleClientId) loadGoogle(keys.googleClientId);
  }, [keys.googleClientId]);

  // 1초마다 시계 갱신 + 2분 되면 자동 요약
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (rec && nextSummaryRef.current && t >= nextSummaryRef.current) {
        nextSummaryRef.current = t + SUMMARY_EVERY_MS;
        runSummary(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [rec]);

  // 새 줄이 오면, 맨 아래를 보고 있을 때만 따라 내려감
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [lines, atBottom]);

  // 화면 꺼짐 방지: 다른 앱 갔다 오면 다시 요청
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === "visible" && rec) {
        try { wakeRef.current = await navigator.wakeLock?.request("screen"); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [rec]);

  useEffect(() => () => {
    clientRef.current?.cancel();
    clearInterval(demoTimerRef.current);
  }, []);

  function buildDocument() {
    const s = summaryRef.current.length ? summaryRef.current.map((b) => `- ${b}`).join("\n") : "(아직 요약 없음)";
    return `${titleRef.current}\n\n[요약]\n${s}\n\n[전체 자막]\n${linesToText(linesRef.current)}\n`;
  }

  const doSave = useCallback(async () => {
    if (!titleRef.current) return;
    const content = buildDocument();
    const at = Date.now();
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ title: titleRef.current, content, at })); } catch {}

    if (!configRef.current.googleClientId) {
      setSaveStatus({ where: "local", at });
      return;
    }
    if (!hasValidToken()) {
      setSaveStatus({ where: "local", at, needsLogin: true });
      return;
    }
    try {
      fileIdRef.current = await saveToDrive({ fileId: fileIdRef.current, name: titleRef.current, content });
      setSaveStatus({ where: "drive", at });
    } catch {
      setSaveStatus({ where: "local", at, needsLogin: !hasValidToken() });
    }
  }, []);

  async function runSummary(auto) {
    if (busyRef.current) return;
    const text = linesToText(linesRef.current);
    if (!text.trim()) return;
    if (auto && text.length - lastLenRef.current < MIN_NEW_CHARS) {
      await doSave();
      return;
    }
    busyRef.current = true;
    setSummarizing(true);
    try {
      let bullets;
      if (configRef.current.claude) {
        bullets = await summarize({
          apiKey: configRef.current.keys.anthropic,
          transcript: text,
          previousSummary: summaryRef.current,
        });
      } else {
        bullets = [
          "데모 요약이에요. Claude 키를 넣으면 실제 요약이 나와요.",
          ...linesRef.current.slice(-3).map((l) => (l.ko || l.text).slice(0, 40)),
        ];
      }
      lastLenRef.current = text.length;
      setSummary(bullets);
      summaryRef.current = bullets;
    } catch (e) {
      setError(`요약 실패: ${e.message}`);
    } finally {
      busyRef.current = false;
      setSummarizing(false);
      await doSave();
    }
  }

  function onTokens(tokens) {
    const t = Date.now();
    const finals = [];
    const partials = [];
    for (const tok of tokens) (tok.is_final ? finals : partials).push({ ...tok, _at: t });
    if (finals.length) {
      finalRef.current.push(...finals);
      setVer((v) => v + 1);
    }
    setNonFinal(partials);
  }

  async function start() {
    setError("");
    if (!config.soniox && !demoMode) {
      setShowSettings(true);
      return;
    }
    if (!titleRef.current) titleRef.current = sessionTitle();

    // Drive 로그인 팝업은 버튼을 누른 순간에만 열 수 있어서 여기서 요청
    if (config.googleClientId && !hasValidToken()) {
      requestToken().then(() => doSave()).catch(() => {});
    }

    try { wakeRef.current = await navigator.wakeLock?.request("screen"); } catch {}

    startedAtRef.current = Date.now();
    nextSummaryRef.current = Date.now() + SUMMARY_EVERY_MS;

    if (!config.soniox) {
      let i = Math.floor(linesRef.current.length) % DEMO_SCRIPT.length;
      demoTimerRef.current = setInterval(() => {
        onTokens(demoTokens(DEMO_SCRIPT[i % DEMO_SCRIPT.length]));
        i++;
      }, 3000);
      setRec(true);
      return;
    }

    setConnecting(true);
    const client = new SonioxClient({
      apiKey: config.keys.soniox, // 이 폰에 저장된 내 키
      keepAlive: true,
    });
    clientRef.current = client;
    client.start({
      model: "stt-rt-v5",
      languageHints: ["ko", "en"],
      enableLanguageIdentification: true,
      enableEndpointDetection: true,
      translation: { type: "one_way", target_language: "ko" },
      onStarted: () => setConnecting(false),
      onPartialResult: (res) => onTokens(res.tokens || []),
      onFinished: () => {
        setNonFinal([]);
        runSummary(false);
      },
      onError: (status, message) => {
        setError(status === "get_user_media_failed" ? "마이크 권한을 허용해 주세요." : `연결 오류: ${message || status}`);
        setConnecting(false);
        finishLocal();
      },
    });
    setRec(true);
  }

  function finishLocal() {
    if (startedAtRef.current) elapsedBaseRef.current += Date.now() - startedAtRef.current;
    startedAtRef.current = 0;
    nextSummaryRef.current = 0;
    try { wakeRef.current?.release(); } catch {}
    setRec(false);
  }

  function stop() {
    if (clientRef.current) {
      clientRef.current.stop(); // 마지막 결과까지 받은 뒤 onFinished 에서 요약 + 저장
      clientRef.current = null;
    } else {
      clearInterval(demoTimerRef.current);
      runSummary(false);
    }
    finishLocal();
  }

  async function saveNow() {
    if (config.googleClientId && !hasValidToken()) {
      try { await requestToken(); } catch {}
    }
    await doSave();
  }

  function onScroll(e) {
    const el = e.currentTarget;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }

  function jumpToLatest() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }

  const elapsed = elapsedBaseRef.current + (rec && startedAtRef.current ? now - startedAtRef.current : 0);
  const untilNext = rec && nextSummaryRef.current ? Math.max(0, nextSummaryRef.current - now) : 0;

  let saveLabel = "아직 저장 안 됨";
  if (saveStatus) {
    const when = clock(saveStatus.at);
    if (saveStatus.where === "drive") saveLabel = `Drive에 자동 저장됨 · ${when}`;
    else if (saveStatus.needsLogin) saveLabel = `이 폰에만 저장됨 · Drive 연결 필요`;
    else saveLabel = `이 폰에 저장됨 · ${when}`;
  }

  const demo = !config.soniox;

  if (showSettings) {
    return (
      <Settings
        keys={keys}
        canClose={Boolean(keys.soniox) || demoMode}
        onDone={(next) => {
          setKeys(next);
          setDemoMode(false);
          setShowSettings(!next.soniox);
        }}
        onDemo={() => {
          setDemoMode(true);
          setShowSettings(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="top">
        <h1>한eng AI record</h1>
        <div className="header-right">
          <div className={`status ${rec ? "on" : ""}`}>
            <span className="dot" />
            <span>{connecting ? "연결 중..." : rec ? `듣는 중 ${fmtElapsed(elapsed)}` : "멈춤"}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="설정" onClick={() => setShowSettings(true)} disabled={rec}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
      </header>

      {demo && <p className="demo">데모 모드: 키를 넣기 전이라 가짜 대화가 흘러가요.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="panel captions">
        <div className="panel-head">
          <h2>실시간 자막</h2>
          <span className="meta">한국어 · English 자동 인식</span>
        </div>

        <div className="list" ref={listRef} onScroll={onScroll} aria-live="polite">
          {lines.length === 0 && <p className="empty">시작을 누르면 여기에 자막이 나와요.</p>}
          {lines.map((l) => (
            <div key={l.id} className={`line ${l.partial ? "partial" : ""}`}>
              <span className="time">{clock(l.at)}</span>
              <p className="text">{l.text}</p>
              {l.needsKo && l.ko && <p className="ko">{l.ko}</p>}
            </div>
          ))}
        </div>

        {!atBottom && (
          <button type="button" className="latest" onClick={jumpToLatest}>
            최신으로
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></svg>
          </button>
        )}

        <div className="controls">
          <button type="button" className="btn start" onClick={start} disabled={rec || connecting || !config.loaded}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
            시작
          </button>
          <button type="button" className="btn stop" onClick={stop} disabled={!rec}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            멈춤
          </button>
        </div>
      </section>

      <section className="panel summary">
        <div className="panel-head">
          <h2>요약</h2>
          <span className="meta">{rec ? `2분마다 자동 · 다음 ${fmtElapsed(untilNext)}` : "자동 요약 멈춤"}</span>
        </div>

        <div className="summary-body">
          {summary.length === 0 ? (
            <p className="empty">2분마다 지금까지의 대화를 정리해 드려요.</p>
          ) : (
            <ul>{summary.map((b, i) => <li key={i}>{b}</li>)}</ul>
          )}
        </div>

        <button type="button" className="btn primary" onClick={() => runSummary(false)} disabled={summarizing || lines.length === 0}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h7" /></svg>
          {summarizing ? "요약 중..." : "바로 요약하기"}
        </button>

        <div className="save-row">
          <div className={`save-status ${saveStatus?.where === "drive" ? "ok" : ""}`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8l6 10-4 7H6l-4-7z" /><path d="M8 3l6 10" /><path d="M2 13h14" /></svg>
            <span>{saveLabel}</span>
          </div>
          <button type="button" className="btn small" onClick={saveNow} disabled={lines.length === 0}>지금 저장</button>
        </div>
      </section>
    </div>
  );
}
