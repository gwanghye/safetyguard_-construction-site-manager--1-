export interface OfflineAction {
  id: string;
  type: 'ADD_LOG' | 'ADD_RISK_ASSESSMENT' | 'UPDATE_LOG';
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = 'safetyguard_offline_queue';

export const saveOfflineAction = (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
  const actions = getOfflineActions();
  actions.push({
    ...action,
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    timestamp: Date.now()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
};

export const getOfflineActions = (): OfflineAction[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const clearOfflineActions = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const removeOfflineAction = (id: string) => {
  const actions = getOfflineActions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions.filter(a => a.id !== id)));
};
