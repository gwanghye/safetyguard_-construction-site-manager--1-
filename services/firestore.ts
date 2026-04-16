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

        // Sort client-side to avoid Firestore composite index requirement
        logs.sort((a, b) => b.timestamp - a.timestamp);

        callback(logs);
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
    const q = query(collection(db, 'sites'));
    return onSnapshot(q, (snapshot) => {
        const sites = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as Site[];
        callback(sites);
    });
};

export const subscribeToAllLogs = (callback: (logs: InspectionLog[]) => void) => {
    const q = query(collection(db, 'logs'));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as InspectionLog[];
        logs.sort((a, b) => b.timestamp - a.timestamp);
        callback(logs);
    });
};

export const subscribeToAllRiskAssessments = (callback: (assessments: RiskAssessmentLog[]) => void) => {
    const q = query(collection(db, 'riskAssessments'));
    return onSnapshot(q, (snapshot) => {
        const assessments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as RiskAssessmentLog[];
        assessments.sort((a, b) => b.timestamp - a.timestamp);
        callback(assessments);
    });
};
