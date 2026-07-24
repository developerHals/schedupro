import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiCalendar, FiClock, FiMapPin, FiFileText, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';

const BookingEditModal = ({ isOpen, onClose, booking, onBookingUpdate }) => {
  const [formData, setFormData] = useState({
    course_code: '',
    notes: '',
    date: '',
    start_time: '',
    end_time: '',
    session_type: 'morning',
    schedule_string: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        course_code: booking.course_code || '',
        notes: booking.notes || '',
        date: booking.date || '',
        start_time: booking.start_time || '',
        end_time: booking.end_time || '',
        session_type: booking.session_type || 'morning',
        schedule_string: booking.schedule_string || ''
      });
      setErrors({});
    }
  }, [isOpen, booking]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.course_code.trim()) {
      newErrors.course_code = 'Course code is required';
    }
    if (!formData.notes.trim()) {
      newErrors.notes = 'Notes are mandatory';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (formData.start_time >= formData.end_time) {
      newErrors.time = 'End time must be after start time';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !booking) return;

    try {
      setLoading(true);
      await onBookingUpdate(booking.id, formData);
      onClose();
    } catch (error) {
      console.error('Error updating booking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Booking Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Booking Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center text-sm text-gray-600 space-x-4">
            <div className="flex items-center">
              <FiMapPin className="h-4 w-4 mr-1" /> {booking.rooms?.room_number}
            </div>
            <div className="flex items-center">
              <FiUser className="h-4 w-4 mr-1" /> ID: {booking.id.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Course Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Code *
            </label>
            <input
              type="text"
              value={formData.course_code}
              onChange={(e) => setFormData(prev => ({ ...prev, course_code: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.course_code ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., CS101, MATH201"
            />
            {errors.course_code && (
              <p className="mt-1 text-sm text-red-600">{errors.course_code}</p>
            )}
          </div>

          {/* Date and Session Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiCalendar className="h-4 w-4 inline mr-1" /> Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">{errors.date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Type
              </label>
              <select
                value={formData.session_type}
                onChange={(e) => setFormData(prev => ({ ...prev, session_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="morning">Morning Session</option>
                <option value="afternoon">Afternoon Session</option>
                <option value="evening">Evening Session</option>
              </select>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiClock className="h-4 w-4 inline mr-1" /> Start Time *
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-sm text-red-600">{errors.time}</p>
          )}

          {/* Schedule String */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule String
            </label>
            <input
              type="text"
              value={formData.schedule_string}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule_string: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Weekly recurring, Multi-day event"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiFileText className="h-4 w-4 inline mr-1" /> Notes *
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the session, requirements, or any special notes..."
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
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
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiSave className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingEditModal;