import { generateUUID } from '../utils/uuid';

const STORAGE_KEY = 'salary_system_deductions';

// Load deductions from local storage
export const getDeductions = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

// Save a single deduction record (add or update)
export const saveDeduction = (deduction) => {
    const deductions = getDeductions();
    const index = deductions.findIndex(d => d.id === deduction.id);
    
    if (index >= 0) {
        deductions[index] = { ...deduction, updatedAt: new Date().toISOString() };
    } else {
        deductions.push({ ...deduction, id: deduction.id || generateUUID(), createdAt: new Date().toISOString() });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deductions));
    return deduction;
};

// Delete a deduction record
export const deleteDeduction = (id) => {
    const deductions = getDeductions();
    const filtered = deductions.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

// Import multiple deduction records
export const importDeductions = (newDeductions) => {
    const current = getDeductions();
    let count = 0;

    newDeductions.forEach(newItem => {
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

// Clear all deductions
export const clearDeductions = () => {
    localStorage.removeItem(STORAGE_KEY);
};
