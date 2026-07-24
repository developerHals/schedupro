import React from 'react';
import { FiCheck, FiAlertTriangle } from 'react-icons/fi';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Important", 
  message, 
  confirmLabel = "OK", 
  cancelLabel = "Cancel", 
  isDelete = false,
  verificationText = null
}) => {
  const [inputValue, setInputValue] = React.useState('');
  const isConfirmDisabled = verificationText && inputValue !== verificationText;

  React.useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-lg max-w-sm w-full shadow-xl transform transition-all">
        <div className="p-6">
          <div className={`flex items-center justify-center mb-4 ${isDelete ? 'text-red-500' : 'text-green-500'}`}>
            <div className={`${isDelete ? 'bg-red-100' : 'bg-green-100'} p-3 rounded-full`}>
              {isDelete ? <FiAlertTriangle className="h-8 w-8" /> : <FiCheck className="h-8 w-8" />}
            </div>
          </div>
          
          <h3 className="text-lg font-bold text-center text-gray-900 mb-2">
            {title}
          </h3>
          
          <p className="text-center text-gray-600 mb-6">
            {message}
          </p>

          {verificationText && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Type <span className="font-bold">{verificationText}</span> to confirm
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center uppercase"
                placeholder={verificationText}
              />
            </div>
          )}

          <div className={`flex gap-3 ${onConfirm ? 'justify-between' : 'justify-center'}`}>
            {onConfirm && (
              <button
                onClick={onClose}
                className="flex-1 bg-white text-gray-700 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {cancelLabel}
              </button>
            )}
            
            <button
              onClick={onConfirm || onClose}
              disabled={isConfirmDisabled}
              className={`flex-1 ${
                isDelete 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              } text-white py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
