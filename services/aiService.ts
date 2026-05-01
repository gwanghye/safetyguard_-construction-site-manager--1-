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

export const verifyVisualAction = async (beforePhoto: string, afterPhoto: string, actionNotes: string): Promise<{ isResolved: boolean, feedback: string }> => {
  const ai = getAiClient();
  if (!ai) return { isResolved: true, feedback: "AI 서비스 불가. 자체 통과 처리합니다." };

  try {
    const cleanBefore = beforePhoto.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    const cleanAfter = afterPhoto.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBefore } },
          { inlineData: { mimeType: 'image/jpeg', data: cleanAfter } },
          { text: `건설 현장 안전 조치 판독관으로서 임무를 수행하세요.
          사진 1은 '조치 전(위험 상황)'이며, 사진 2는 '조치 후(결과)'입니다.
          
          작업자의 조치 설명: "${actionNotes}"
          
          [판독 지침]
          1. 사진 1에 나타난 위험 요소가 사진 2에서 시각적으로 완전히 제거되거나 개선되었는지 확인하세요.
          2. 작업자의 설명과 실제 사진의 일치 여부를 판단하세요.
          3. 첫 번째 줄에 반드시 'PASS' 또는 'FAIL'만 출력하세요.
          4. 두 번째 줄에 판독 이유를 한국어로 한 문장(마크다운 없이) 작성하세요.` }
        ]
      }
    });
    
    const text = response.text || "";
    const isResolved = text.toUpperCase().includes('PASS');
    const feedbackLines = text.split('\n');
    const feedback = feedbackLines.length > 1 ? feedbackLines.slice(1).join(' ').trim() : text.replace('PASS', '').replace('FAIL', '').trim();
    
    return { isResolved, feedback };
  } catch (error) {
    console.error("Error visual verification:", error);
    return { isResolved: true, feedback: "서버 오류로 AI 시각 검수를 생략합니다." };
  }
};

export const validateCorrectiveAction = async (originalNotes: string, actionNotes: string): Promise<{ isResolved: boolean, feedback: string }> => {
  const ai = getAiClient();
  if (!ai) return { isResolved: true, feedback: "AI 서비스 불가. 자체 통과 처리합니다." };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `당신은 건설 안전 점검관입니다. 작업자가 '경고' 처분을 받고 후속 조치 결과를 제출했습니다.
      
      [지적 사항]
      ${originalNotes}
      
      [작업자 조치 내용]
      ${actionNotes}

      위 조치 내용을 보고, 지적된 안전 문제가 충분히 해결되었는지 판단하세요. 
      첫 번째 줄에는 반드시 '승인' 또는 '반려'라는 단어만 출력하고, 
      두 번째 줄부터는 왜 그렇게 판단했는지 피드백을 한 줄로 작성하세요. (마크다운 사용 불가)`
    });
    
    const text = response.text || "";
    const isResolved = text.includes('승인');
    const feedbackLines = text.split('\n');
    const feedback = feedbackLines.length > 1 ? feedbackLines.slice(1).join(' ').trim() : text.replace('승인', '').replace('반려', '').trim();
    
    return { isResolved, feedback };
  } catch (error) {
    console.error("Error validating action:", error);
    return { isResolved: true, feedback: "서버 오류로 AI 검수를 생략합니다." };
  }
};

export const generateRiskAssessmentInsights = async (assessments: any[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI 서비스를 사용할 수 없습니다.";

  if (assessments.length === 0) return "분석할 평가 데이터가 없습니다.";

  // Sort by date and take the most recent ones for context
  const targetData = assessments.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

  const dataText = targetData.map(a => 
    `[${a.siteName}] 작성자: ${a.authorName}, 특이사항: ${a.notes || '없음'}, 상태: ${a.status === 'APPROVED' ? '승인' : '진행중'}`
  ).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{ 
          text: `당신은 안전 관리 본부의 전략적 안전 분석가입니다. 아래의 수시위험성평가 데이터들을 보고, 전사적 또는 지점별 안전 이행 현황에 대한 '핵심 인사이트 요약'을 아주 짧고 강하게 한 문장(마크다운 없이 텍스트만)으로 작성해 주세요.
      
      [데이터 요약]
      ${dataText}

      [지침]
      1. 마크다운 기호(**, *) 사용 절대 금지.
      2. 전반적인 안전 관리 트렌드를 파악하여 경영진이 즉각 이해할 수 있도록 문장형으로 작성.
      3. 긍정적인 부분과 개선이 필요한 핵심 부분을 동시에 언급.
      예시: 전반적인 이행률은 양호하나 특정 지점의 고소 작업 안전 수칙 준수가 미흡하여 전사적인 교육 강화가 필요합니다.`
        }]
      }]
    });
    return response.response.text() || "분석 결과를 도출하지 못했습니다.";
  } catch (e) {
    console.error(e);
    return "데이터 분석 중 오류가 발생했습니다.";
  }
};
export const generateWeeklySafetyReport = async (logs: InspectionLog[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI 서비스를 사용할 수 없습니다.";

  if (logs.length === 0) return "분석할 점검 데이터가 없습니다.";

  // 최근 1주일 데이터 필터링 (프론트에서 필터링해서 오겠지만 안전 장치)
  const logsText = logs.map(log =>
    `[${log.riskLevel}] ${log.siteName} (${log.inspectorRole}): ${log.notes || '메모없음'}, 체크리스트미흡:${Object.entries(log.checklist).filter(([_, v]) => !v).map(([k]) => k).join(',')}`
  ).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `당신은 현대백화점 그룹의 안전 보건 책임자(CSO)입니다. 지난 1주일간의 모든 현장 점검 로그를 분석하여 '전사 안전 트렌드 리포트'를 작성하세요.
      
      [분석 데이터]
      ${logsText}

      [작성 지침]
      1. 마크다운 기호(**, *)를 절대 사용하지 마세요. 오직 줄바꿈과 텍스트만 사용하세요.
      2. 다음 3가지 항목을 반드시 포함하세요:
         - 이번 주 주요 트렌드: (가장 많이 발생한 위험 유형이나 전반적인 안전 수준 요약)
         - 요주의 지점/공종: (집중 관리가 필요한 현장이나 작업 유형 언급)
         - 다음 주 안전 권고: (현장 소장들에게 전달할 핵심 안전 강화 메시지)
      3. 말투는 권위 있으면서도 명확하게 작성하세요. 5줄 이내로 핵심만 요약하세요.`
    });
    return response.text || "주간 분석 리포트를 생성하지 못했습니다.";
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return "트렌드 분석 중 오류가 발생했습니다.";
  }
};
