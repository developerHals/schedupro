import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiClock, FiMapPin, FiFileText, FiPlus, FiTrash2, FiUser, FiDollarSign } from 'react-icons/fi';
import { format, addDays } from 'date-fns';
import ConfirmationModal from './ConfirmationModal';

const TimePicker = ({ value, onChange, className }) => {
  const [hour, minute] = (value || ':').split(':');
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '10', '15', '20', '30', '40', '45', '50'];
  
  const updateTime = (newHour, newMinute) => {
    if (!newHour && !newMinute) onChange('');
    else onChange(`${newHour || '09'}:${newMinute || '00'}`);
  };

  return (
    <div className="flex items-center space-x-1">
      <select 
        className={`${className} appearance-none`} 
        style={{ width: '45%', minWidth: '60px', paddingRight: '1.5rem', backgroundImage: 'none' }}
        value={hour || ''} 
        onChange={e => updateTime(e.target.value, minute)}
      >
        <option value="">HH</option>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-bold text-gray-400">:</span>
      <select 
        className={`${className} appearance-none`}
        style={{ width: '45%', minWidth: '60px', paddingRight: '1.5rem', backgroundImage: 'none' }}
        value={minute || ''} 
        onChange={e => updateTime(hour, e.target.value)}
      >
        <option value="">MM</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
};

