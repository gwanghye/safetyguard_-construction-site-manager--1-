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

  const appUrl = "https://safetyguard.surge.sh/"; // 실제 배포될 앱 URL
  
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
