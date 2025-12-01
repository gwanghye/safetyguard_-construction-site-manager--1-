<div align="center">
  <img width="1000" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <h2> AI 기반 공사·안전 점검 자동화 플랫폼</h2>
  <sub>Construction Safety Inspection Web Dashboard</sub>
</div>

---

## 📌 Overview

본 프로젝트는 **공사 현장 점검 데이터를 웹 상에서 입력·관리·요약할 수 있는 AI 기반 관제 플랫폼**입니다.  
현장 작업자가 입력한 점검 정보(위치 · 공종 · 사진 · 특이사항 등)는 서버(Firebase)에 저장되고,  
백엔드에서 호출되는 **Gemini AI 모델이 위험요소 및 핵심사항을 자동 요약**하여 중앙 관제 화면으로 제공합니다.

> 목적 : 일일 점검의 문서화·표준화·속도향상  
> 사용환경 : PC/모바일 Web  
> 데이터 흐름 : Web → Firebase DB → Gemini Summary → Dashboard 출력

---

## 🏗️ Key Features

| 기능 | 설명 |
|---|---|
| 📍 점검 입력 폼(Web) | 공사 위치·사진·특이사항 입력 |
| 🗂 중앙 관제 페이지 | 오늘 점검 데이터 실시간 조회 |
| 🔥 AI 위험요약 | Gemini가 주요 리스크 자동 분석 |
| 📷 사진 저장 | Firebase Storage 업로드 및 연동 |
| 🔐 사내 활용 최적화 | 인증·권한 설정 확장 가능 |

---

## 🔧 Tech Stack

| Layer | Technology | 역할 |
|---|---|---|
| Frontend | HTML · JavaScript(React 기반) | 입력/조회 UI, GitHub Pages 호스팅 |
| Backend | Firebase Functions | API 처리 · AI 호출 · 로직 실행 |
| Database | Firestore | 점검 기록 저장(일~누적 가능) |
| File Storage | Firebase Storage | 점검 사진 저장/URL 관리 |
| AI | Gemini API | 위험도 요약 및 작업 인사이트 생성 |

---

## 🚀 Run Locally

### 1) Install Dependencies

```bash
npm install

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