const BookRoomModal = ({ isOpen, onClose, onSubmit, onEdit, getAvailableRooms, bookingToEdit, initialValues, allRooms = [], requestMode = false, isSuperuserMode = false }) => {
  const [formData, setFormData] = useState({
    bookingType: 'Meeting',
    course_code: 'Meeting',
    notes: '',
    tutor: '',
    fees: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    room_id: ''
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [extraDays, setExtraDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (bookingToEdit) {
        // Map database columns to form fields
        // 'Course Name' holds the Reason/Title for ad-hoc bookings
        // 'Course ID' holds the Booking Type
        setFormData({
          bookingType: bookingToEdit['Course ID'] || bookingToEdit.course_code || 'Meeting',
          course_code: bookingToEdit['Course ID'] || bookingToEdit.course_code || 'Meeting',
          notes: bookingToEdit['Course Name'] || bookingToEdit.notes || '', 
          tutor: bookingToEdit['Tutor'] || bookingToEdit.tutor || '',
          fees: bookingToEdit['fees'] ?? '',
          date: bookingToEdit['Start date'] || bookingToEdit.date || format(new Date(), 'yyyy-MM-dd'),
          start_time: bookingToEdit['Start time'] || bookingToEdit.start_time || '09:00',
          end_time: bookingToEdit['End time'] || bookingToEdit.end_time || '10:00',
          room_id: bookingToEdit['Room'] || bookingToEdit.room_id || ''
        });
      } else if (initialValues) {
        setFormData({
          bookingType: 'Meeting',
          course_code: 'Meeting',
          notes: '',
          tutor: '',
          fees: '',
          date: initialValues.date || format(new Date(), 'yyyy-MM-dd'),
          start_time: initialValues.start_time || '09:00',
          end_time: initialValues.end_time || '10:00',
          room_id: initialValues.room_id || ''
        });
      } else {
        setFormData({
          bookingType: 'Meeting',
          course_code: 'Meeting',
          notes: '',
          tutor: '',
          fees: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          start_time: '09:00',
          end_time: '10:00',
          room_id: ''
        });
      }
    }
  }, [isOpen, bookingToEdit, initialValues]);

  useEffect(() => {
    if (isOpen && formData.date && formData.start_time && formData.end_time) {
      loadAvailableRooms();
    }
  }, [isOpen, formData.date, formData.start_time, formData.end_time]);

  const getDisplayCapacity = (room) => {
    if (!room || !room.room_number) return room?.capacity;
    const match = String(room.room_number).match(/\d+/);
    const num = match ? parseInt(match[0], 10) : null;
    if (num === 1 || num === 8 || num === 9 || num === 12) return 12;
    if (num === 6) return 10;
    return 20;
  };

  const loadAvailableRooms = async () => {
    try {
      setLoading(true);
      const rooms = await getAvailableRooms(
        new Date(formData.date),
        formData.start_time,
        formData.end_time,
        bookingToEdit?.id
      );
      setAvailableRooms(rooms);
      
      // Auto-select first available room if none selected
      if (rooms.length > 0 && !formData.room_id) {
         setFormData(prev => ({ ...prev, room_id: rooms[0].id }));
      } else if (formData.room_id) {
          // Ensure the selected room is in the list
          const currentRoomInList = rooms.find(r => r.id === formData.room_id);
          if (!currentRoomInList && allRooms.length > 0) {
              const missingRoom = allRooms.find(r => r.id === formData.room_id);
              if (missingRoom) {
                  // Add it to the list (temporarily for display)
                  // We create a new array to avoid mutating state incorrectly in a loop if this triggers often
                  // But setAvailableRooms replaces it.
                  // We should append it.
                  setAvailableRooms(prev => {
                      // Check again to be safe
                      if (prev.find(r => r.id === missingRoom.id)) return prev;
                      // Add label to indicate it's the current one but might be unavailable?
                      // User said "show the room selected plus the rooms available then"
                      // We can just add it. The user will see it's selected.
                      // If it's truly unavailable (conflict), they can still keep it if they want (preserving current state)?
                      // Or maybe they want to see it to realize they need to change it.
                      return [missingRoom, ...prev];
                  });
                  // Note: We don't change formData.room_id, so it stays selected.
              }
          }
      }
    } catch (error) {
      console.error('Error loading available rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const addExtraDay = () => {
    setExtraDays(prev => [...prev, {
      id: Date.now(),
      date: format(addDays(new Date(formData.date), 1), 'yyyy-MM-dd'),
      start_time: formData.start_time,
      end_time: formData.end_time,
      room_id: '',
      availableRooms: []
    }]);
  };

  const removeExtraDay = (id) => {
    setExtraDays(prev => prev.filter(day => day.id !== id));
  };

  const updateExtraDay = async (id, field, value) => {
    setExtraDays(prev => prev.map(day => {
      if (day.id === id) {
        const updated = { ...day, [field]: value };
        // Reload available rooms for this day if time or date changed
        if (field === 'date' || field === 'start_time' || field === 'end_time') {
          loadAvailableRoomsForDay(updated);
        }
        return updated;
      }
      return day;
    }));
  };

  const loadAvailableRoomsForDay = async (dayData) => {
    try {
      const rooms = await getAvailableRooms(
        dayData.date,
        dayData.start_time,
        dayData.end_time
      );
      
      setExtraDays(prev => prev.map(day => 
        day.id === dayData.id ? { 
          ...day, 
          availableRooms: rooms,
          room_id: rooms.length > 0 ? rooms[0].id : ''
        } : day
      ));
    } catch (error) {
      console.error('Error loading rooms for extra day:', error);
    }
  };

  const NOTES_MAX = 500;
  const TUTOR_MAX = 100;

  const validateForm = () => {
    const newErrors = {};
    if (!formData.notes.trim()) {
      newErrors.notes = 'Reason for booking is mandatory';
    } else if (formData.notes.length > NOTES_MAX) {
      newErrors.notes = `Maximum ${NOTES_MAX} characters allowed`;
    }
    if (!requestMode && !formData.room_id) {
      newErrors.room_id = 'Please select a room';
    }
    if (formData.start_time >= formData.end_time) {
      newErrors.time = 'End time must be after start time';
    }
    if (requestMode && formData.date) {
      const selected = new Date(formData.date);
      const today = new Date(); today.setHours(0,0,0,0);
      const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 6);
      if (selected < today) {
        newErrors.date = 'Date cannot be in the past';
      } else if (selected > maxDate) {
        newErrors.date = 'Date cannot be more than 6 months ahead';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Determine session type based on start time
      const getSessionType = (startTime) => {
        const hour = parseInt(startTime.split(':')[0]);
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
      };

      // Create main booking
      const mainBooking = {
        ...formData,
        course_code: formData.bookingType, // Use selected type
        session_type: getSessionType(formData.start_time),
        schedule_string: extraDays.length > 0 ? 'Multi-day booking' : 'Single day'
      };

      if (bookingToEdit) {
        if (onEdit) {
          await onEdit(bookingToEdit.id, mainBooking);
        }
      } else {
        await onSubmit(mainBooking);

        // Create extra day bookings
        for (const day of extraDays) {
          if (day.room_id && day.date && day.start_time && day.end_time) {
            await onSubmit({
              bookingType: formData.bookingType,
              course_code: formData.bookingType,
              notes: formData.notes,
              tutor: formData.tutor,
              date: day.date,
              start_time: day.start_time,
              end_time: day.end_time,
              room_id: day.room_id,
              session_type: getSessionType(day.start_time),
              schedule_string: `Multi-day booking - Extra day`
            });
          }
        }
      }

      // Show provisional message (always for requests, skipped for superuser direct bookings)
      if (!isSuperuserMode) {
        setConfirmationMessage(
          requestMode
            ? 'Booking request submitted successfully. Your request is provisional and will be confirmed within 1 working day.'
            : 'Booking submitted successfully. This booking is provisional and will be confirmed within 1 working day.'
        );
        setShowConfirmation(true);
      }

      // Reset form
      setFormData({
        bookingType: 'Meeting',
        course_code: 'Meeting',
        notes: '',
        tutor: '',
        fees: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        room_id: ''
      });
      setExtraDays([]);
      setErrors({});
      // onClose(); // Don't close immediately, wait for confirmation modal
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to submit booking: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <ConfirmationModal 
        isOpen={showConfirmation} 
        onClose={handleConfirmationClose}
        title="Important"
        message={confirmationMessage}
      />
      
      {!showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {requestMode ? 'Request a Booking' : (bookingToEdit ? 'Edit Booking' : 'Book a Room')}
              </h2>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">


          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiCalendar className="h-4 w-4 inline mr-1" /> Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-600">{errors.date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiClock className="h-4 w-4 inline mr-1" /> Start Time
              </label>
              <TimePicker
                value={formData.start_time}
                onChange={(val) => setFormData(prev => ({ ...prev, start_time: val }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <TimePicker
                value={formData.end_time}
                onChange={(val) => setFormData(prev => ({ ...prev, end_time: val }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-sm text-red-600">{errors.time}</p>
          )}

          {/* Available Rooms */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              requestMode ? 'text-gray-400' : 'text-gray-700'
            }`}>
              <FiMapPin className="h-4 w-4 inline mr-1" /> Available Rooms
              {requestMode && <span className="ml-2 text-xs font-normal italic">(allocated by admin upon approval)</span>}
            </label>
            {requestMode ? (
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-400 text-sm cursor-not-allowed">
                Room will be allocated by admin
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading available rooms...</span>
              </div>
            ) : availableRooms.length > 0 ? (
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
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  No rooms available for the selected time slot. Please choose a different time.
                </p>
              </div>
            )}
            {errors.room_id && (
              <p className="mt-1 text-sm text-red-600">{errors.room_id}</p>
            )}
          </div>

          {/* Booking Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiFileText className="h-4 w-4 inline mr-1" /> Booking Type
            </label>
            <select
              value={formData.bookingType}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                bookingType: e.target.value,
                course_code: e.target.value 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Meeting">Meeting</option>
              <option value="Event">Event</option>
              <option value="Activity">Activity</option>
              <option value="Lesson">Lesson</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Tutor / Organiser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiUser className="h-4 w-4 inline mr-1" /> Tutor / Organiser
            </label>
            <input
              type="text"
              value={formData.tutor}
              onChange={(e) => setFormData(prev => ({ ...prev, tutor: e.target.value }))}
              maxLength={TUTOR_MAX}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter tutor or organiser name"
            />
          </div>

          {/* Fee */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              requestMode ? 'text-gray-400' : 'text-gray-700'
            }`}>
              <FiDollarSign className="h-4 w-4 inline mr-1" /> Booking Fee (£)
              {requestMode
                ? <span className="ml-2 text-xs font-normal italic">(set by admin upon approval)</span>
                : <span className="text-gray-400 font-normal"> — optional</span>
              }
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.fees}
              onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
              disabled={requestMode}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                requestMode ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for booking (e.g. Meeting) and contact details *
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              maxLength={NOTES_MAX}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the reason for the booking..."
            />
            <div className="flex justify-between items-center mt-1">
              {errors.notes
                ? <p className="text-sm text-red-600">{errors.notes}</p>
                : <span />}
              <p className={`text-xs ${
                formData.notes.length > NOTES_MAX * 0.9 ? 'text-orange-500' : 'text-gray-400'
              }`}>{formData.notes.length}/{NOTES_MAX}</p>
            </div>
          </div>

          {requestMode && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                You can submit up to <strong>3 booking requests</strong> within a <strong>10-minute</strong> window.
              </p>
            </div>
          )}

          {/* Extra Days */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Additional Days</h3>
              <button
                type="button"
                onClick={addExtraDay}
                className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <FiPlus className="h-4 w-4 mr-1" /> Add Day
              </button>
            </div>
            
            {extraDays.map(day => (
              <div key={day.id} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Extra Day</h4>
                  <button
                    type="button"
                    onClick={() => removeExtraDay(day.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) => updateExtraDay(day.id, 'date', e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <TimePicker
                    value={day.start_time}
                    onChange={(val) => updateExtraDay(day.id, 'start_time', val)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <TimePicker
                    value={day.end_time}
                    onChange={(val) => updateExtraDay(day.id, 'end_time', val)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={day.room_id}
                    onChange={(e) => updateExtraDay(day.id, 'room_id', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select room</option>
                    {day.availableRooms?.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} (Cap: {room.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
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
              disabled={loading || (!requestMode && availableRooms.length === 0)}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                requestMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading
                ? (requestMode ? 'Submitting...' : (bookingToEdit ? 'Updating...' : 'Booking...'))
                : (requestMode ? 'Submit Request' : (bookingToEdit ? 'Update Booking' : 'Book Room'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
    )}
    </>
  );
};

export default BookRoomModal;
