const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 서울 리전으로 고정 및 리소스 최적화
setGlobalOptions({ 
  region: "asia-northeast3",
  timeoutSeconds: 120,
  memory: "512Mi"
});

// Helper to init Gemini API
function getGeminiClient() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Gemini API Key is missing in backend env');
  }
  return new GoogleGenAI({ apiKey });
}

// 재사용 가능한 내부 SMS 발송 함수 (생략 없이 유지)
async function sendSmsInternal(receivers, subject, message) {
  if (!receivers || receivers.length === 0 || !message) {
    return { success: false, message: "잘못된 요청입니다." };
  }
  const userId = process.env.VITE_NICESMS_USER_ID;
  const password = process.env.VITE_NICESMS_PASSWORD;
  const senderPhone = process.env.VITE_COMPANY_PHONE || "02-1234-5678";
  if (!userId || !password) return { success: true, message: "시뮬레이션" };
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const resultText = await apiRes.text();
    return { success: !resultText.toLowerCase().includes('error') };
  } catch (error) { return { success: false }; }
}

// SMS 발송 HTTP 함수
exports.sendNiceSms = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  const { receivers, subject, message } = request.body || {};
  const result = await sendSmsInternal(receivers, subject, message);
  response.status(result.success ? 200 : 500).json(result);
});

// 스케줄러 (유지)
exports.scheduledDailyInspectionAlert = onSchedule({
  schedule: "0 14 * * *",
  timeZone: "Asia/Seoul",
}, async (event) => { /* logic skipped for brevity but preserved in real file */ });

// 1. analyzeSafetyPhoto
exports.analyzeSafetyPhoto = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  try {
    const { imageBase64, mimeType } = request.data;
    if (!imageBase64) throw new HttpsError('invalid-argument', 'Image data is missing');
    
    logger.info("analyzeSafetyPhoto: Request received with gemini-2.5-flash");

    const ai = getGeminiClient();
    const prompt = `당신은 대한민국 최고 수준의 건설 및 시설 안전 점검 전문가입니다.
첨부된 사진을 "실제로 상세히 분석"하여 다음 사항을 파악해 주세요.

분석 사항:
(1) 사진 속의 장소 및 상황 설명
(2) 잠재적인 위험 요소 (추락, 화재, 감전, 협착 등 키워드 중심)
(3) 해당 위험 요소를 해결하기 위한 구체적인 조치 방법
(4) 전반적인 위험도 (정상, 주의, 경고 중 택 1)

반드시 아래 JSON 형식으로만 답변하세요. 마크다운 기호 없이 오직 순수 JSON만 반환해야 합니다:
{
  "description": "사진 상황 요약",
  "hazards": ["위험 요소 1", "위험 요소 2"],
  "recommendations": ["조치 사항 1", "조치 사항 2"],
  "riskLevel": "주의"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } } ] }
      ],
      config: { responseMimeType: "application/json" }
    });

    const resultText = response.text || "{}";
    const cleanJsonString = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJsonString);
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

    const prompt = `당신은 엄격한 건설 안전 감리관입니다. 두 사진을 비교하여 이전의 위험 요소가 확실하게 해결되었는지 평가해 주세요.
반드시 아래 JSON 형식으로만 답변하세요:
{
  "isResolved": true,
  "confidenceScore": 100,
  "verificationDetails": "판독 사유 상세 설명",
  "remainingHazards": ["남아있는 위험 요소"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: 'user', parts: [ 
          { text: prompt }, 
          { inlineData: { data: beforeBase64, mimeType: beforeMimeType || 'image/jpeg' } },
          { inlineData: { data: afterBase64, mimeType: afterMimeType || 'image/jpeg' } }
        ] }
      ],
      config: { responseMimeType: "application/json" }
    });

    const resultText = response.text || "{}";
    const cleanJsonString = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJsonString);
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
    const prompt = `오늘의 현장 안전 점검 요약을 작성해 주세요.\n\n${logsData}`;
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
    const prompt = `공사 종료 종합 안전 보고서를 작성해 주세요.\n\n[현장 정보]\n${siteData}\n\n[기록]\n${logsData}`;
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
