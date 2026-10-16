// Claude 로 2분 요약 (브라우저에서 내 키로 직접 호출)

const MODEL = "claude-haiku-5-5";

const SYSTEM = `너는 교회 소그룹(목장) 모임을 실시간 자막으로 따라가는 사람을 돕는 요약 도우미야.
대화는 한국어와 영어가 섞여 있고, 영어 줄에는 (번역) 이 붙어 있을 수 있어.
규칙:
- 한국어로만 써.
- "- " 로 시작하는 짧은 줄 3~6개로, 지금까지 무슨 이야기가 오갔는지 시간 순서대로 정리해.
- 기도 제목, 정해진 일정(날짜, 시간, 장소), 누가 무엇을 하기로 했는지는 빠뜨리지 마.
- 대화에 없는 내용은 지어내지 마. 잘 안 들린 부분은 추측하지 말고 넘어가.
- 줄 목록 외에 다른 말은 쓰지 마.`;

export async function summarize({ apiKey, transcript, previousSummary }) {
  // 긴 모임에서도 비용이 안 커지게 최근 대화만 보내고, 앞부분은 이전 요약으로 대신함
  const recent = transcript.slice(-12000);
  const prev = previousSummary.length ? previousSummary.map((b) => `- ${b}`).join("\n") : "(아직 없음)";

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `지금까지의 요약:\n${prev}\n\n최근 대화 기록:\n${recent}\n\n위 둘을 합쳐서 지금 시점의 전체 요약을 다시 써줘.`,
        },
      ],
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Claude 오류 ${r.status}`);

  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}
