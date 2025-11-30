
import React, { useState, useMemo, useEffect } from 'react';
import { Role, Site, InspectionLog, RiskLevel, Store } from './types';
import Dashboard from './components/Dashboard';
import FieldWork from './components/FieldWork';
import { LayoutDashboard, HardHat, Bell, Building2, ChevronRight, MapPin, ShieldCheck, LogOut, Lock, X, KeyRound, Store as StoreIcon, ArrowLeft, Search, ShoppingBag, Briefcase } from 'lucide-react';
import { subscribeToSites, subscribeToLogs, addSite, updateSite, deleteSite, addLog } from './services/firestore';

// --- Mock Data (초기 데이터) ---

interface ExtendedStore extends Store {
  type: 'DEPARTMENT' | 'OUTLET';
}

const MOCK_STORES: ExtendedStore[] = [
  // 백화점 (1111 ~ 1123)
  { id: 'dept-2', name: '압구정본점', code: '1111', type: 'DEPARTMENT' },
  { id: 'dept-3', name: '무역센터점', code: '1112', type: 'DEPARTMENT' },
  { id: 'dept-4', name: '천호점', code: '1113', type: 'DEPARTMENT' },
  { id: 'dept-5', name: '신촌점', code: '1114', type: 'DEPARTMENT' },
  { id: 'dept-6', name: '미아점', code: '1115', type: 'DEPARTMENT' },
  { id: 'dept-7', name: '목동점', code: '1116', type: 'DEPARTMENT' },
  { id: 'dept-8', name: '중동점', code: '1117', type: 'DEPARTMENT' },
  { id: 'dept-10', name: '킨텍스점', code: '1118', type: 'DEPARTMENT' },
  { id: 'dept-12', name: '울산점', code: '1119', type: 'DEPARTMENT' },
  { id: 'dept-11', name: '더현대 대구점', code: '1120', type: 'DEPARTMENT' },
  { id: 'dept-13', name: '충청점', code: '1121', type: 'DEPARTMENT' },
  { id: 'dept-9', name: '판교점', code: '1122', type: 'DEPARTMENT' },
  { id: 'dept-1', name: '더현대 서울', code: '1123', type: 'DEPARTMENT' },

  // 아울렛 (1124 ~ 1133)
  { id: 'outlet-1', name: '현대프리미엄아울렛 김포점', code: '1124', type: 'OUTLET' },
  { id: 'outlet-2', name: '현대프리미엄아울렛 송도점', code: '1125', type: 'OUTLET' },
  { id: 'outlet-3', name: '현대프리미엄아울렛 대전점', code: '1126', type: 'OUTLET' },
  { id: 'outlet-4', name: '현대프리미엄아울렛 SPACE1점', code: '1127', type: 'OUTLET' },
  { id: 'outlet-7', name: '현대아울렛 동대문점', code: '1128', type: 'OUTLET' },
  { id: 'outlet-9', name: '현대아울렛 가든파이브점', code: '1129', type: 'OUTLET' },
  { id: 'outlet-10', name: '현대아울렛 대구점', code: '1130', type: 'OUTLET' },
  { id: 'outlet-8', name: '현대아울렛 가산점', code: '1131', type: 'OUTLET' },
  { id: 'outlet-5', name: '커넥트현대 부산점', code: '1132', type: 'OUTLET' },
  { id: 'outlet-11', name: '커넥트현대 청주점', code: '1133', type: 'OUTLET' },
];

