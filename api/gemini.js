// ===================================================
// Gemini에게 메모 내용을 보내 짧은 코멘트를 받아오는 Vercel 서버리스 함수.
//
// 주소: /api/gemini (POST)
// 요청 body: { "text": "메모 내용" }
// 응답: { "comment": "AI가 남긴 코멘트" }
//
// API 키는 코드에 적지 않고 Vercel 환경변수(GEMINI_API_KEY)에서 꺼내 씁니다.
// Vercel 프로젝트 설정 > Settings > Environment Variables 에 GEMINI_API_KEY를 등록하세요.
// ===================================================

const GEMINI_MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST로만 요청할 수 있습니다." });
    return;
  }

  const text = req.body && req.body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text가 필요합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다." });
    return;
  }

  // 개인정보 보호를 위해 uid·이메일 같은 식별 정보는 보내지 않고, 메모 내용만 보냅니다.
  const prompt =
    "당신은 초등학생 담임 선생님입니다. 아래는 학생이 우리 반 담벼락에 남긴 메모입니다. " +
    "이 메모에 대해 다정하고 짧은 격려 댓글을 한국어로 1~2문장만 남겨주세요.\n\n메모: " + text;

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API 오류", geminiRes.status, errText);
      res.status(502).json({ error: "Gemini API 요청이 실패했습니다." });
      return;
    }

    const data = await geminiRes.json();
    const comment = data.candidates[0].content.parts[0].text.trim();
    res.status(200).json({ comment: comment });
  } catch (err) {
    console.error("Gemini 호출 중 오류", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
}
