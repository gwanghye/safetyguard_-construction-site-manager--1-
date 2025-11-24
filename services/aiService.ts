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
      contents: `당신은 건설 안전 총괄 책임자입니다. 아래의 금일 현장 점검 로그를 바탕으로 '일일 위험 분석 보고서'를 작성해주세요.
      
      다음 형식으로 작성하세요:
      1. [총평] 전체적인 현장 안전 상태 요약 (한 문장)
      2. [주요 위험 요인] 발견된 가장 심각한 위험 2~3가지와 원인 분석
      3. [조치 권고] 현장 소장들에게 전달할 구체적인 지시사항
      
      로그 데이터:
      ${logsText}`,
      config: {
        systemInstruction: "전문적이고 분석적인 어조를 사용하세요. '경고' 레벨의 항목에 집중하세요. 마크다운 형식을 사용하지 말고 일반 텍스트로 가독성 있게 줄바꿈하세요.",
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
          { text: "이 건설 현장 사진을 분석해주세요. 1. 주요 안전 위험 수준을 판별하세요 (정상, 주의, 경고). 2. 위험 요소나 안전 상태에 대해 한 문장으로 한국어 설명을 제공하세요." }
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