import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const AddRowModal = ({ isOpen, onClose, onSubmit, columns, title }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (isOpen) {
      setFormData({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (col, value) => {
    setFormData(prev => ({
      ...prev,
      [col]: value
    }));
  };

  // Filter out system columns
  const displayColumns = columns.filter(col => col !== 'id' && col !== 'created_at');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg leading-6 font-bold text-gray-900">
                {title || 'Add New Item'}
              </h3>
              <button
                onClick={onClose}
                className="bg-gray-100 rounded-full p-2 hover:bg-gray-200 transition-colors"
              >
                <SafeIcon icon={FiX} className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form id="add-row-form" onSubmit={handleSubmit} className="space-y-4">
              {displayColumns.length > 0 ? (
                displayColumns.map((col) => (
                  <div key={col}>
                    <label htmlFor={col} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {col.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      id={col}
                      required
                      value={formData[col] || ''}
                      onChange={(e) => handleChange(col, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  <p>No columns detected.</p>
                  <p className="text-xs mt-1">Please import a CSV first to define the table structure, or ensure the table has columns in Backend.</p>
                </div>
              )}
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              form="add-row-form"
              disabled={displayColumns.length === 0}
              className={`w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                displayColumns.length === 0 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              <SafeIcon icon={FiSave} className="mr-2 h-5 w-5" />
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddRowModal;
