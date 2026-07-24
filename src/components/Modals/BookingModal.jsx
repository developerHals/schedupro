import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiClock, FiMapPin, FiFileText } from 'react-icons/fi';
import { format } from 'date-fns';

const BookingModal = ({ isOpen, onClose, selectedCell, onBookingUpdate, onBookingCreate, getAvailableRooms }) => {
  const [formData, setFormData] = useState({
    course_code: '',
    notes: '',
    start_time: '',
    end_time: '',
    room_id: ''
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && selectedCell) {
      // Set default times based on session type
      const getDefaultTimes = (sessionType) => {
        switch (sessionType) {
          case 'morning': return { start_time: '08:00', end_time: '12:00' };
          case 'afternoon': return { start_time: '13:00', end_time: '17:00' };
          case 'evening': return { start_time: '18:00', end_time: '22:00' };
          default: return { start_time: '09:00', end_time: '10:00' };
        }
      };

      const defaultTimes = getDefaultTimes(selectedCell.sessionType);

      if (selectedCell.booking) {
        // Edit existing booking
        setFormData({
          course_code: selectedCell.booking.course_code || '',
          notes: selectedCell.booking.notes || '',
          start_time: selectedCell.booking.start_time || defaultTimes.start_time,
          end_time: selectedCell.booking.end_time || defaultTimes.end_time,
          room_id: selectedCell.roomId
        });
      } else {
        // Create new booking
        setFormData({
          course_code: '',
          notes: '',
          start_time: defaultTimes.start_time,
          end_time: defaultTimes.end_time,
          room_id: selectedCell.roomId
        });
      }
      loadAvailableRooms();
    }
  }, [isOpen, selectedCell]);

  const getDisplayCapacity = (room) => {
    if (!room || !room.room_number) return room?.capacity;
    const match = String(room.room_number).match(/\d+/);
    const num = match ? parseInt(match[0], 10) : null;
    if (num === 1 || num === 8 || num === 9 || num === 12) return 12;
    if (num === 6) return 10;
    return 20;
  };

  const loadAvailableRooms = async () => {
    if (!selectedCell) return;
    try {
      setLoading(true);
      const rooms = await getAvailableRooms(
        selectedCell.date,
        formData.start_time || '09:00',
        formData.end_time || '10:00',
        selectedCell.booking?.id
      );
      setAvailableRooms(rooms);
    } catch (error) {
      console.error('Error loading available rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.course_code.trim()) {
      newErrors.course_code = 'Course code is required';
    }
    if (!formData.notes.trim()) {
      newErrors.notes = 'Notes are mandatory';
    }
    if (!formData.room_id) {
      newErrors.room_id = 'Please select a room';
    }
    if (formData.start_time >= formData.end_time) {
      newErrors.time = 'End time must be after start time';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !selectedCell) return;

    try {
      setLoading(true);
      const bookingData = {
        ...formData,
        date: format(selectedCell.date, 'yyyy-MM-dd'),
        session_type: selectedCell.sessionType,
        schedule_string: 'Manual entry'
      };

      if (selectedCell.booking) {
        // Update existing booking
        await onBookingUpdate(selectedCell.booking.id, bookingData);
      } else if (onBookingCreate) {
        // console.log('Create new booking:', bookingData);
        await onBookingCreate(bookingData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving booking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !selectedCell) return null;

  const sessionNames = {
    morning: 'Morning Session',
    afternoon: 'Afternoon Session',
    evening: 'Evening Session'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedCell.booking ? 'Edit Booking' : 'New Booking'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Session Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center text-sm text-gray-600 space-x-4">
            <div className="flex items-center">
              <FiCalendar className="h-4 w-4 mr-1" /> {format(selectedCell.date, 'MMM d, yyyy')}
            </div>
            <div className="flex items-center">
              <FiClock className="h-4 w-4 mr-1" /> {sessionNames[selectedCell.sessionType]}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, start_time: e.target.value }));
                  loadAvailableRooms();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, end_time: e.target.value }));
                  loadAvailableRooms();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-sm text-red-600">{errors.time}</p>
          )}

          {/* Room Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiMapPin className="h-4 w-4 inline mr-1" /> Room *
            </label>
            <select
              value={formData.room_id}
              onChange={(e) => setFormData(prev => ({ ...prev, room_id: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.room_id ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select a room</option>
              {availableRooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.room_number} (Capacity: {getDisplayCapacity(room)})
                </option>
              ))}
            </select>
            {errors.room_id && (
              <p className="mt-1 text-sm text-red-600">{errors.room_id}</p>
            )}
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
              {loading ? 'Saving...' : (selectedCell.booking ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
