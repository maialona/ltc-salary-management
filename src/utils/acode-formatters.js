export const normalizeDate = (rawDate) => {
    if (!rawDate) return "";
    if (typeof rawDate === 'number') {
        const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0].replace(/-/g, '/');
    }
    let strDate = String(rawDate).trim();
    if (strDate.includes('/')) {
        const parts = strDate.split('/');
        if (parts.length >= 3) {
            const p0 = parts[0].trim();
            const p1 = parts[1].trim().padStart(2, '0');
            const p2 = parts[2].trim().padStart(2, '0');
            if (p0.length < 4) { 
                const year = parseInt(p0) + 1911;
                return `${year}/${p1}/${p2}`;
            }
            return `${p0}/${p1}/${p2}`;
        }
    }
    return strDate;
};

export const cleanName = (name) => {
    if (!name) return "未知";
    return String(name).replace(/\s+/g, '').trim();
};

export const parseTimeRange = (rawTime) => {
    const result = { start: 0, end: 0 };
    if (rawTime === undefined || rawTime === null || rawTime === '') return result;

    // Helper: Convert "HH:mm" or "HHmm" to minutes
    const toMinutes = (s) => {
        if (!s) return 0;
        const clean = s.toString().replace(/[^0-9]/g, ''); // Keep only digits
        if (clean.length === 4) {
            const hh = parseInt(clean.substring(0, 2));
            const mm = parseInt(clean.substring(2, 4));
            return hh * 60 + mm;
        }
        return 0;
    };

    // Handle Excel fractional day (e.g. 0.83333) - treat as Start Time, End Time unknown (0)
    if (typeof rawTime === 'number') {
        result.start = Math.round(rawTime * 24 * 60);
        return result;
    }

    const str = String(rawTime).trim();
    
    // Split by common separators: ~, -, or space
    // Example: "19:35~20:05", "1935-2005", "19:35 20:05"
    const parts = str.split(/[~ \-]/).filter(p => p.trim().length > 0);
    
    if (parts.length >= 2) {
        result.start = toMinutes(parts[0]);
        result.end = toMinutes(parts[parts.length - 1]); // Take the last part as end
    } else if (parts.length === 1) {
        result.start = toMinutes(parts[0]);
    }
    
    return result;
};
