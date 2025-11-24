
export enum RiskLevel {
  NORMAL = '정상',
  CAUTION = '주의',
  WARNING = '경고'
}

export enum Role {
  FACILITY = 'FACILITY', // 시설팀 (설비 점검)
  SAFETY = 'SAFETY',     // 안전팀 (안전 수칙 점검)
  SUPPORT = 'SUPPORT'    // 지원팀 (중앙 관제)
}

export interface Store {
  id: string;
  name: string;
  code: string; // 지점 접속 코드
  type?: 'DEPARTMENT' | 'OUTLET';
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
}

export interface DashboardStats {
  completionRate: number;
  totalIssues: number;
  inspectedSites: number;
  totalSites: number;
}