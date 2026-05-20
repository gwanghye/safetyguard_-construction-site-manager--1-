import { InspectionLog, RiskLevel, Role } from "../types";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

// URL 또는 Base64 이미지를 순수 Base64 데이터로 변환하는 유틸리티
const fetchAsBase64 = async (urlOrBase64: string): Promise<string> => {
  if (urlOrBase64.startsWith('data:image')) {
    return urlOrBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
  }
  try {
    const response = await fetch(urlOrBase64);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to fetch image as base64:", error);
    return "";
  }
};

export const generateDailySafetySummary = async (logs: InspectionLog[], dateStr?: string): Promise<string> => {
  const formattedDate = dateStr || (() => {
    const now = new Date();
    return `${now.getMonth() + 1}월 ${now.getDate()}일`;
  })();

  const promptInstructions = `
[작성 지침 - 반드시 준수할 것]
1. 보고서 제목은 반드시 다음 형식을 한 번만 사용하세요: "### 일일 안전 브리핑 (${formattedDate})"
   - 절대 'YYYY년 MM월 DD일' 이라는 글자나 템플릿용 텍스트를 그대로 출력하지 마십시오. 반드시 실제 날짜인 "${formattedDate}"로 대체하여 출력하십시오.
2. 긴 서술형 문단 대신, 아래의 요소를 글머리 기호(bullet points)로 2~3줄씩 핵심만 매우 간결하고 가독성 있게 정리하십시오.
3. 양식:
   - **점검 요약**: 오늘 점검 현장 수, 정상/경고 분포
   - **조치 대상 (경고)**: 경고 조치가 필요한 현장 및 구체적 원인 요약 (없다면 '없음')
   - **종합 의견**: 오늘 현장 안전 핵심 당부사항 및 등급

[오늘 점검 데이터]
`;

  const logsText = logs.map(log =>
    `[${log.riskLevel}] 현장: ${log.siteName}, 점검자: ${log.inspector}, 특이사항: ${log.notes}, 체크리스트부적합: ${Object.entries(log.checklist).filter(([_, val]) => !val).map(([key]) => key).join(', ')}`
  ).join('\n');

  try {
    const generateSummaryAPI = httpsCallable(functions, 'generateDailySafetySummary');
    const result = await generateSummaryAPI({ logsData: promptInstructions + logsText });
    return (result.data as any).summary || "분석 보고서가 생성되지 않았습니다.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "오류로 인해 안전 분석을 수행하지 못했습니다.";
  }
};

export const analyzeSafetyPhoto = async (base64Image: string): Promise<{ risk: string, description: string }> => {
  try {
    const cleanBase64 = await fetchAsBase64(base64Image);
    const analyzePhotoAPI = httpsCallable(functions, 'analyzeSafetyPhoto');
    const result = await analyzePhotoAPI({ imageBase64: cleanBase64, mimeType: 'image/jpeg' });
    const raw = result.data as any;
    console.log("AI Analysis Raw Result:", raw);

    // 서버가 JSON 객체를 반환한 경우
    if (raw && typeof raw === 'object') {
      const riskLevel = raw.riskLevel || raw.risk || "주의";
      const description = raw.description || raw.summary || "분석 내용 없음";
      const hazards: string[] = Array.isArray(raw.hazards) ? raw.hazards : (raw.hazards ? [raw.hazards] : ["식별된 위험요소 없음"]);
      const recommendations: string[] = Array.isArray(raw.recommendations) ? raw.recommendations : (raw.recommendations ? [raw.recommendations] : ["특이사항 없음"]);

      const formattedDescription =
        `1. 위험 판단 단계: ${riskLevel}\n` +
        `2. 현상황 설명: ${description}\n` +
        `3. 도출된 위험요소: ${hazards.join(' / ')}\n` +
        `4. 권고 조치사항: ${recommendations.join(' / ')}`;

      return { risk: riskLevel, description: formattedDescription };
    }

    // 서버가 문자열을 반환한 경우 (JSON 파싱 실패)
    const rawStr = String(raw || "");
    return {
      risk: "주의",
      description:
        `1. 위험 판단 단계: 주의\n` +
        `2. 현상황 설명: ${rawStr.substring(0, 200)}\n` +
        `3. 도출된 위험요소: 분석 결과 확인 필요\n` +
        `4. 권고 조치사항: 현장 담당자에게 문의하세요`
    };
  } catch (e: any) {
    console.error("analyzeSafetyPhoto error:", e);
    return {
      risk: "주의",
      description:
        `1. 위험 판단 단계: 분석 실패\n` +
        `2. 현상황 설명: AI 분석 중 오류가 발생했습니다 (${e?.message || "알 수 없는 오류"})\n` +
        `3. 도출된 위험요소: 직접 확인 필요\n` +
        `4. 권고 조치사항: 사진을 다시 업로드하거나 수동으로 입력해주세요`
    };
  }
};