const App: React.FC = () => {
  // --- App Lock State (Global) ---
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const [entryCode, setEntryCode] = useState('');

  // --- Store Selection State ---
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [showStoreAuth, setShowStoreAuth] = useState<{ show: boolean, store: Store | null }>({ show: false, store: null });
  const [storeCodeInput, setStoreCodeInput] = useState('');
  const [storeSearchTerm, setStoreSearchTerm] = useState('');

  // --- Role & Data State ---
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [logs, setLogs] = useState<InspectionLog[]>([]);

  const [scannedSiteId, setScannedSiteId] = useState<string | null>(null);

  // Support Team Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // --- Firebase Subscriptions ---
  useEffect(() => {
    if (activeStore) {
      const unsubscribeSites = subscribeToSites(activeStore.id, (fetchedSites) => {
        setSites(fetchedSites);
      });
      const unsubscribeLogs = subscribeToLogs(activeStore.id, (fetchedLogs) => {
        setLogs(fetchedLogs);
      });
      return () => {
        unsubscribeSites();
        unsubscribeLogs();
      };
    } else {
      setSites([]);
      setLogs([]);
    }
  }, [activeStore]);

  // --- 1. Global App Unlock Handler ---
  const handleEntryCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryCode === '5119') {
      setIsAppUnlocked(true);
      setEntryCode('');
    } else {
      alert('접근 코드가 올바르지 않습니다.');
      setEntryCode('');
    }
  };

  // --- 2. Store Auth Handler ---
  const initiateStoreEntry = (store: Store) => {
    setShowStoreAuth({ show: true, store });
    setStoreCodeInput('');
  };

  const confirmStoreEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (showStoreAuth.store && storeCodeInput === showStoreAuth.store.code) {
      setActiveStore(showStoreAuth.store);
      setShowStoreAuth({ show: false, store: null });
      setStoreCodeInput('');
    } else {
      alert('지점 코드가 올바르지 않습니다.');
      setStoreCodeInput('');
    }
  };

  // --- Data Handlers ---
  const handleAddSite = async (newSite: Site) => {
    if (!activeStore) return;
    try {
      const { id, ...siteData } = newSite;
      await addSite({ ...siteData, storeId: activeStore.id });
    } catch (error) {
      console.error("Error adding site:", error);
      alert("공사 등록 중 오류가 발생했습니다.");
    }
  };

  const handleUpdateSite = async (updatedSite: Site) => {
    try {
      await updateSite(updatedSite);
    } catch (error: any) {
      console.error("Error updating site:", error);
      alert(`공사 수정 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    // Confirmation is handled in Dashboard component
    try {
      await deleteSite(siteId);
    } catch (error) {
      console.error("Error deleting site:", error);
      alert("공사 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleAddLog = async (logData: Omit<InspectionLog, 'id'>) => {
    if (!activeStore) return;
    try {
      await addLog(logData, activeStore.id);
      setScannedSiteId(null);
    } catch (error) {
      console.error("Error adding log:", error);
      alert("일지 등록 중 오류가 발생했습니다.");
    }
  };

  const handleSupportLogin = () => {
    if (passwordInput === '3449') {
      setCurrentRole(Role.SUPPORT);
      setShowPasswordModal(false);
      setPasswordInput('');
    } else {
      alert("비밀번호가 올바르지 않습니다.");
      setPasswordInput('');
    }
  };

  // --- Filtered Stores Logic ---
  const filteredStores = useMemo(() => {
    const term = storeSearchTerm.toLowerCase();
    return MOCK_STORES.filter(s => s.name.toLowerCase().includes(term));
  }, [storeSearchTerm]);

  const deptStores = filteredStores.filter(s => s.type === 'DEPARTMENT');
  const outletStores = filteredStores.filter(s => s.type === 'OUTLET');

  // --- Filtering Data by Store & Role ---

  // 1. Filter sites by Active Store
  const storeSites = sites.filter(s => activeStore && s.storeId === activeStore.id);

  // 2. Filter logs by the visible sites (implicitly filters by store)
  const storeLogs = logs.filter(l => storeSites.some(s => s.id === l.siteId));

  // 3. Filter sites for Field Workers (hide expired)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeDateSites = storeSites.filter(site => {
    const end = new Date(site.endDate);
    return end >= today;
  });

  const displaySites = (currentRole === Role.FACILITY || currentRole === Role.SAFETY || currentRole === Role.SALES) ? activeDateSites : storeSites;


  // --- RENDER: 0. Global Lock Screen ---
  if (!isAppUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans text-white">
        <div className="max-w-xs w-full flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-sm border border-white/10 shadow-2xl">
            <Building2 size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">SafetyGuard</h1>
          <p className="text-slate-400 text-sm mb-8 text-center">건설 현장 안전 관리 시스템<br />접근 코드를 입력하세요.</p>

          <form onSubmit={handleEntryCodeSubmit} className="w-full space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="text-white/30" size={20} />
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
                placeholder="PASSCODE"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal text-white"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"
            >
              시스템 접속
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: 1. Store Selection Screen ---
  if (!activeStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Header Area */}
        <div className="bg-white px-6 pt-12 pb-6 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">지점 선택</h1>
              <p className="text-slate-500 text-sm mt-1">관리하실 사업소를 선택해주세요.</p>
            </div>
            <button
              onClick={() => setIsAppUnlocked(false)}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"
            >
              <Lock size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-slate-400" size={18} />
            </div>
            <input
              type="text"
              placeholder="지점명 검색 (예: 판교, 김포)"
              value={storeSearchTerm}
              onChange={(e) => setStoreSearchTerm(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Scrollable List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {filteredStores.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              검색 결과가 없습니다.
            </div>
          )}

          {deptStores.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-3 flex items-center gap-2">
                <StoreIcon size={14} />
                백화점
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {deptStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => initiateStoreEntry(store)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-slate-900">{store.name}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {outletStores.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-3 flex items-center gap-2">
                <ShoppingBag size={14} />
                아울렛
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {outletStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => initiateStoreEntry(store)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-slate-900">{store.name}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-10"></div> {/* Spacer */}
        </div>

        {/* Store Access Code Modal */}
        {showStoreAuth.show && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-xl relative transform transition-all scale-100">
              <button
                onClick={() => setShowStoreAuth({ show: false, store: null })}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto bg-slate-900 text-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                  {showStoreAuth.store?.type === 'DEPARTMENT' ? <StoreIcon size={20} /> : <ShoppingBag size={20} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{showStoreAuth.store?.name}</h3>
                <p className="text-slate-500 text-xs mt-1">지점 보안 코드를 입력하세요.</p>
              </div>

              <form onSubmit={confirmStoreEntry} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={storeCodeInput}
                  onChange={(e) => setStoreCodeInput(e.target.value)}
                  placeholder="CODE"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-bold tracking-widest focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors"
                >
                  입장하기
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER: 2. Role Selection Screen (Within Store) ---
  if (!currentRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setActiveStore(null)}
              className="mb-6 flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft size={12} /> 지점 변경
            </button>

            <h1 className="text-3xl font-bold text-slate-900">{activeStore.name}</h1>
            <p className="text-slate-500 text-sm mt-1">안전 통합 관리 시스템</p>
          </div>

          <div className="space-y-3 mt-6">
            <button
              onClick={() => setCurrentRole(Role.FACILITY)}
              className="w-full bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-blue-500 hover:shadow-md transition-all group text-left flex items-center gap-4"
            >
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <HardHat size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700">시설관리 (현장점검)</h3>
                <p className="text-slate-400 text-sm">설비 확인 및 작업 현장 점검</p>
              </div>
              <ChevronRight className="ml-auto text-slate-300" />
            </button>

            <button
              onClick={() => setCurrentRole(Role.SAFETY)}
              className="w-full bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-emerald-500 hover:shadow-md transition-all group text-left flex items-center gap-4"
            >
              <div className="bg-emerald-100 text-emerald-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-700">안전관리 (현장점검)</h3>
                <p className="text-slate-400 text-sm">위험 요소 확인 및 안전 수칙 점검</p>
              </div>
              <ChevronRight className="ml-auto text-slate-300" />
            </button>

            <button
              onClick={() => setCurrentRole(Role.SALES)}
              className="w-full bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-purple-500 hover:shadow-md transition-all group text-left flex items-center gap-4"
            >
              <div className="bg-purple-100 text-purple-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <Briefcase size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-purple-700">영업관리 (현장점검)</h3>
                <p className="text-slate-400 text-sm">공사 현장 점검 및 특이사항 확인</p>
              </div>
              <ChevronRight className="ml-auto text-slate-300" />
            </button>

            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordInput('');
              }}
              className="w-full bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-slate-500 hover:shadow-md transition-all group text-left flex items-center gap-4"
            >
              <div className="bg-slate-100 text-slate-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <LayoutDashboard size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-slate-900">지원팀 (통합관제)</h3>
                <p className="text-slate-400 text-sm">{activeStore.name} 현장 관리</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Lock size={16} className="text-slate-300" />
                <ChevronRight className="text-slate-300" />
              </div>
            </button>
          </div>
        </div>

        {/* Support Team Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl transform transition-all scale-100 relative">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 mb-4">
                  <Lock size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">관리자 접근 승인</h3>
                <p className="text-slate-500 text-xs mt-1">{activeStore.name} 관제실 접근을 위해<br />보안 암호를 입력해주세요.</p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSupportLogin()}
                  placeholder="암호 입력"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-bold tracking-widest focus:ring-2 focus:ring-slate-900 outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSupportLogin}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-colors"
                >
                  로그인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER: 3. Main App UI ---
  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-900">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-white shadow-md transition-colors 
            ${currentRole === Role.SUPPORT ? 'bg-slate-800' :
              currentRole === Role.SAFETY ? 'bg-emerald-600' :
                currentRole === Role.SALES ? 'bg-purple-600' : 'bg-blue-600'}`}>
            {currentRole === Role.SUPPORT ? <Building2 size={20} /> :
              currentRole === Role.SAFETY ? <ShieldCheck size={20} /> :
                currentRole === Role.SALES ? <Briefcase size={20} /> : <HardHat size={20} />}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight text-lg">{activeStore.name}</h1>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
              {currentRole === Role.SUPPORT ? '통합 관제 센터' :
                currentRole === Role.SAFETY ? '안전관리 현장점검' :
                  currentRole === Role.SALES ? '영업관리 현장점검' : '시설관리 현장점검'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentRole === Role.SUPPORT && (
            <div className="relative p-2 text-slate-500">
              <Bell size={20} />
              {storeLogs.some(l => l.riskLevel === RiskLevel.WARNING && new Date(l.timestamp).toDateString() === new Date().toDateString()) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              )}
            </div>
          )}
          <button
            onClick={() => { setCurrentRole(null); setScannedSiteId(null); }}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm"
            title="뒤로가기"
          >
            <ArrowLeft size={18} />
            <span>뒤로가기</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto min-h-[calc(100vh-70px)]">

        {/* --- 현장 점검 화면 (시설/안전/영업) --- */}
        {(currentRole === Role.FACILITY || currentRole === Role.SAFETY || currentRole === Role.SALES) && (
          <>
            {!scannedSiteId ? (
              <div className="p-4 animate-in slide-in-from-bottom-4">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800">
                    {currentRole === Role.FACILITY ? '시설 점검 현장' :
                      currentRole === Role.SAFETY ? '안전 점검 현장' : '영업 점검 현장'}
                  </h2>
                  <p className="text-sm text-slate-500">{activeStore.name} 진행 중 공사 목록입니다.</p>
                </div>

                <div className="space-y-3">
                  {displaySites.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-slate-100 rounded-xl flex flex-col items-center gap-2">
                      <Building2 className="opacity-20" size={40} />
                      <span>진행 중인 공사 현장이 없습니다.</span>
                    </div>
                  ) : (
                    displaySites.map(site => (
                      <button
                        key={site.id}
                        onClick={() => setScannedSiteId(site.id)}
                        className="w-full bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between active:scale-[0.99] transition-all hover:border-blue-300 group"
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-colors
                                                ${currentRole === Role.SAFETY ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' :
                              currentRole === Role.SALES ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100' :
                                'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'}
                                            `}>
                            {site.floor}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{site.name}</h3>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span className="flex items-center gap-1"><MapPin size={10} /> {site.department}</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span>{site.startDate} ~ {site.endDate}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <FieldWork
                siteId={scannedSiteId}
                sites={storeSites}
                currentRole={currentRole}
                onSubmitInspection={handleAddLog}
                onCancel={() => setScannedSiteId(null)}
              />
            )}
          </>
        )}

        {/* --- 관제 화면 (지원팀) --- */}
        {currentRole === Role.SUPPORT && (
          <Dashboard
            logs={storeLogs}
            sites={storeSites}
            onAddSite={handleAddSite}
            onUpdateSite={handleUpdateSite}
            onDeleteSite={handleDeleteSite}
            storeName={activeStore.name}
          />
        )}

      </main>

    </div>
  );
};

export default App;
