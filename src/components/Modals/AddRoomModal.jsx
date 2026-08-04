import React, { useState } from 'react';
import { FiX, FiMapPin, FiUsers } from 'react-icons/fi';
import { dataService } from '../../lib/dataService';

const AddRoomModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({ room_number: '', location: 'Wood Green Learning Centre', capacity: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await dataService
        .from('rooms')
        .insert([formData]);

      if (error) throw error;

      setFormData({ room_number: '', capacity: 20 });
      onClose();
      // Refresh the page to show new room
      window.location.reload();
    } catch (error) {
      setError(error.message || 'Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add New Room</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiMapPin className="h-4 w-4 inline mr-1" /> Room Number
            </label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) => setFormData(prev => ({ ...prev, room_number: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Room 14, Conference A, Lab 101"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiMapPin className="h-4 w-4 inline mr-1" /> Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Wood Green Learning Centre, Community Centre"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiUsers className="h-4 w-4 inline mr-1" /> Capacity
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={formData.capacity}
              onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Maximum number of people"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Adding...' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;