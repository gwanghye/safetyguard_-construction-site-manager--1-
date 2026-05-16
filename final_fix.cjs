const fs = require('fs');
const path = 'firebase_functions/index.js';

const content = \`const { onRequest, onCall, HttpsError } = require(\"firebase-functions/v2/https\");
const { GoogleGenAI } = require(\"@google/genai\");
const { onSchedule } = require(\"firebase-functions/v2/scheduler\");
const { setGlobalOptions } = require(\"firebase-functions/v2\");
const logger = require(\"firebase-functions/logger\");
const admin = require(\"firebase-admin\");

admin.initializeApp();
const db = admin.firestore();

// 서울 리전으로 고정
setGlobalOptions({ region: \"asia-northeast3\" });

// 재사용 가능한 내부 SMS 발송 함수
async function sendSmsInternal(receivers, subject, message) {
  if (!receivers || receivers.length === 0 || !message) {
    return { success: false, message: \"잘못된 요청입니다. (수신자 또는 메시지 누락)\" };
  }

  const userId = process.env.VITE_NICESMS_USER_ID;
  const password = process.env.VITE_NICESMS_PASSWORD;
  const senderPhone = process.env.VITE_COMPANY_PHONE || \"02-1234-5678\";

  if (!userId || !password) {
    logger.warn(\"문자왕국 환경변수가 누락되었습니다. SMS 발송 시뮬레이션 처리\");
    return { success: true, message: \"환경변수 누락으로 서버에서 시뮬레이션 응답 반환\" };
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
      logger.info(\`SMS 성공: \${receivers.length}명에게 발송됨.\`);
      return { success: true, message: \`총 \${receivers.length}명에게 문자(LMS) 발송 완료.\` };
    } else {
      logger.error(\`SMS 실패: \${resultText}\`);
      return { success: false, message: \`발송 실패: \${resultText}\` };
    }
  } catch (error) {
    logger.error(\"NiceSMS Send Error:\", error);
    return { success: false, message: \`네트워크 오류: \${error.message}\` };
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
  schedule: \"0 14 * * *\",
  timeZone: \"Asia/Seoul\",
}, async (event) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const selectedDate = \`\${year}-\${month}-\${day}\`;

    // 1. 모든 현장 가져오기
    const sitesSnapshot = await db.collection(\"sites\").get();
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
    const logsSnapshot = await db.collection(\"logs\").get();
    const todaysLogs = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      const logDate = new Date(data.timestamp);
      const lYear = logDate.getFullYear();
      const lMonth = String(logDate.getMonth() + 1).padStart(2, '0');
      const lDay = String(logDate.getDate()).padStart(2, '0');
      if (\`\${lYear}-\${lMonth}-\${lDay}\` === selectedDate) {
        todaysLogs.push(data);
      }
    });

    const roles = [\"FACILITY\", \"SAFETY\", \"SALES\"];
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
          const appUrl = \"https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/\";
          const subject = \`[현장 점검 안내]\`;
          const message = \`[Safety Guard]\\n\${site.name} 현장 담당자님, 오늘 현장 안전 점검이 누락되었습니다.\\n지금 바로 접속하여 일일 점검을 완료해 주세요!\\n\\n접속링크: \${appUrl}\`;

          const result = await sendSmsInternal(uniqueReceivers, subject, message);
          if (result.success) totalSent++;
          else logger.error(\`[스케줄러] \${site.name} 알림 발송 실패: \${result.message}\`);
        }
      }
    }

    logger.info(\`[스케줄러] 매일 오후 2시 일일 점검 누락 알림 실행 완료. 발송 시도 현장 수: \${totalSent}\`);
  } catch (error) {
    logger.error(\"[스케줄러] 일일 점검 누락 알림 실행 중 에러:\", error);
  }
});

// Helper to init Gemini API
function getGeminiClient() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Gemini API Key is missing in backend env');
  }
  return new GoogleGenAI(apiKey);
}

// 1. analyzeSafetyPhoto
exports.analyzeSafetyPhoto = onCall({ region: \"asia-northeast3\", enforceAppCheck: false }, async (request) => {
  try {
    const { imageBase64, mimeType } = request.data;
    if (!imageBase64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'Image data is missing');
    }

    const ai = getGeminiClient();
    const prompt = \`
당신은 대한민국 최고 수준의 건설 및 시설 안전 점검 전문가입니다.
반드시 첨부된 사진을 \"실제로 분석\"하여 있는 그대로의 사실을 파악해 주세요. 
절대 가짜 데이터를 생성하거나 일반적인 추측을 답변하지 마세요. 
사진에 보이지 않는 내용은 언급하지 마세요.

분석 사항:
(1) 사진 속의 장소 및 상황 설명 (1~2줄 이내로 매우 구체적이고 사실적으로)
(2) 사진에서 식별되는 실제 잠재적 위험 요소 (없다면 '없음'으로 기재)
(3) 해당 위험 요소를 해결하기 위한 현장 맞춤형 조치 방법
(4) 전반적인 위험도 (정상, 주의, 경고 중 택 1)

반드시 아래 JSON 형식으로만 답변하세요:
{
  \"description\": \"사진 상황 요약\",
  \"hazards\": [\"위험 요소 1\", \"위험 요소 2\"],
  \"recommendations\": [\"조치 사항 1\", \"조치 사항 2\"],
  \"riskLevel\": \"주의\"
}\`;

    const model = ai.getGenerativeModel({ 
      model: \"gemini-1.5-flash\",
      generationConfig: { responseMimeType: \"application/json\" }
    });
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: mimeType } }
    ]);
    
    const response = await result.response;
    const resultText = response.text();
    const cleanJsonString = resultText.replace(/\\`\\`\\`json/g, \"\").replace(/\\`\\`\\`/g, \"\").trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    logger.error(\"analyzeSafetyPhoto error:\", error);
    throw new HttpsError('internal', error.message);
  }
});

