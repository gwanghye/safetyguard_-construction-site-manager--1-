
export enum RiskLevel {
  NORMAL = '정상',
  CAUTION = '주의',
  WARNING = '경고'
}

export enum Role {
  FACILITY = 'FACILITY', // 시설관리 (설비 점검)
  SAFETY = 'SAFETY',     // 안전관리 (안전 수칙 점검)
  SALES = 'SALES',       // 영업관리 (영업장 점검)
  SUPPORT = 'SUPPORT',   // 지원팀 (중앙 관제)
  STORE_MANAGER = 'STORE_MANAGER' // 점장
}

export enum RiskAssessmentStatus {
  DRAFT = 'DRAFT',
  PENDING_SALES_TL = 'PENDING_SALES_TL',
  PENDING_SUPPORT_TL = 'PENDING_SUPPORT_TL',
  PENDING_STORE_MGR = 'PENDING_STORE_MGR',
  APPROVED = 'APPROVED'
}

export interface RiskAssessmentLog {
  id: string;
  siteId: string;
  siteName: string;
  department: string;
  constructionPeriod: string;
  authorName: string;
  timestamp: number;
  status: RiskAssessmentStatus;
  checklist: {
    ceiling: '양호' | '보완' | '해당없음' | '';
    floor: '양호' | '보완' | '해당없음' | '';
    wall: '양호' | '보완' | '해당없음' | '';
    equipment: '양호' | '보완' | '해당없음' | '';
    fireSafety: '양호' | '보완' | '해당없음' | '';
    electrical: '양호' | '보완' | '해당없음' | '';
    others: '양호' | '보완' | '해당없음' | '';
  };
  notes: string;
  photos: {
    before: string;
    after: string;
    riskFactor: string;
    actionTaken: string;
  }[];
  authorSignature?: string; // 영업담당자 서명
  approvers: {
    salesTeamLeader?: {
      name: string;
      date: number;
      signature?: string;
      opinion?: string;
    };
    supportTeamLeader?: {
      name: string;
      date: number;
      signature?: string;
      opinion?: string;
    };
    storeManager?: {
      name: string;
      date: number;
      signature?: string;
      opinion?: string;
    };
  };
}

export interface Store {
  id: string;
  name: string;
  code: string; // 지점 접속 코드
  type?: 'DEPARTMENT' | 'OUTLET';
  managerPhones?: {
    salesTeamLeader?: string;
    supportTeamLeader?: string;
    storeManager?: string;
  };
}

export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  completed: boolean;
}

export interface Site {
  id: string;
  storeId: string;    // 소속 점포 ID
  name: string;
  floor: string;      // 층수 (예: 1F, B1)
  department: string; // 담당 부서 (예: 의류팀, 식음팀)
  location: string;   // 세부 위치
  startDate: string;  // 공사 시작일
  endDate: string;    // 공사 종료일
  status: '대기' | '진행중' | '완료';
  finalReport?: string; // AI가 작성한 최종 평가 요약
  managerPhones?: {
    SALES?: string[];
    SAFETY?: string[];
    FACILITY?: string[];
    SUPPORT?: string[];
    SALES_TL?: string[];
    SUPPORT_TL?: string[];
    STORE_MANAGER?: string[];
  };
}

export interface InspectionLog {
  id: string;
  siteId: string;
  siteName: string;
  workType: string;
  timestamp: number;
  photos: string[];
  riskLevel: RiskLevel;
  notes: string;
  inspector: string;
  inspectorRole: Role; // 점검 주체 (시설팀 vs 안전팀)
  checklist: {
    ppe: boolean;
    fireSafety: boolean;
    environment: boolean;
    electrical: boolean;
  };
  action?: {
    status: 'PENDING' | 'RESOLVED';
    resolvedAt?: number;
    actionNotes?: string;
    photoUrl?: string; // Legacy support
    resolvedPhotos?: string[]; // New: Multiple after photos
    aiFeedback?: string;
  };
}

export interface DashboardStats {
  completionRate: number;
  totalIssues: number;
  inspectedSites: number;
  totalSites: number;
}