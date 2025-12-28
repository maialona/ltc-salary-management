import { generateUUID } from '../utils/uuid';

const STORAGE_KEY = 'salary_system_bonuses';

// Load bonuses from local storage
export const getBonuses = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

// Save a single bonus record (add or update)
export const saveBonus = (bonus) => {
    const bonuses = getBonuses();
    const index = bonuses.findIndex(b => b.id === bonus.id);
    
    if (index >= 0) {
        bonuses[index] = { ...bonus, updatedAt: new Date().toISOString() };
    } else {
        bonuses.push({ ...bonus, id: bonus.id || generateUUID(), createdAt: new Date().toISOString() });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bonuses));
    return bonus;
};

// Delete a bonus record
export const deleteBonus = (id) => {
    const bonuses = getBonuses();
    const filtered = bonuses.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

// Import multiple bonus records
export const importBonuses = (newBonuses) => {
    const current = getBonuses();
    let count = 0;

    newBonuses.forEach(newItem => {
        // Try to find existing record by empId to update, otherwise add new
        const existingIndex = current.findIndex(c => c.empId === newItem.empId);
        
        const record = {
            ...newItem,
            id: existingIndex >= 0 ? current[existingIndex].id : generateUUID(),
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            current[existingIndex] = record;
        } else {
            current.push(record);
        }
        count++;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return { count };
};

// Clear all bonuses
export const clearBonuses = () => {
    localStorage.removeItem(STORAGE_KEY);
};
