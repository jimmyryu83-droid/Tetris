import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.ajou_tetris);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { score, level, lines, eventType } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let eventContext = "";
    if (eventType === 'intervention') {
      eventContext = "플레이어의 레벨이 오르거나 점수가 대폭 상승했습니다. 당신은 게임에 개입하여 '축복'을 내리거나 '시련'을 주기로 결정했습니다.";
    } else if (eventType === 'sabotage') {
      eventContext = "플레이어가 너무 잘해서 당신이 질투를 느낍니다. 방해를 선언하세요.";
    } else {
      eventContext = "일반적인 게임 상황입니다. 위트 있는 해설을 해주세요.";
    }

    const prompt = `당신은 테트리스 게임의 감시자이자 변덕스러운 AI입니다.
현재 상황: 점수 ${score}, 레벨 ${level}, 지운 줄 ${lines}.
컨텍스트: ${eventContext}

다음 JSON 형식으로만 응답하세요:
{
  "message": "플레이어에게 전달할 위트 있는 한국어 메시지 (한 문장)",
  "action": "아래 작업 코드 중 하나"
}

작업 코드(action):
- "FOG": 15초간 화면을 안개로 가리는 시련 (난이도 상승)
- "REVERSE": 15초간 좌우 조작을 반대로 바꾸는 시련 (혼란 유발)
- "BLESSING_GHOST": 다음 3번의 블록을 모두 'I' 블록으로 바꿔주는 축복 (위기 탈출)
- "SABOTAGE": 다음 5번의 블록을 S나 Z 블록으로만 내보내는 방해
- "NORMAL": 아무 물리적 변화 없이 대사만 전달

상황이 좋을수록 시련("FOG", "REVERSE", "SABOTAGE")을 줄 확률이 높고, 상황이 나쁘거나 레벨업 직후라면 축복("BLESSING_GHOST")을 줄 확률이 있습니다.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 추출 (Gemini가 마크다운 블록 등을 포함할 수 있으므로)
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      const jsonResponse = JSON.parse(jsonMatch[0]);
      return res.status(200).json(jsonResponse);
    }

    return res.status(200).json({ message: text, action: "NORMAL" });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "AI 응답을 가져오는 중 오류가 발생했습니다." });
  }
}
