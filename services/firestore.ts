import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Site, InspectionLog, RiskAssessmentLog } from '../types';

// --- Sites Service ---

export const subscribeToSites = (storeId: string, callback: (sites: Site[]) => void) => {
    if (!storeId) return () => { };

    const q = query(
        collection(db, 'sites'),
        where('storeId', '==', storeId)
    );

    return onSnapshot(q, (snapshot) => {
        const sites = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as Site[];
        callback(sites);
    });
};

export const addSite = async (site: Omit<Site, 'id'>) => {
    await addDoc(collection(db, 'sites'), site);
};

export const updateSite = async (site: Site) => {
    const siteRef = doc(db, 'sites', site.id);
    const { id, ...data } = site;
    await updateDoc(siteRef, data);
};

export const deleteSite = async (siteId: string) => {
    await deleteDoc(doc(db, 'sites', siteId));
};

// --- Logs Service ---

export const subscribeToLogs = (storeId: string, callback: (logs: InspectionLog[]) => void) => {
    // Note: Ideally we should filter logs by storeId if logs had a storeId field.
    // Currently logs are linked to sites, and sites are linked to stores.
    // For simplicity, we'll fetch all logs and filter client-side or add storeId to logs.
    // To make it efficient, let's assume we want to query logs for the *sites* in this store.
    // However, Firestore 'in' query is limited to 10 items.
    // A better approach for this app: Add 'storeId' to InspectionLog.

    // For now, let's query all logs (assuming small scale) or add storeId to logs in the app logic.
    // Let's update the app to include storeId in logs for easier querying.

    if (!storeId) return () => { };

    const q = query(
        collection(db, 'logs'),
        where('storeId', '==', storeId)
    );

    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as InspectionLog[];

        // 모든 과거 기록을 볼 수 있도록 제한 없이 정렬만 수행
        logs.sort((a, b) => b.timestamp - a.timestamp);
        callback(logs);
    }, (error) => {
        console.error("Error subscribing to store logs:", error);
    });
};

export const addLog = async (log: Omit<InspectionLog, 'id'>, storeId: string) => {
    await addDoc(collection(db, 'logs'), {
        ...log,
        storeId, // Add storeId for filtering
        timestamp: Date.now() // Ensure timestamp is number
    });
};

export const updateLog = async (log: InspectionLog) => {
    const logRef = doc(db, 'logs', log.id);
    const { id, ...data } = log;
    await updateDoc(logRef, data);
};

// --- Risk Assessment Service ---

export const subscribeToRiskAssessments = (storeId: string, callback: (assessments: RiskAssessmentLog[]) => void) => {
    if (!storeId) return () => { };

    const q = query(
        collection(db, 'riskAssessments'),
        where('storeId', '==', storeId)
    );

    return onSnapshot(q, (snapshot) => {
        const assessments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as RiskAssessmentLog[];

        assessments.sort((a, b) => b.timestamp - a.timestamp);
        callback(assessments);
    });
};

export const addRiskAssessment = async (assessment: Omit<RiskAssessmentLog, 'id'>, storeId: string) => {
    await addDoc(collection(db, 'riskAssessments'), {
        ...assessment,
        storeId,
        timestamp: Date.now()
    });
};

export const updateRiskAssessment = async (assessment: RiskAssessmentLog) => {
    const assessRef = doc(db, 'riskAssessments', assessment.id);
    const { id, ...data } = assessment;
    await updateDoc(assessRef, data);
};

// --- Global Services for HQ Dashboard ---

export const subscribeToAllSites = (callback: (sites: Site[]) => void) => {
    // 공사 현장은 전체 리스트가 필요하므로 최신순 정렬 (인덱스 없을 시 Fallback 추가)
    const q = query(collection(db, 'sites'), orderBy('startDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const sites = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as Site[];
        callback(sites);
    }, (error) => {
        console.error("Error subscribing to all sites (Index missing):", error);
        // 인덱스 에러 시 단순 쿼리로 조회 후 클라이언트에서 직접 정렬
        const fallbackQ = query(collection(db, 'sites'));
        onSnapshot(fallbackQ, (snapshot) => {
            const sites = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Site[];
            sites.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
            callback(sites);
        });
    });
};

export const subscribeToAllLogs = (callback: (logs: InspectionLog[]) => void) => {
    // 스토리지 도입으로 데이터 용량이 감소하여 1년치 조회가 가능해졌습니다.
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, 'logs'),
        where('timestamp', '>=', oneYearAgo)
    );
    
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as InspectionLog[];
        
        logs.sort((a, b) => b.timestamp - a.timestamp);
        callback(logs);
    }, (error) => {
        console.error("Error subscribing to all logs:", error);
        const fallbackQ = query(collection(db, 'logs'));
        onSnapshot(fallbackQ, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InspectionLog[];
            logs.sort((a, b) => b.timestamp - a.timestamp);
            callback(logs);
        });
    });
};

export const subscribeToAllRiskAssessments = (callback: (assessments: RiskAssessmentLog[]) => void) => {
    // 위험성평가도 최근 180일치만 기본 로드 (아카이브 제외)
    const halfYearAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, 'riskAssessments'),
        where('timestamp', '>=', halfYearAgo),
        orderBy('timestamp', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const assessments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as RiskAssessmentLog[];
        callback(assessments);
    }, (error) => {
        console.error("Error subscribing to all assessments:", error);
        const fallbackQ = query(collection(db, 'riskAssessments'), orderBy('timestamp', 'desc'));
        onSnapshot(fallbackQ, (snapshot) => {
            const assessments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RiskAssessmentLog[];
            callback(assessments);
        });
    });
};
