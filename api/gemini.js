/**
 * Gemini AI 개입 서버리스 함수 (Soft Error Handling 적용)
 * 지속적인 API 연결 이슈를 진단하기 위해 에러 발생 시 상세 메시지를 게임 대사로 전달합니다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. API 키 확인 (ajoutetris 우선 확인)
  const apiKey = process.env.ajoutetris || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ 
      message: "AI 응원 대기 중... (Error: API 키가 설정되지 않음)", 
      action: "NORMAL" 
    });
  }

  const { score, level, lines, eventType } = req.body;

  // 2. 테트리스 전용 페르소나 및 프롬프트 설정 (기존 로직 유지)
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

  // 3. 구글 API 직접 호출 경로 (사용자 요청: v1beta + gemini-1.5-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // 사용자의 'Soft Error Handling' 전략 적용: 에러 발생 시 게임 내 대사로 전달
    if (!response.ok) {
      console.error("Google Server Response Trace:", JSON.stringify(data, null, 2));
      return res.status(200).json({ 
        message: `AI 연결 대기 중... (Error: ${data.error?.message || 'API 요청 실패'})`, 
        action: "NORMAL" 
      });
    }

    // 결과 텍스트 추출
    const text = data.candidates[0].content.parts[0].text;

    // JSON 추출 및 파싱 로직
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
    console.error("Gemini API 직접 호출 에러:", error);
    return res.status(200).json({ 
      message: "AI 코치가 휴식 중입니다. (기다림이 필요할 수 있습니다)", 
      action: "NORMAL" 
    });
  }
}
