import { generateUUID } from '../utils/uuid';
import { getPeriod } from './periodStore';

const BASE_KEY = 'salary_system_records';

const getStorageKey = (period = getPeriod()) => `${BASE_KEY}_${period}`;

// Load records from local storage
export const getRecords = (period) => {
    const key = getStorageKey(period);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

// Save multiple records (replace or add)
export const saveRecords = (newRecords) => {
    // newRecords structure: [ { empId, b, g, s, missed }, ... ]
    const period = getPeriod();
    const key = getStorageKey(period);
    const current = getRecords(period);
    
    newRecords.forEach(newItem => {
        const index = current.findIndex(c => c.empId === newItem.empId);
        if (index >= 0) {
            current[index] = { ...current[index], ...newItem, updatedAt: new Date().toISOString() };
        } else {
            current.push({ ...newItem, id: generateUUID(), updatedAt: new Date().toISOString() });
        }
    });

    localStorage.setItem(key, JSON.stringify(current));
    return current;
};

// Clear all records
export const clearRecords = () => {
    const period = getPeriod();
    const key = getStorageKey(period);
    localStorage.removeItem(key);
};
