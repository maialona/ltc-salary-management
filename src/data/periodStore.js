// Vanilla JS Store for Period Management
// Creating a simple event-based store to avoid adding new dependencies if possible, or just a simple module with listeners.
// Since other stores are simple modules exporting functions, I will do the same but add a listener mechanism for React components.

let currentPeriod = localStorage.getItem('salary_period') || new Date().toISOString().slice(0, 7); // YYYY-MM
const listeners = new Set();

export const getPeriod = () => currentPeriod;

export const setPeriod = (newPeriod) => {
    if (newPeriod === currentPeriod) return;
    currentPeriod = newPeriod;
    localStorage.setItem('salary_period', currentPeriod);
    listeners.forEach(l => l(currentPeriod));
};

export const subscribePeriod = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// Helper for prev/next month
export const offsetPeriod = (months) => {
    const [year, month] = currentPeriod.split('-').map(Number);
    const date = new Date(year, month - 1 + months, 1); // JS months are 0-indexed
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setPeriod(`${y}-${m}`);
};
