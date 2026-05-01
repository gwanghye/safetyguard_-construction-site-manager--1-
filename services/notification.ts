import { Site, Role, RiskAssessmentLog, RiskAssessmentStatus } from '../types';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * 문자왕국(NiceSMS) LMS 전송 공통 함수 (Cloud Functions 연동)
 */
const sendNiceSmsLms = async (receivers: string[], subject: string, message: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch('https://asia-northeast3-safety-system-d5aaf.cloudfunctions.net/sendNiceSms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ receivers, subject, message })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`[Cloud Functions 응답] ${data.message}`);
      return { success: true, message: data.message };
    } else {
      console.error(`[Cloud Functions 에러 응답] ${data.message}`);
      return { success: false, message: data.message || "서버 응답 오류" };
    }
  } catch (error: any) {
    console.error("NiceSMS Cloud Function Call Error:", error);
    return { success: false, message: `서버 통신 오류가 발생했습니다: ${error.message}` };
  }
};

/**
 * 일일 현장 점검 누락 알림 (문자왕국 LMS 전송)
 */
export const sendAlimTalk = async (site: Site, missingRoles: Role[]): Promise<{ success: boolean; message: string }> => {
  // 발송 대상자 전화번호 취합
  const receivers: string[] = [];
  missingRoles.forEach(role => {
    const phones = site.managerPhones?.[role];
    if (phones && Array.isArray(phones)) {
      receivers.push(...phones.filter(p => p.trim() !== ''));
    }
  });

  if (receivers.length === 0) {
    return { success: false, message: "발송할 대상자 연락처가 없습니다." };
  }

  const appUrl = "https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/";
  const subject = `[현장 점검 안내]`;
  const message = `[안전가드]\n${site.name} 현장 담당자님, 오늘 현장 안전 점검이 누락되었습니다.\n지금 바로 접속하여 일일 점검을 완료해 주세요!\n\n접속링크: ${appUrl}`;

  return await sendNiceSmsLms(receivers, subject, message);
};

/**
 * 공사 종료 시 현장 영업담당자(SALES)에게 수시 위험성평가 안내 문자 발송 (일일/현장 기준)
 */
export const sendAssessmentRequestAlert = async (site: Site): Promise<{ success: boolean; message: string }> => {
  const salesPhones = site.managerPhones?.SALES || [];
  const receivers = salesPhones.filter(p => p.trim() !== '');
  
  if (receivers.length === 0) {
    return { success: false, message: "현장 영업담당자 연락처가 없습니다." };
  }

  const subject = `[수시 위험성평가 안내]`;
  const message = `[안전가드]\n${site.name} 현장 공사가 종료되었습니다. 수시 위험성평가를 작성해 주시기 바랍니다.`;

  return await sendNiceSmsLms(receivers, subject, message);
};

/**
 * 상신 및 승인 단계 시 결재권자(영업팀장, 지원팀장, 점장)에게 문자 발송
 */
export const sendAssessmentApprovalAlert = async (roleName: string, site: Site): Promise<{ success: boolean; message: string }> => {
  // 내부 키 매핑
  const roleKeyMap: Record<string, string> = {
    '영업팀장': 'SALES_TL',
    '지원팀장': 'SUPPORT_TL',
    '점장': 'STORE_MANAGER'
  };

  const roleKey = roleKeyMap[roleName] || roleName;
  const receivers = site.managerPhones?.[roleKey as any] || [];
  const validReceivers = receivers.filter(p => p.trim() !== '');

  if (validReceivers.length === 0) {
    console.warn(`[문자왕국 시뮬레이션] ${roleName}의 연락처가 등록되지 않아 알림 발송을 건너뜜.`);
    return { success: false, message: `${roleName}의 연락처가 없습니다.` };
  }

  const subject = `[수시위험성평가 결재 요청]`;
  const message = `[안전가드]\n${site.name} 수시위험성평가 결재 요청\n${roleName} 단계\n접속링크: https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/`;

  return await sendNiceSmsLms(validReceivers, subject, message);
};

/**
 * 공사 종료 후 3일 경과 시 미작성 건 추적 알림 (자동 연체 알림 모의 실행)
 */
export const checkOverdueAssessments = (sites: Site[], assessments: RiskAssessmentLog[]): { alertsSent: number } => {
  let alertsCount = 0;
  const today = new Date();
  today.setHours(0,0,0,0);

  sites.forEach(site => {
    const endDate = new Date(site.endDate);
    endDate.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - endDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays > 3) {
      const currentAssessment = assessments.find(a => a.siteId === site.id);
      if (!currentAssessment || currentAssessment.status === RiskAssessmentStatus.DRAFT) {
         console.warn(`[연체 알림 엔진] ${site.name} 현장의 공사 종료일(${site.endDate})로부터 3일 이상 경과! 영업팀장 및 영업담당자에게 긴급 문자 발송 큐 등록`);
         alertsCount++;
      }
    }
  });

  return { alertsSent: alertsCount };
};
