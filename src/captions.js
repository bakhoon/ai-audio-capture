// Soniox 토큰을 화면에 보여줄 "줄" 단위로 묶는 로직
//
// - 말이 끊기면 Soniox 가 "<end>" 토큰을 보내요 -> 거기서 줄을 나눔
// - translation_status:
//     "original"    = 번역될 말 (영어)      -> 줄의 원문
//     "none"        = 번역 안 되는 말 (한국어) -> 줄의 원문
//     "translation" = 번역 결과 (한국어)    -> 가장 최근 영어 줄에 붙임

export function buildLines(tokens) {
  const lines = [];
  let cur = null;
  let lastEnglish = null;

  for (const t of tokens) {
    if (!t.text) continue;
    if (t.text === "<end>") {
      cur = null;
      continue;
    }
    if (t.translation_status === "translation") {
      const target = lastEnglish || cur;
      if (target) target.ko += t.text;
      continue;
    }
    if (!cur) {
      cur = { id: lines.length, at: t._at || Date.now(), text: "", ko: "", needsKo: false, partial: false };
      lines.push(cur);
    }
    cur.text += t.text;
    if (!t.is_final) cur.partial = true;
    if (t.translation_status === "original") {
      cur.needsKo = true;
      lastEnglish = cur;
    }
  }

  return lines
    .map((l) => ({ ...l, text: l.text.trim(), ko: l.ko.trim() }))
    .filter((l) => l.text);
}

export function clock(ms) {
  return new Date(ms).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

export function linesToText(lines) {
  return lines
    .filter((l) => !l.partial)
    .map((l) => `[${clock(l.at)}] ${l.text}${l.needsKo && l.ko ? `\n          (번역) ${l.ko}` : ""}`)
    .join("\n");
}

// 키 없이 화면을 시험해볼 때 흘러가는 가짜 대화
export const DEMO_SCRIPT = [
  { text: "이번 주 말씀 어떻게 들으셨어요?" },
  { text: "I really liked the part about waiting. It's been hard for me lately.", ko: "기다림에 대한 부분이 정말 좋았어요. 요즘 저한테 그게 좀 힘들었거든요." },
  { text: "저도요, 회사 일 때문에 기도를 잘 못했어요." },
  { text: "Maybe we can pray for each other this week?", ko: "이번 주에 서로를 위해 기도하면 어떨까요?" },
  { text: "좋아요. 기도 제목은 단톡방에 올려주세요." },
  { text: "Where are we meeting next week?", ko: "다음 주에는 어디서 모여요?" },
  { text: "다음 주는 저희 집에서 7시 반에 모일게요." },
  { text: "Sounds good. I'll bring some snacks.", ko: "좋아요. 제가 간식 좀 가져갈게요." },
];

export function demoTokens(item) {
  const now = Date.now();
  const toks = [];
  if (item.ko) {
    toks.push({ text: item.text, is_final: true, translation_status: "original", _at: now });
    toks.push({ text: item.ko, is_final: true, translation_status: "translation", _at: now });
  } else {
    toks.push({ text: item.text, is_final: true, translation_status: "none", _at: now });
  }
  toks.push({ text: "<end>", is_final: true, _at: now });
  return toks;
}
