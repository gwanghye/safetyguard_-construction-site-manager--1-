const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ 
  region: "asia-northeast3",
  timeoutSeconds: 120,
  memory: "512Mi"
});

function getGeminiClient() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Gemini API Key is missing');
  return new GoogleGenAI({ apiKey });
}

async function sendSmsInternal(receivers, subject, message) {
  if (!receivers || receivers.length === 0 || !message) {
    return { success: false, message: "잘못된 요청입니다." };
  }
  const userId = process.env.VITE_NICESMS_USER_ID;
  const password = process.env.VITE_NICESMS_PASSWORD;
  const senderPhone = process.env.VITE_COMPANY_PHONE || "02-1234-5678";
  if (!userId || !password) {
    logger.warn("SMS 환경변수 누락. 시뮬레이션 처리");
    return { success: true, message: "시뮬레이션" };
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://gwanghye.github.io/', 'Origin': 'https://gwanghye.github.io' },
      body: formData.toString()
    });
    const resultText = await apiRes.text();
    if (resultText && !resultText.toLowerCase().includes('error')) {
      return { success: true, message: `총 ${receivers.length}명에게 발송 완료.` };
    }
    return { success: false, message: `발송 실패: ${resultText}` };
  } catch (error) {
    return { success: false, message: `오류: ${error.message}` };
  }
}

exports.sendNiceSms = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
  const { receivers, subject, message } = request.body || {};
  const result = await sendSmsInternal(receivers, subject, message);
  response.status(result.success ? 200 : 500).json(result);
});

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
    const sitesSnapshot = await db.collection("sites").get();
    const sites = [];
    sitesSnapshot.forEach(doc => { sites.push({ id: doc.id, ...doc.data() }); });
    const activeSites = sites.filter(site => {
      if (!site.startDate || !site.endDate) return false;
      const start = new Date(site.startDate);
      const end = new Date(site.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end && end >= new Date('2026-04-20');
    });
    const logsSnapshot = await db.collection("logs").get();
    const todaysLogs = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      const logDate = new Date(data.timestamp);
      const lYear = logDate.getFullYear();
      const lMonth = String(logDate.getMonth() + 1).padStart(2, '0');
      const lDay = String(logDate.getDate()).padStart(2, '0');
      if (`${lYear}-${lMonth}-${lDay}` === selectedDate) todaysLogs.push(data);
    });
    const roles = ["FACILITY", "SAFETY", "SALES"];
    let totalSent = 0;
    for (const site of activeSites) {
      const siteLogs = todaysLogs.filter(l => l.siteId === site.id);
      const missingRoles = roles.filter(role => !siteLogs.some(l => l.inspectorRole === role));
      if (missingRoles.length > 0) {
        const receivers = [];
        missingRoles.forEach(role => {
          const phones = site.managerPhones?.[role];
          if (phones && Array.isArray(phones)) receivers.push(...phones.filter(p => p.trim() !== ''));
        });
        const uniqueReceivers = [...new Set(receivers)];
        if (uniqueReceivers.length > 0) {
          const appUrl = "https://gwanghye.github.io/safetyguard_-construction-site-manager--1-/";
          const result = await sendSmsInternal(uniqueReceivers, `[현장 점검 안내]`, `[Safety Guard]\n${site.name} 현장 담당자님, 오늘 현장 안전 점검이 누락되었습니다.\n지금 바로 접속해 주세요!\n\n${appUrl}`);
          if (result.success) totalSent++;
        }
      }
    }
    logger.info(`[스케줄러] 완료. 발송 현장 수: ${totalSent}`);
  } catch (error) {
    logger.error("[스케줄러] 에러:", error);
  }
});

