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
                    1. 안전 위험 수준을 판별하세요 (정상, 주의, 경고).
                    
                    2. 위험도 판단: 너무 엄격하게 판단하지 마세요. 명확하고 심각한 위험(화재, 붕괴 등)이 없다면 '정상' 또는 '주의'로 판단하고, 사진의 위험 요소나 안전상태에 대해 근로자 안전, 시설 안전을 한 문장으로 한국어 설명으로 요약해서 제공하세요.
                    3. 설명: 사진의 상황을 짧은 한 문장(20자 내외)으로 요약하세요.
                    4. 제약: 마크다운 기호(**, *)를 절대 넣지 마세요.` }
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
