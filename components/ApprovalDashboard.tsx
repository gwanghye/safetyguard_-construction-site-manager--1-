import React, { useState } from 'react';
import { Store, RiskAssessmentLog, RiskAssessmentStatus, Site, Role } from '../types';
import { updateRiskAssessment } from '../services/firestore';
import { RiskAssessment } from './RiskAssessment';
import { FileCheck2, UserCheck, ShieldCheck, ChevronRight, MapPin, Building2, Download } from 'lucide-react';
import { sendAssessmentApprovalAlert } from '../services/notification';

export type ApproverRole = 'SALES_TL' | 'SUPPORT_TL' | 'STORE_MANAGER';

interface ApprovalDashboardProps {
  store: Store;
  sites: Site[];
  assessments: RiskAssessmentLog[];
  approverRole: ApproverRole;
  onExit: () => void;
}

export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({ store, sites, assessments, approverRole, onExit }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessmentLog | null>(null);

  // Filter logic
  const getPendingStatus = () => {
    switch (approverRole) {
      case 'SALES_TL': return RiskAssessmentStatus.PENDING_SALES_TL;
      case 'SUPPORT_TL': return RiskAssessmentStatus.PENDING_SUPPORT_TL;
      case 'STORE_MANAGER': return RiskAssessmentStatus.PENDING_STORE_MGR;
    }
  };

  const getRoleName = () => {
    switch (approverRole) {
      case 'SALES_TL': return '영업팀장';
      case 'SUPPORT_TL': return '지원팀장';
      case 'STORE_MANAGER': return '점장(안전책임자)';
    }
  };

  const pendingAssessments = assessments.filter(a => a.status === getPendingStatus());
  
  // Completed means it's past your stage
  const completedAssessments = assessments.filter(a => {
    if (approverRole === 'SALES_TL') {
       return [RiskAssessmentStatus.PENDING_SUPPORT_TL, RiskAssessmentStatus.PENDING_STORE_MGR, RiskAssessmentStatus.APPROVED].includes(a.status);
    }
    if (approverRole === 'SUPPORT_TL') {
       return [RiskAssessmentStatus.PENDING_STORE_MGR, RiskAssessmentStatus.APPROVED].includes(a.status);
    }
    return a.status === RiskAssessmentStatus.APPROVED;
  });

  const displayList = activeTab === 'pending' ? pendingAssessments : completedAssessments;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" />
            수시위험성평가 결재함
          </h1>
          <p className="text-sm text-slate-500 font-medium">{store.name} | {getRoleName()}</p>
        </div>
        <button onClick={onExit} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200">
          종료
        </button>
      </header>

      {selectedAssessment ? (
        <div className="flex-1 bg-white relative">
            <RiskAssessment 
              site={sites.find(s => s.id === selectedAssessment.siteId)!}
              currentRole={Role.SUPPORT} // Use support role to view all data without edit fields
              existingAssessment={selectedAssessment}
              approverMode={approverRole}
              onBack={() => setSelectedAssessment(null)}
              storeName={store.name}
            />
        </div>
      ) : (
        <main className="max-w-4xl mx-auto w-full p-6">
          <div className="flex gap-4 mb-6">
             <button 
               onClick={() => setActiveTab('pending')}
               className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
             >
               결재 대기 ({pendingAssessments.length})
             </button>
             <button 
               onClick={() => setActiveTab('completed')}
               className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'completed' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
             >
               처리 완료 / 우리 지점 보관함
             </button>
          </div>

          <div className="space-y-4">
             {displayList.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                   <FileCheck2 size={48} className="mx-auto text-slate-300 mb-4" />
                   <h3 className="text-lg font-bold text-slate-700 mb-1">
                     {activeTab === 'pending' ? '결재할 문서가 없습니다.' : '보관된 문서가 없습니다.'}
                   </h3>
                </div>
             ) : (
                displayList.map(assessment => {
                   const site = sites.find(s => s.id === assessment.siteId);
                   return (
                     <div key={assessment.id} onClick={() => setSelectedAssessment(assessment)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-inner
                              ${assessment.status === RiskAssessmentStatus.APPROVED ? 'bg-emerald-500' : 
                                assessment.status === getPendingStatus() ? 'bg-blue-500' : 'bg-slate-400'}`}>
                             {assessment.status === RiskAssessmentStatus.APPROVED ? <CheckCircle2 size={24} /> : <FileCheck2 size={24} />}
                           </div>
                           <div>
                             <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {site ? site.name : assessment.siteName} 
                             </h3>
                             <div className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                               <UserCheck size={14} /> {assessment.department || '영업부'} | {assessment.authorName || '작성자'}
                               <span className="text-slate-300">|</span>
                               <span>{new Date(assessment.timestamp).toLocaleDateString()}</span>
                               <span className="text-slate-300">|</span>
                               <span className={assessment.status === RiskAssessmentStatus.APPROVED ? 'text-emerald-600' : 'text-blue-600'}>
                                  {assessment.status === RiskAssessmentStatus.APPROVED ? '최종완료' : '진행중'}
                               </span>
                             </div>
                           </div>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
                     </div>
                   );
                })
             )}
          </div>
        </main>
      )}
    </div>
  );
};

// SVG component missing from imports
const CheckCircle2 = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