// 1. analyzeSafetyPhoto
exports.analyzeSafetyPhoto = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  try {
    const { imageBase64, mimeType } = request.data;
    if (!imageBase64) throw new HttpsError('invalid-argument', 'Image data is missing');
    logger.info("analyzeSafetyPhoto 요청 수신");

    const ai = getGeminiClient();

    const prompt = `당신은 대한민국 건설 현장 전문 안전관리자입니다.
첨부된 사진을 분석하여 현장 안전 상태를 점검해 주세요.

[반드시 확인할 안전 항목]
- 안전모(헬멧) 착용 여부
- 안전벨트/추락방지 장비 착용 여부
- 사다리 작업 시 2인1조 작업 여부
- 화기(용접, 절단 등) 작업 안전 조치 여부
- 소화기 비치 여부
- 전기 배선 노출 및 감전 위험 여부
- 추락·낙하 위험 구역 안전망/방호시설 여부
- 자재 정리정돈 상태

[위험도 기준 - 관대하게 판단]
- 정상: 전반적으로 안전하고 특이사항 없음
- 주의: 개선이 필요한 사항이 1~2개 있음
- 경고: 즉각 조치가 필요한 심각한 위험이 있음

분석 결과를 반드시 아래 JSON 형식으로만 반환하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "riskLevel": "정상",
  "description": "현재 사진에서 확인된 상황을 1~2문장으로 요약",
  "hazards": ["식별된 위험요소 1", "위험요소 2"],
  "recommendations": ["권고 조치 1", "권고 조치 2"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } } ] }
      ],
      config: { responseMimeType: "application/json" }
    });

    const resultText = response.text || "{}";
    logger.info("AI 응답 수신", { length: resultText.length });
    const cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    logger.info("AI 분석 결과", { riskLevel: parsed.riskLevel });
    return parsed;
  } catch (error) {
    logger.error("analyzeSafetyPhoto error:", error);
    throw new HttpsError('internal', error.message);
  }
});

// 2. verifyVisualAction
exports.verifyVisualAction = onCall({ region: "asia-northeast3" }, async (request) => {
  try {
    const { beforeBase64, beforeMimeType, afterBase64, afterMimeType } = request.data;
    const ai = getGeminiClient();
    const prompt = `당신은 건설 안전 감리관입니다.
첫 번째 이미지는 조치 전, 두 번째 이미지는 조치 후 상태입니다.
두 사진을 비교하여 위험 요소가 해결되었는지 평가하세요.
반드시 아래 JSON 형식으로만 답변하세요:
{
  "isResolved": true,
  "confidenceScore": 85,
  "verificationDetails": "판독 사유 설명",
  "remainingHazards": []
}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [
        { text: prompt },
        { inlineData: { data: beforeBase64, mimeType: beforeMimeType || 'image/jpeg' } },
        { inlineData: { data: afterBase64, mimeType: afterMimeType || 'image/jpeg' } }
      ] }],
      config: { responseMimeType: "application/json" }
    });
    const cleanJson = (response.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    logger.error("verifyVisualAction error:", error);
    throw new HttpsError('internal', error.message);
  }
});

// 3. generateDailySafetySummary
exports.generateDailySafetySummary = onCall({ region: "asia-northeast3" }, async (request) => {
  try {
    const { logsData } = request.data;
    const ai = getGeminiClient();
    const prompt = `당신은 건설 안전 종합 분석관입니다. 오늘의 현장 안전 점검 데이터를 기반으로 일일 안전 브리핑을 3~4문단으로 작성해 주세요.\n\n[오늘 점검 데이터]\n${logsData}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return { summary: response.text || "" };
  } catch (error) {
    logger.error("generateDailySafetySummary error:", error);
    throw new HttpsError('internal', error.message);
  }
});

// 4. generateProjectFinalReport
exports.generateProjectFinalReport = onCall({ region: "asia-northeast3" }, async (request) => {
  try {
    const { siteData, logsData } = request.data;
    const ai = getGeminiClient();
    const prompt = `당신은 최고 책임 건설 안전 감리관입니다. 공사 종료 종합 안전 보고서를 전문적으로 작성해 주세요.\n\n[현장 정보]\n${siteData}\n\n[점검 기록]\n${logsData}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return { report: response.text || "" };
  } catch (error) {
    logger.error("generateProjectFinalReport error:", error);
    throw new HttpsError('internal', error.message);
  }
});