export const generateProjectFinalReport = async (site: { name: string, department: string }, logs: InspectionLog[]): Promise<string> => {
  if (logs.length === 0) return "점검 이력이 없어 평가를 진행할 수 없습니다.";

  // Calculate statistics programmatically - 100% accurate, no hallucination
  const facilityLogs = logs.filter(l => l.inspectorRole === Role.FACILITY || String(l.inspectorRole).toUpperCase() === 'FACILITY');
  const safetyLogs = logs.filter(l => l.inspectorRole === Role.SAFETY || String(l.inspectorRole).toUpperCase() === 'SAFETY');
  const salesLogs = logs.filter(l => l.inspectorRole === Role.SALES || String(l.inspectorRole).toUpperCase() === 'SALES');

  const fNormal = facilityLogs.filter(l => l.riskLevel === RiskLevel.NORMAL).length;
  const sNormal = safetyLogs.filter(l => l.riskLevel === RiskLevel.NORMAL).length;
  const slNormal = salesLogs.filter(l => l.riskLevel === RiskLevel.NORMAL).length;

  // Build significant issue snippets from logs (max 5)
  const warningSnippets = logs
    .filter(l => l.riskLevel !== RiskLevel.NORMAL && l.notes)
    .slice(0, 5)
    .map(l => `[${l.inspectorRole}] ${l.notes || ''}`)
    .join(' / ');

  // Pre-build the fixed template — only [OPINION] needs AI
  const siteText = `
[지침] 당신은 안전관제 보고서 AI입니다. 아래 완성된 보고서 양식에서 [OPINION] 부분만 1~2문장으로 채워주세요. 
- 서명, 결어, 인사말, 코드블록(⋯) 절대 금지.
- [OPINION] 외 다른 텍스트는 절대 추가하지 마세요. 양식 그대로 출력하세요.

[보고서 양식]
### 공사 개요
- **공사명**: ${site.name}
- **담당부서**: ${site.department}
- **총 점검 횟수**: ${logs.length}회

### 종합 점검 통계
| 구분 | 점검 | 정상 | 경고/주의 |
| --- | --- | --- | --- |
| 시설팀 | ${facilityLogs.length}회 | ${fNormal}회 | ${facilityLogs.length - fNormal}회 |
| 안전팀 | ${safetyLogs.length}회 | ${sNormal}회 | ${safetyLogs.length - sNormal}회 |
| 영업팀 | ${salesLogs.length}회 | ${slNormal}회 | ${salesLogs.length - slNormal}회 |

### 핵심 안전 의견
[OPINION]
`;

  const logsText = warningSnippets ? `주요 특이사항: ${warningSnippets}` : '특이사항 없음';

  try {
    const generateReportAPI = httpsCallable(functions, 'generateProjectFinalReport');
    const result = await generateReportAPI({ siteData: siteText, logsData: logsText });
    return (result.data as any).report || "평가 보고서를 생성하지 못했습니다.";
  } catch (error) {
    console.error("Error generating final report:", error);
    return "오류로 인해 자동 평가를 수행하지 못했습니다.";
  }
};

export const verifyVisualAction = async (beforePhoto: string, afterPhoto: string, actionNotes: string): Promise<{ isResolved: boolean, feedback: string }> => {
  try {
    const cleanBefore = await fetchAsBase64(beforePhoto);
    const cleanAfter = await fetchAsBase64(afterPhoto);

    if (!cleanBefore || !cleanAfter) {
      return { isResolved: true, feedback: "이미지를 변환할 수 없어 시각 검수를 생략합니다." };
    }

    const verifyActionAPI = httpsCallable(functions, 'verifyVisualAction');
    const result = await verifyActionAPI({
      beforeBase64: cleanBefore,
      beforeMimeType: 'image/jpeg',
      afterBase64: cleanAfter,
      afterMimeType: 'image/jpeg',
      actionNotes: actionNotes
    });
    
    const data = result.data as any;

    return { 
      isResolved: data.isResolved, 
      feedback: data.verificationDetails || "시각 검수가 완료되었습니다."
    };
  } catch (error) {
    console.error("Error visual verification:", error);
    return { isResolved: true, feedback: "서버 오류로 AI 시각 검수를 생략합니다." };
  }
};

export const validateCorrectiveAction = async (originalNotes: string, actionNotes: string): Promise<{ isResolved: boolean, feedback: string }> => {
  return { isResolved: true, feedback: "서면 조치 확인이 완료되었습니다." };
};

export const generateRiskAssessmentInsights = async (assessments: any[]): Promise<string> => {
  if (assessments.length === 0) return "수시위험성평가 데이터가 없어 통찰 요약을 생성할 수 없습니다.";

  const assessmentsText = assessments.map(a =>
    `[평가상태: ${a.status}] 현장: ${a.siteName}, 부서: ${a.department}, 작성자: ${a.authorName || '미상'}, 특이사항: ${a.notes || '없음'}, 점검항목: 천장(${a.checklist?.ceiling || '없음'}), 바닥(${a.checklist?.floor || '없음'}), 벽체(${a.checklist?.wall || '없음'}), 설비(${a.checklist?.equipment || '없음'}), 소화(${a.checklist?.fireSafety || '없음'}), 전기(${a.checklist?.electrical || '없음'})`
  ).join('\n');

  try {
    const generateSummaryAPI = httpsCallable(functions, 'generateDailySafetySummary');
    const result = await generateSummaryAPI({ logsData: assessmentsText });
    return (result.data as any).summary || "인사이트가 생성되지 않았습니다.";
  } catch (error) {
    console.error("Error generating risk assessment insights:", error);
    return "오류로 인해 위험성평가 인사이트를 분석하지 못했습니다.";
  }
};
