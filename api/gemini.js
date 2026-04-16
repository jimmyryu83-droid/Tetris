/**
 * Gemini AI 개입 서버리스 함수 (모델 동적 발견 전략)
 * 404 에러를 원천 차단하기 위해 사용 가능한 모델 리스트를 먼저 조회한 후 최적의 모델로 응답합니다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. API 키 확인 (ajoutetris 우선 확인)
  const apiKey = process.env.ajoutetris || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      message: "AI 엔진 예열 중... (준비가 더 필요합니다)",
      action: "NORMAL"
    });
  }

  try {
    // [STEP 1] 사용 가능한 모델 리스트 동적 조회 (Troubleshooting 전략)
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();

    // 'generateContent'를 지원하는 모델 중 가장 최신(flash -> pro 순)을 가급적 찾습니다.
    const models = listData.models || [];
    let availableModel = models.find(m => m.name.includes('gemini-1.5-flash'))?.name
      || models.find(m => m.supportedGenerationMethods.includes('generateContent'))?.name;

    // 만약 리스트 조회가 실패하거나 모델을 못 찾으면 하드코딩된 기본값 사용
    if (!availableModel) {
      availableModel = "models/gemini-pro";
    }

    const { score, level, lines, eventType } = req.body;

    // [STEP 2] 테트리스 전용 페르소나 및 프롬프트 설정 (기존 게임 로직 유지)
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

    // [STEP 3] 발견된 모델로 즉시 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/${availableModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // 사용자의 'Failsafe' 전략 적용: 503 과부하 또는 기타 에러 시 기본 응답 반환
    if (!response.ok) {
      console.error("API Error Trace:", JSON.stringify(data, null, 2));

      let fallbackMessage = "중력이 요동치고 있습니다! 하늘을 조심하세요!";
      if (response.status === 503) {
        fallbackMessage = "AI 서버가 북적입니다. 잠시 휴식 후 다시 기입할게요!";
      }

      return res.status(200).json({
        message: fallbackMessage,
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

    return res.status(200).json({
      message: text.substring(0, 100),
      action: "NORMAL"
    });

  } catch (error) {
    console.error("Ultimate Strategy Error:", error);
    return res.status(200).json({
      message: "AI 엔진 예열 중... (중력이 불안정합니다!)",
      action: "NORMAL"
    });
  }
}
