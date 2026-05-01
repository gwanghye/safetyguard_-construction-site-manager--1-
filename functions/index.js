const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 서울 리전으로 고정
setGlobalOptions({ region: "asia-northeast3" });

// 재사용 가능한 내부 SMS 발송 함수
async function sendSmsInternal(receivers, subject, message) {
  if (!receivers || receivers.length === 0 || !message) {
    return { success: false, message: "잘못된 요청입니다. (수신자 또는 메시지 누락)" };
  }

  const userId = process.env.VITE_NICESMS_USER_ID;
  const password = process.env.VITE_NICESMS_PASSWORD;
  const senderPhone = process.env.VITE_COMPANY_PHONE || "02-1234-5678";

  if (!userId || !password) {
    logger.warn("문자왕국 환경변수가 누락되었습니다. SMS 발송 시뮬레이션 처리");
    return { success: true, message: "환경변수 누락으로 서버에서 시뮬레이션 응답 반환" };
  }

  const formData = new URLSearchParams();
  formData.append('userid', userId);
  formData.append('password', password);
  formData.append('sender', senderPhone);
  formData.append('receivers', receivers.join('|'));
  formData.append('subject', subject);
  formData.append('msg', message);

  try {
    const apiRes = await fetch('https://sms.nicesms.co.kr/cpmms_utf8/cplms.html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://gwanghye.github.io/',
        'Origin': 'https://gwanghye.github.io'
      },
      body: formData.toString()
    });

    const resultText = await apiRes.text();
    
    if (resultText && !resultText.toLowerCase().includes('error')) {
      logger.info(`SMS 성공: ${receivers.length}명에게 발송됨.`);
      return { success: true, message: `총 ${receivers.length}명에게 문자(LMS) 발송 완료.` };
    } else {
      logger.error(`SMS 실패: ${resultText}`);
      return { success: false, message: `발송 실패: ${resultText}` };
    }
  } catch (error) {
    logger.error("NiceSMS Send Error:", error);
    return { success: false, message: `네트워크 오류: ${error.message}` };
  }
}

// 프론트엔드 직접 호출용 HTTP 함수
exports.sendNiceSms = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  const { receivers, subject, message } = request.body || {};
  const result = await sendSmsInternal(receivers, subject, message);
  
  if (result.success) {
    response.status(200).json(result);
  } else {
    response.status(500).json(result);
  }
});

// 매일 오후 2시 일일 점검 누락 알림 스케줄러
exports.scheduledDailyInspectionAlert = onSchedule({
  schedule: "0 14 * * *",
  timeZone: "Asia/Seoul",
}, async (event) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const selectedDate = `${year}-${month}-${day}`;

    // 1. 모든 현장 가져오기
    const sitesSnapshot = await db.collection("sites").get();
    const sites = [];
    sitesSnapshot.forEach(doc => {
      sites.push({ id: doc.id, ...doc.data() });
    });

    // 활성화된 현장 필터링
    const activeSites = sites.filter(site => {
      if (!site.startDate || !site.endDate) return false;
      const start = new Date(site.startDate);
      const end = new Date(site.endDate);
      start.setHours(0, 0, 0, 0); 
      end.setHours(0, 0, 0, 0);
      const isExemptGlobally = end < new Date('2026-04-20');
      return today >= start && today <= end && !isExemptGlobally;
    });

    // 2. 오늘 날짜의 점검 로그 가져오기
    const logsSnapshot = await db.collection("logs").get();
    const todaysLogs = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      const logDate = new Date(data.timestamp);
      const lYear = logDate.getFullYear();
      const lMonth = String(logDate.getMonth() + 1).padStart(2, '0');
      const lDay = String(logDate.getDate()).padStart(2, '0');
      if (`${lYear}-${lMonth}-${lDay}` === selectedDate) {
        todaysLogs.push(data);
      }
    });

    const roles = ["FACILITY", "SAFETY", "SALES"];
    let totalSent = 0;

    // 3. 미점검 파트 판별 및 알림 발송
    for (const site of activeSites) {
      const siteLogs = todaysLogs.filter(l => l.siteId === site.id);
      const missingRoles = roles.filter(role => !siteLogs.some(l => l.inspectorRole === role));

      if (missingRoles.length > 0) {
        const receivers = [];
        missingRoles.forEach(role => {
          const phones = site.managerPhones?.[role];
          if (phones && Array.isArray(phones)) {
            receivers.push(...phones.filter(p => p.trim() !== ''));
          }
        });

        // 중복 전화번호 제거
        const uniqueReceivers = [...new Set(receivers)];

        if (uniqueReceivers.length > 0) {
          const appUrl = "https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/";
          const subject = `[현장 점검 안내]`;
          const message = `[Safety Guard]\n${site.name} 현장 담당자님, 오늘 현장 안전 점검이 누락되었습니다.\n지금 바로 접속하여 일일 점검을 완료해 주세요!\n\n접속링크: ${appUrl}`;

          const result = await sendSmsInternal(uniqueReceivers, subject, message);
          if (result.success) totalSent++;
          else logger.error(`[스케줄러] ${site.name} 알림 발송 실패: ${result.message}`);
        }
      }
    }

    logger.info(`[스케줄러] 매일 오후 2시 일일 점검 누락 알림 실행 완료. 발송 시도 현장 수: ${totalSent}`);
  } catch (error) {
    logger.error("[스케줄러] 일일 점검 누락 알림 실행 중 에러:", error);
  }
});