// 2. verifyVisualAction
exports.verifyVisualAction = onCall({ region: \"asia-northeast3\" }, async (request) => {
  try {
    const { beforeBase64, beforeMimeType, afterBase64, afterMimeType } = request.data;
    const ai = getGeminiClient();

    const prompt = \`
당신은 엄격한 건설 안전 감리관입니다.
첫 번째 이미지는 '조치 전'의 위험한 상태를 보여주고,
두 번째 이미지는 '조치 후'의 상태를 보여줍니다.

두 사진을 비교하여 이전의 위험 요소가 확실하게 해결되었는지 평가해 주세요.

반드시 아래 JSON 형식으로만 답변을 반환하세요. 마크다운 기호 없이 순수 JSON 문자열만 출력해야 합니다.
{
  \"isResolved\": true/false,
  \"confidenceScore\": 0~100,
  \"verificationDetails\": \"판독 사유 상세 설명\",
  \"remainingHazards\": [\"아직 남아있는 위험 요소 1\", ...]
}\`;

    const model = ai.getGenerativeModel({ 
      model: \"gemini-1.5-flash\",
      generationConfig: { responseMimeType: \"application/json\" }
    });
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: beforeBase64, mimeType: beforeMimeType } },
      { inlineData: { data: afterBase64, mimeType: afterMimeType } }
    ]);
    
    const response = await result.response;
    const resultText = response.text();
    const cleanJsonString = resultText.replace(/\\`\\`\\`json/g, \"\").replace(/\\`\\`\\`/g, \"\").trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    logger.error(\"verifyVisualAction error:\", error);
    throw new HttpsError('internal', error.message);
  }
});

// 3. generateDailySafetySummary
exports.generateDailySafetySummary = onCall({ region: \"asia-northeast3\" }, async (request) => {
  try {
    const { logsData } = request.data;
    const ai = getGeminiClient();
    
    const prompt = \`
당신은 건설 안전 종합 분석관입니다.
오늘 발생한 안전 점검 로그 데이터를 기반으로 경영진이 한눈에 파악할 수 있는 일일 안전 요약 브리핑을 작성해 주세요.

[요구사항]
1. 전체 점검 건수 및 위험도 분포 요약
2. 주요 위험 요소 및 반복적으로 나타나는 문제점 도출
3. 신속한 조치가 필요한 긴급 사항 강조
4. 내일 점검 시 집중적으로 확인해야 할 사항 제안

[데이터]
\${logsData}

위 내용을 종합하여 전문가의 어조로 명확하고 간결하게 3~4문단으로 요약해 주세요.
\`;

    const model = ai.getGenerativeModel({ model: \"gemini-1.5-flash\" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { summary: response.text() };
  } catch (error) {
    logger.error(\"generateDailySafetySummary error:\", error);
    throw new HttpsError('internal', error.message);
  }
});

// 4. generateProjectFinalReport
exports.generateProjectFinalReport = onCall({ region: \"asia-northeast3\" }, async (request) => {
  try {
    const { siteData, logsData } = request.data;
    const ai = getGeminiClient();
    
    const prompt = \`
당신은 최고 책임 건설 안전 감리관입니다.
다음은 방금 공사가 종료된 현장의 기본 정보와 전체 공사 기간 동안의 위험성 평가 및 조치 기록입니다.
이 데이터를 바탕으로 공사 종료 종합 안전 보고서를 작성해 주세요.

[현장 정보]
\${siteData}

[안전 점검 및 조치 기록]
\${logsData}

[작성 지침]
1. 전체적인 안전 관리 수준에 대한 총평 (1문단)
2. 가장 빈번하게 발생했던 주요 위험 요소와 그 원인 분석
3. 안전 관리 우수 사례 또는 아쉬웠던 점
4. 향후 유사한 공사 진행 시 재발 방지를 위한 구체적인 제언 및 권고사항

전문적이고 객관적인 어조로 작성해 주세요.
\`;

    const model = ai.getGenerativeModel({ model: \"gemini-1.5-pro\" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { report: response.text() };
  } catch (error) {
    logger.error(\"generateProjectFinalReport error:\", error);
    throw new HttpsError('internal', error.message);
  }
});\`;

fs.writeFileSync(path, content);
console.log('Successfully fixed firebase_functions/index.js');
