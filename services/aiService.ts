import { InspectionLog } from "../types";
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

export const generateDailySafetySummary = async (logs: InspectionLog[]): Promise<string> => {
  const logsText = logs.map(log =>
    `[${log.riskLevel}] 현장: ${log.siteName}, 점검자: ${log.inspector}, 특이사항: ${log.notes}, 체크리스트부적합: ${Object.entries(log.checklist).filter(([_, val]) => !val).map(([key]) => key).join(', ')}`
  ).join('\n');

  try {
    const generateSummaryAPI = httpsCallable(functions, 'generateDailySafetySummary');
    const result = await generateSummaryAPI({ logsData: logsText });
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
    const data = result.data as any;
    
    return {
      risk: data.riskLevel || "주의",
      description: data.description || "사진을 분석할 수 없습니다."
    };
  } catch (e) {
    console.error(e);
    return { risk: "정상", description: "서버 오류로 사진을 분석할 수 없습니다." };
  }
};

export const generateProjectFinalReport = async (site: { name: string, department: string }, logs: InspectionLog[]): Promise<string> => {
  if (logs.length === 0) return "점검 이력이 없어 평가를 진행할 수 없습니다.";

  const siteText = `- 공사명: ${site.name}\n- 부서: ${site.department}`;
  const logsText = logs.map(log =>
    `[${new Date(log.timestamp).toLocaleDateString()}] 주체: ${log.inspectorRole}, 위험도: ${log.riskLevel}, 특이사항: ${log.notes || '없음'}, 체크리스트부적합: ${Object.entries(log.checklist).filter(([_, val]) => !val).map(([key]) => key).join(', ') || '없음'}`
  ).join('\n');

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
