import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI 개입 서버리스 함수
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. API 키 확인 (사용자가 설정한 ajou_tetris 또는 기본값 확인)
  const apiKey = process.env.ajou_tetris || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const { score, level, lines, eventType } = req.body;

  try {
    // 2. 모델 설정 (사용자 요청에 따라 가장 안정적인 경로 명칭 사용)
    const model = genAI.getGenerativeModel({ 
      model: "models/gemini-1.5-flash" 
    });

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

다음 JSON 형식으로만 응답하세요. 마크다운 기호를 포함하지 마세요.
{
  "message": "플레이어에게 전달할 위트 있는 한국어 메시지 (한 문장)",
  "action": "FOG | REVERSE | BLESSING_GHOST | SABOTAGE | NORMAL"
}

작업 코드(action) 설명:
- FOG: 15초간 화면 흐림
- REVERSE: 15초간 좌우 조작 반전
- BLESSING_GHOST: 다음 3번의 블록을 'I' 블록으로 변환
- SABOTAGE: 다음 5번의 블록을 S/Z 블록으로 변환
- NORMAL: 대사만 전달`;

    // 3. 안정적인 요청 및 응답 처리
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 추출 및 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonResponse = JSON.parse(jsonMatch[0]);
        return res.status(200).json(jsonResponse);
      } catch (parseError) {
        console.error("JSON 파싱 에러:", parseError);
      }
    }

    // 파싱 실패 시 기본 응답 구조 반환
    return res.status(200).json({ 
      message: text.substring(0, 100), 
      action: "NORMAL" 
    });

  } catch (error) {
    console.error("Gemini API 상세 에러:", error);
    return res.status(500).json({ 
      error: "AI 응답 생성 중 오류가 발생했습니다.",
      details: error.message 
    });
  }
}
