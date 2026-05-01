const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

// 서울 리전으로 고정
setGlobalOptions({ region: "asia-northeast3" });

exports.sendNiceSms = onRequest(async (request, response) => {
  // CORS 처리
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  try {
    // 프론트엔드에서 보낸 JSON 데이터 (fetch body)
    const { receivers, subject, message } = request.body || {};

    if (!receivers || !message) {
      response.status(400).json({ success: false, message: "잘못된 요청입니다. (수신자 또는 메시지 누락)" });
      return;
    }

    const userId = process.env.VITE_NICESMS_USER_ID;
    const password = process.env.VITE_NICESMS_PASSWORD;
    const senderPhone = process.env.VITE_COMPANY_PHONE || "02-1234-5678";

    if (!userId || !password) {
      logger.warn("문자왕국 환경변수가 누락되었습니다.");
      response.status(200).json({ success: true, message: "환경변수 누락으로 서버에서 시뮬레이션 응답 반환" });
      return;
    }

    const formData = new URLSearchParams();
    formData.append('userid', userId);
    formData.append('password', password);
    formData.append('sender', senderPhone);
    formData.append('receivers', receivers.join('|'));
    formData.append('subject', subject);
    formData.append('msg', message);

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
      response.status(200).json({ success: true, message: `총 ${receivers.length}명에게 문자(LMS) 발송 큐에 등록되었습니다.` });
    } else {
      logger.error(`SMS 실패: ${resultText}`);
      response.status(500).json({ success: false, message: `발송 실패: ${resultText}` });
    }
  } catch (error) {
    logger.error("NiceSMS Send Error:", error);
    response.status(500).json({ success: false, message: `백엔드 네트워크 오류: ${error.message}` });
  }
});
