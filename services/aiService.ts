import { GoogleGenAI } from "@google/genai";
import { InspectionLog } from "../types";

// Helper to ensure API key exists
const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is missing in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateDailySafetySummary = async (logs: InspectionLog[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI 서비스를 사용할 수 없습니다. API 키를 확인하세요.";

  const logsText = logs.map(log =>
    `[${log.riskLevel}] 현장: ${log.siteName}, 점검자: ${log.inspector}, 특이사항: ${log.notes}, 체크리스트부적합: ${Object.entries(log.checklist).filter(([_, val]) => !val).map(([key]) => key).join(', ')
    }`
  ).join('\n');

 try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `당신은 건설 안전 관리자입니다. 아래 로그를 보고 관리자에게 보고할 '일일 안전 요약'을 작성하세요.
      
      [지침]
      1. 마크다운(**, *)을 절대 사용하지 마세요. 오직 텍스트만 사용하세요.
      2. 내용은 핵심만 간결하게 3~4줄 이내로 작성하세요.
      3. 형식을 꼭 지키세요:
         - 종합: (전체 안전 상태 한 줄 요약)
         - 위험: (가장 주의해야 할 사항 1가지)
         - 조치: (현장 소장에게 전달할 지시 1가지)
      
      [로그 데이터]
      ${logsText}`,
      config: {
        systemInstruction: "말투는 정중하고 간결하게 하세요. 특수기호나 볼드체를 쓰지 마세요.",
      }
    });
    return response.text || "분석 보고서가 생성되지 않았습니다.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "오류로 인해 안전 분석을 수행하지 못했습니다.";
  }
};

export const analyzeSafetyPhoto = async (base64Image: string): Promise<{ risk: string, description: string }> => {
  const ai = getAiClient();
  if (!ai) return { risk: '미확인', description: "AI 서비스 불가" };

 try {
        // Remove data URL prefix if present
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: `이 건설 현장 사진을 분석해주세요.
                    1. 주요 안전 위험 수준을 판별하세요 (정상, 주의, 경고).
                    2. 위험도 판단: 너무 엄격하게 판단하지 마세요. 명확하고 심각한 위험(안전모 미착용, 사다리가 있을 시 사다리 아웃트리거 미사용, 소화기 미비치, 화재, 붕괴 등)이 없다면 '정상' 또는 '주의'로 판단하고, 사진의 위험 요소나 안전상태에 대해 한 문장으로 한국어 설명으로 요약해서 제공하세요.
                    3. 위험도 판단시 사람이 있을 시 안전모 착용 여부, 사다리가 있을시 사다리 아웃트리거 사용 여부, 소화기 비치 여부는 반드시 파악해 공유해주고 해당 안전상태 양호하면 해당 내용에 대해 별도 언급하지 마세요. 추가로 정리정돈과 장애물 대한 내용은 위험도 판단 내용에서 제외하세요.
                    4. 설명: 사진의 상황을 짧은 한 문장(25자 내외)으로 요약하세요.
                    5. 제약: 마크다운 기호(**, *)를 절대 넣지 마세요.` }
                ]
            }
        });

    const text = response.text || "";
    const riskMatch = text.match(/(정상|주의|경고)/i);
    const risk = riskMatch ? riskMatch[0] : "주의"; // Default to caution if unclear

    return {
      risk: risk,
      description: text
    };
  } catch (e) {
    console.error(e);
    return { risk: "정상", description: "사진을 분석할 수 없습니다." };
  }
}

export const generateProjectFinalReport = async (site: { name: string, department: string }, logs: InspectionLog[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI 서비스를 사용할 수 없습니다. API 키를 확인하세요.";

  if (logs.length === 0) return "점검 이력이 없어 평가를 진행할 수 없습니다.";

  const logsText = logs.map(log =>
    `[${new Date(log.timestamp).toLocaleDateString()}] 주체: ${log.inspectorRole}, 위험도: ${log.riskLevel}, 특이사항: ${log.notes || '없음'}, 체크리스트부적합: ${Object.entries(log.checklist).filter(([_, val]) => !val).map(([key]) => key).join(', ') || '없음'}`
  ).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `당신은 최고 안전 책임자입니다. 아래 공사 현장의 전체 점검 이력을 분석하여, 이 공사의 '안전관리 최종 평가'를 딱 1~2줄의 문장 하나로 작성해주세요.
      
      [공사 정보]
      - 통사명: ${site.name}
      - 부서: ${site.department}
      
      [점검 로그 데이터]
      ${logsText}

      [지침]
      1. 마크다운 기호 사용 금지. 오직 텍스트만.
      2. 이 공사의 전반적인 안전관리 수준 판별 (우수, 양호, 미흡 등)
      3. 어떤 부분이 잘 되었고, 어떤 부분이 문제였는지 하나의 자연스러운 문장으로 요약.
      예시: 전반적으로 양호했으나 후반에 작업자 보호구 미착용 이슈가 반복됨.`
    });
    return response.text || "평가 보고서를 생성하지 못했습니다.";
  } catch (error) {
    console.error("Error generating final report:", error);
    return "오류로 인해 자동 평가를 수행하지 못했습니다.";
  }
};
