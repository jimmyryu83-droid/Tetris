import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { score, level, lines, eventType } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let prompt = "";
    if (eventType === 'anti-gravity') {
      prompt = `현재 테트리스 게임 중 '안티그래비티(반중력)' 모드가 시작되었습니다! 블록이 위로 솟구칩니다. 플레이어에게 "중력이 사라졌습니다! 위를 조심하세요!" 같은 위트 있는 경고와 응원 멘트를 한국어로 한 문장만 짧고 강렬하게 생성해줘.`;
    } else if (eventType === 'sabotage') {
      prompt = `현재 테트리스 게임 점수가 ${score}점으로 매우 높습니다. 당신은 질투가 많은 AI입니다. 플레이어를 방해하겠다고 선언하며 "흥, 너무 쉬워 보이는데? 이건 어때?" 같은 도전적이고 위트 있는 멘트를 한국어로 한 문장만 생성해줘.`;
    } else {
      prompt = `현재 테트리스 게임 상태: 점수 ${score}, 레벨 ${level}, 지운 줄 ${lines}. 게임 중인 플레이어에게 짧고 유머러스한 한국어 응원이나 해설 멘트를 한 문장만 생성해줘.`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ message: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "AI 응답을 가져오는 중 오류가 발생했습니다." });
  }
}
