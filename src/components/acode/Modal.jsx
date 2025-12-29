import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const Modal = ({ isOpen, title, content, type = 'info', onConfirm, onCancel, showCancel = false, confirmText = '確定', cancelText = '取消' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="text-red-500 w-6 h-6" />;
      case 'success': return <CheckCircle className="text-green-500 w-6 h-6" />;
      case 'warning': return <AlertTriangle className="text-yellow-500 w-6 h-6" />;
      default: return <Info className="text-blue-500 w-6 h-6" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all scale-100 flex flex-col max-h-[85vh] relative text-gray-900 dark:text-gray-100">
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="flex items-start">
            <div className="mr-3 mt-1 flex-shrink-0">
                {getIcon()}
            </div>
            <div>
                <h3 className="text-lg font-bold leading-6 mb-1">
                {title}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {content}
                </div>
            </div>
            </div>
        </div>

        <button 
          onClick={onCancel || onConfirm} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition z-10"
        >
          <X size={20} />
        </button>

        <div className="flex justify-end space-x-3 p-6 pt-2 bg-white dark:bg-gray-800 rounded-b-xl border-t border-gray-100 dark:border-gray-700 flex-shrink-0 z-10">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg font-medium shadow-sm transition ${
              type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
