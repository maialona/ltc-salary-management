import { normalizeDate, cleanName, parseTimeRange } from './acode-formatters';
import { readExcel } from './acode-excel';
import { CODE_RULES } from '../constants/acode-rules';

export const validateColumns = (fileHeaders) => {
    const missing = [];
    const check = (type, name, required) => {
        const headers = fileHeaders[type];
        if (!headers) return; // Skip validation if headers for this type are not provided (allows partial validation)
        
        required.forEach(req => {
            const found = headers.some(h => h.includes(req));
            if (!found) missing.push(`${name} 缺少欄位: "${req}" (目前欄位: ${headers.join(', ')})`);
        });
    };
    check('serviceRecord', '服務紀錄表', ['服務日期', '服務個案', '服務人員', '服務代碼', '服務時間']); 
    check('govRecord', 'A碼清冊', ['服務日期', '個案姓名', '服務代碼', '數量', '小計', '序號', '督導']); 
    check('staffList', '人員名冊', ['員編', '姓名', '職級']);
    return missing;
};

export const processData = async (files, updateProgress) => {
    updateProgress("正在讀取檔案...");
    
    // Handle staffList: it can be a File (legacy) or raw JSON array (stored roster)
    let staffRaw;
    if (files.staffList instanceof File) {
        const result = await readExcel(files.staffList);
        staffRaw = result.json;
    } else if (Array.isArray(files.staffList)) {
        staffRaw = files.staffList;
    } else {
        throw new Error("人員名冊格式錯誤");
    }

    const staffMap = {}; 
    staffRaw.forEach(row => {
        const name = cleanName(row['姓名'] || row['服務人員'] || row['員工姓名']);
        const id = String(row['員編'] || row['員工編號'] || '').trim();
        const role = String(row['職級'] || row['身分'] || row['職務']).includes('正職') ? 'full' : 'part';
        staffMap[name] = { role, id };
    });

    updateProgress("正在分析排班紀錄...");
    await new Promise(r => setTimeout(r, 50));
    const { json: serviceRaw } = await readExcel(files.serviceRecord);
    const serviceData = {}; 
    const monthlyServiceMap = {}; 
    const debugServiceKeys = [];
    
    serviceRaw.forEach((row, idx) => {
        const date = normalizeDate(row['服務日期'] || row['日期']);
        const client = cleanName(row['服務個案'] || row['個案姓名'] || row['個案']);
        const worker = cleanName(row['服務人員'] || row['居服員'] || row['員工']);
        const serviceCode = String(row['服務代碼'] || '').toUpperCase();
        const timeObj = parseTimeRange(row['服務時間'] || row['時間'] || row['開始時間']);
        
        if (date && client && worker) {
            const key = `${date}_${client}`;
            if (!serviceData[key]) {
                serviceData[key] = { workers: new Set(), details: [] };
            }
            serviceData[key].workers.add(worker);
            serviceData[key].details.push({ worker, code: serviceCode, time: timeObj });
            
            const month = date.substring(0, 7); 
            const monthKey = `${month}_${client}`;
            if (!monthlyServiceMap[monthKey]) {
                monthlyServiceMap[monthKey] = new Set();
            }
            monthlyServiceMap[monthKey].add(worker);

            if (idx < 5) debugServiceKeys.push(key);
        }
    });

    updateProgress("正在比對衛福部清冊...");
    await new Promise(r => setTimeout(r, 50));
    
    const { json: govRaw } = await readExcel(files.govRecord);
    const results = [];
    const errorLogs = [];
    const debugGovKeys = [];
    let totalInputRevenue = 0;
    let totalAllocatedRevenue = 0; 
    const summaryAggregator = {};

    const CHUNK_SIZE = 500; 
    
    for (let i = 0; i < govRaw.length; i += CHUNK_SIZE) {
        const chunk = govRaw.slice(i, i + CHUNK_SIZE);
        
        updateProgress(`正在計算第 ${i + 1} ~ ${Math.min(i + CHUNK_SIZE, govRaw.length)} 筆資料...`);
        
        await new Promise(resolve => setTimeout(resolve, 50)); 

        chunk.forEach((row) => {
            const rawDateStr = String(row['服務日期'] || row['日期'] || '');
            const client = cleanName(row['個案姓名'] || row['姓名']);
            const code = (row['服務代碼'] || row['碼別'] || row['項目'] || row['服務項目'] || '').trim().toUpperCase();
            const serialNum = String(row['序號'] || row['No'] || row['流水號'] || '').trim();
            const supervisor = (row['督導'] || row['督導員'] || '').trim();
            
            const totalQty = parseFloat(row['數量'] || 0);
            const totalSubtotal = parseFloat(row['小計'] || row['金額'] || 0);
            
            totalInputRevenue += totalSubtotal;

            let dateList = [];
            if (typeof row['服務日期'] === 'number') {
                dateList = [normalizeDate(row['服務日期'])];
            } else {
                dateList = rawDateStr.split(',').map(d => normalizeDate(d.trim())).filter(d => d);
            }

            if (dateList.length === 0) return;

            let rowRevenue = totalSubtotal;
            if (rowRevenue === 0) {
                const listedPrice = parseFloat(row['給付價格'] || 0);
                if (listedPrice > 0) {
                    rowRevenue = listedPrice * (totalQty || dateList.length);
                }
            }

            const revenuePerDate = rowRevenue / dateList.length;
            const qtyPerDate = (totalQty > 0 ? totalQty : dateList.length) / dateList.length;
            const unitPriceDisplay = totalQty > 0 ? (rowRevenue / totalQty) : 0;

            dateList.forEach(date => {
                const key = `${date}_${client}`;
                if (debugGovKeys.length < 5) debugGovKeys.push(key);

                let targetWorkers = [];
                let assignmentNote = '';
                let isMatched = false;

                if (code === 'AA07') {
                    const month = date.substring(0, 7);
                    const monthKey = `${month}_${client}`;
                    const monthWorkers = monthlyServiceMap[monthKey];
                    if (monthWorkers && monthWorkers.size > 0) {
                        targetWorkers = Array.from(monthWorkers);
                        assignmentNote = '全月均分(AA07)';
                        isMatched = true;
                    }
                } else {
                    const serviceEntry = serviceData[key];
                    if (serviceEntry && serviceEntry.workers.size > 0) {
                        isMatched = true;
                        let dailyWorkers = Array.from(serviceEntry.workers);
                        if (code === 'AA06') {
                            const baWorkers = new Set();
                            serviceEntry.details.forEach(detail => {
                                if (detail.code.includes('BA01') || detail.code.includes('BA07')) {
                                    baWorkers.add(detail.worker);
                                }
                            });
                            if (baWorkers.size > 0) {
                                dailyWorkers = Array.from(baWorkers);
                                assignmentNote = '指定分配(BA01/07)';
                            } else {
                                assignmentNote = '無BA01/07，當日均分';
                            }
                        } else if (code === 'AA08') {
                            const nightWorkers = new Set();
                            serviceEntry.details.forEach(detail => {
                                if (detail.time && detail.time.end > 1200) {
                                    nightWorkers.add(detail.worker);
                                }
                            });
                            
                            if (nightWorkers.size > 0) {
                                dailyWorkers = Array.from(nightWorkers);
                                assignmentNote = '夜間服務(結束>20:00)';
                            } else {
                                dailyWorkers = []; 
                                assignmentNote = '無符合夜間(結束>20:00)人員';
                            }
                        } else if (dailyWorkers.length > 1) {
                            assignmentNote = '共案';
                        }
                        targetWorkers = dailyWorkers;
                    }
                }

                if (!isMatched || targetWorkers.length === 0) {
                    errorLogs.push(`無法媒合: ${date} 個案-${client} (代碼:${code})`);
                    results.push({
                        serialNum: serialNum,
                        date, client, code, 
                        price: parseFloat(unitPriceDisplay.toFixed(2)), 
                        qty: parseFloat(qtyPerDate.toFixed(14)), 
                        worker: '未媒合',
                        role: '未知',
                        splitRatio: 0,
                        revenueAllocated: 0,
                        amount: 0,
                        supervisor,
                        note: code === 'AA07' ? '該月無服務紀錄' : '該日無服務紀錄'
                    });
                } else {
                    const workerCount = targetWorkers.length;
                    const revenuePerWorker = revenuePerDate / workerCount;
                    const splitQty = parseFloat((qtyPerDate / workerCount).toFixed(14));

                    targetWorkers.forEach(worker => {
                        const staffInfo = staffMap[worker] || { role: 'part', id: '' };
                        const role = staffInfo.role;
                        const rule = CODE_RULES[code];
                        let commissionRate = 0.6;
                        if (rule) commissionRate = (role === 'full') ? rule.full : rule.part;

                        const rawCommission = revenuePerWorker * commissionRate;
                        const displayAmount = Math.round(rawCommission);
                        
                        totalAllocatedRevenue += revenuePerWorker; 
                        
                        results.push({
                            serialNum: serialNum,
                            date, client, code, worker,
                            workerId: staffInfo.id,
                            role: role === 'full' ? '正職' : '兼職',
                            price: parseFloat(unitPriceDisplay.toFixed(2)),
                            qty: splitQty, 
                            commissionRate: `${(commissionRate * 100).toFixed(0)}%`,
                            revenueAllocated: parseFloat(revenuePerWorker.toFixed(2)),
                            amount: displayAmount, 
                            rawCommission: rawCommission,
                            supervisor,
                            note: assignmentNote
                        });

                        if (!summaryAggregator[worker]) summaryAggregator[worker] = { details: {} };
                        if (!summaryAggregator[worker].details[code]) summaryAggregator[worker].details[code] = 0;
                        summaryAggregator[worker].details[code] += rawCommission;
                    });
                }
            });
        });
    }

    const finalSummary = Object.keys(summaryAggregator).map(worker => {
        let totalCommission = 0;
        
        const workerResults = results.filter(r => r.worker === worker);
        
        const groupMap = {};
        workerResults.forEach(r => {
            const key = `${r.client}_${r.code}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    client: r.client,
                    code: r.code,
                    qty: 0,
                    subtotal: 0, 
                    amount: 0,
                    supervisor: r.supervisor
                };
            }
            groupMap[key].qty += r.qty;
            groupMap[key].subtotal += r.revenueAllocated;
            groupMap[key].amount += r.amount;
        });

        const sortedDetails = Object.values(groupMap).sort((a, b) => a.client.localeCompare(b.client));
        
        totalCommission = sortedDetails.reduce((sum, item) => sum + item.amount, 0);

        return {
            name: worker,
            id: staffMap[worker]?.id || '',
            totalCommission: totalCommission,
            details: sortedDetails
        };
    }).sort((a, b) => {
        const idA = a.id || '';
        const idB = b.id || '';
        return idA.localeCompare(idB, undefined, { numeric: true });
    });

    return {
        results,
        finalSummary,
        errors: errorLogs,
        debugInfo: {
            govRows: govRaw.length,
            resultCount: results.length,
            matchRate: results.length > 0 ? ((results.filter(r => r.worker !== '未媒合').length / results.length) * 100).toFixed(1) + '%' : '0%',
            sampleServiceKeys: debugServiceKeys,
            sampleGovKeys: debugGovKeys,
            totalInput: Math.round(totalInputRevenue),
            totalAllocated: Math.round(totalAllocatedRevenue),
            diff: Math.round(totalAllocatedRevenue - totalInputRevenue),
            totalCommissionPaid: finalSummary.reduce((sum, p) => sum + p.totalCommission, 0)
        }
    };
};
