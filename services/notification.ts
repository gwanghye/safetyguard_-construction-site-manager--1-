import { Site, Role } from '../types';

interface AligoResponse {
  result_code: string;
  message: string;
  msg_id?: string;
  error_code?: string;
}

/**
 * 카카오 알림톡 (알리고 API) 전송 모듈
 * 환경변수 설정 필수:
 * VITE_ALIGO_API_KEY, VITE_ALIGO_USER_ID, VITE_ALIGO_SENDER_KEY
 */
export const sendAlimTalk = async (site: Site, missingRoles: Role[]): Promise<{ success: boolean; message: string }> => {
  const apiKey = import.meta.env.VITE_ALIGO_API_KEY;
  const userId = import.meta.env.VITE_ALIGO_USER_ID;
  const senderKey = import.meta.env.VITE_ALIGO_SENDER_KEY; // 카카오 비즈채널 승인 연동 키
  const senderPhone = import.meta.env.VITE_COMPANY_PHONE || "02-1234-5678";

  // API 키가 없으면 시뮬레이션 모드로 동작
  if (!apiKey || !userId || !senderKey) {
    console.warn("[알리고 API] 환경변수가 누락되어 시뮬레이션 모드로 동작합니다.");
    return { success: false, message: "환경변수(API_KEY, USER_ID, SENDER_KEY)가 설정되지 않았습니다." };
  }

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

  // Aligo 알림톡 수신자 파라미터 변환 (receiver_1, receiver_2, ...)
  const formData = new URLSearchParams();
  formData.append('apikey', apiKey);
  formData.append('userid', userId);
  formData.append('senderkey', senderKey);
  formData.append('tpl_code', 'TF_12345'); // 승인받은 템플릿 코드
  formData.append('sender', senderPhone);

  const appUrl = "https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/"; // 실제 배포될 앱 URL
  
  receivers.forEach((phone, index) => {
    formData.append(`receiver_${index + 1}`, phone.replace(/-/g, ''));
    formData.append(`subject_${index + 1}`, `[현장 점검 안내]`);
    formData.append(`message_${index + 1}`, `[안전가드]\n${site.name} 현장 담당자님, 오늘 현장 안전 점검이 누락되었습니다.\n지금 바로 접속하여 일일 점검을 완료해 주세요!\n\n접속링크: ${appUrl}`);
    // 알림톡 전송 실패 시 일반 문자로 대체 발송 (단문/장문)
    formData.append(`failover`, "Y");
    formData.append(`fmessage_${index + 1}`, `[안전가드] ${site.name} 현장의 오늘 안전 점검이 완료되지 않았습니다. 즉시 접속하여 점검 바랍니다. ${appUrl}`);
  });

  try {
    const response = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data: AligoResponse = await response.json();
    
    // 알리고 API 규격상 '1'이 성공
    if (data.result_code === '1') {
      return { success: true, message: `총 ${receivers.length}명에게 알림톡/문자 발송 큐에 등록되었습니다.` };
    } else {
      return { success: false, message: `발송 실패: ${data.message} (${data.error_code || ''})` };
    }
  } catch (error: any) {
    console.error("AlimTalk Send Error:", error);
    return { success: false, message: `네트워크 오류가 발생했습니다: ${error.message}` };
  }
};

/**
 * 공사 종료 시 현장 영업담당자(SALES)에게 수시 위험성평가 안내 알림 발송 (일일/현장 기준)
 */
export const sendAssessmentRequestAlert = async (site: Site): Promise<{ success: boolean; message: string }> => {
  const salesPhones = site.managerPhones?.SALES || [];
  const receivers = salesPhones.filter(p => p.trim() !== '');
  
  if (receivers.length === 0) {
    return { success: false, message: "현장 영업담당자 연락처가 없습니다." };
  }

  console.log(`[알림톡 시뮬레이션] ${site.name} 공사종료. 수시위험성평가 작성 요청 발송 -> 대상 전화번호(현장영업담당): ${receivers.join(', ')}`);
  
  return { success: true, message: "수시위험성평가 대상자에게 안내가 발송되었습니다." };
};

/**
 * 상신 및 승인 단계 시 결재권자(영업팀장, 지원팀장, 점장)에게 카카오 알림톡 발송
 */
export const sendAssessmentApprovalAlert = async (roleName: string, site: Site): Promise<{ success: boolean; message: string }> => {
  // roleName은 "영업팀장", "지원팀장", "점장" 등의 문자열로 들어옵니다.
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
    console.warn(`[알림톡 시뮬레이션] ${roleName}의 연락처가 등록되지 않아 알림 발송을 건너뜜.`);
    return { success: false, message: `${roleName}의 연락처가 없습니다.` };
  }

  const apiKey = import.meta.env.VITE_ALIGO_API_KEY;
  const userId = import.meta.env.VITE_ALIGO_USER_ID;
  const senderKey = import.meta.env.VITE_ALIGO_SENDER_KEY;

  if (!apiKey || !userId || !senderKey) {
    console.log(`[알림톡 시뮬레이션] ${site.name} 결재 요청 -> ${roleName} (${validReceivers.join(', ')}) 알림톡 발송 완료.`);
    return { success: true, message: `${roleName}에게 시뮬레이션 알림이 발송되었습니다.` };
  }

  // 실제 발송 로직 (Aligo API 호출)
  const formData = new URLSearchParams();
  formData.append('apikey', apiKey);
  formData.append('userid', userId);
  formData.append('senderkey', senderKey);
  formData.append('tpl_code', 'TF_APPROVAL'); 
  formData.append('sender', import.meta.env.VITE_COMPANY_PHONE || "02-1234-5678");

  validReceivers.forEach((phone, index) => {
    formData.append(`receiver_${index + 1}`, phone.replace(/-/g, ''));
    formData.append(`message_${index + 1}`, `[안전가드]\n${site.name} 수시위험성평가 결재 요청\n${roleName} 단계\n접속링크: https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/`);
  });

  try {
    const response = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    return { success: data.result_code === '1', message: data.message };
  } catch (e) {
    return { success: false, message: "네트워크 오류가 발생했습니다." };
  }
};

/**
 * 공사 종료 후 3일 경과 시 미작성 건 추적 알림 (자동 연체 알림 모의 실행)
 */
import { RiskAssessmentLog, RiskAssessmentStatus } from '../types';

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
      // 3일 이상 지났는데 평가서가 없거나 DRAFT 상태인 경우, 재촉 알람
      const currentAssessment = assessments.find(a => a.siteId === site.id);
      if (!currentAssessment || currentAssessment.status === RiskAssessmentStatus.DRAFT) {
         console.warn(`[연체 알림 엔진] ${site.name} 현장의 공사 종료일(${site.endDate})로부터 3일 이상 경과! 영업팀장 및 영업담당자에게 긴급 알림톡 발송`);
         alertsCount++;
      }
    }
  });

  return { alertsSent: alertsCount };
};
