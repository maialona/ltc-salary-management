const triggerDownload = (buffer, filename, mimeType) => {
  const blob = new Blob([buffer], {
    type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 建立一次性 worker 執行匯出，回傳 Promise<void>
// 匯出期間主執行緒完全不凍結（workbook 建構 + writeBuffer 在 worker 中完成）
export const runExcelExport = (type, payload) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/excel.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) {
        reject(new Error(data.error));
      } else {
        triggerDownload(data.buffer, data.filename, data.mimeType);
        resolve();
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ type, payload });
  });
