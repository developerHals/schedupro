import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
const { FiMoreVertical, FiEdit2, FiTrash2, FiClock, FiPlus, FiCopy, FiBook, FiCalendar, FiX } = FiIcons;
import SafeIcon from '../../common/SafeIcon';
import ConfirmationModal from '../Modals/ConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { SLOT_HEIGHT_PX } from '../../utils/timeSlots';
import { parseISO, isValid, startOfDay } from 'date-fns';

// Helper to check if booking is urgent (Pending with start date <= today)
const isBookingUrgent = (booking) => {
  if (booking.courseStatus !== 'Pending') return false;
  const startDateStr = booking.courseStart || booking['Start date'];
  if (!startDateStr) return false;
  
  try {
    const startDate = parseISO(startDateStr);
    if (!isValid(startDate)) return false;
    const today = startOfDay(new Date());
    return startOfDay(startDate) <= today;
  } catch {
    return false;
  }
};

const BookingCell = ({ 
  roomId, 
  sessionType, 
  booking, // Deprecated: Use bookings array
  bookings, // New: Array of bookings
  onCellClick, 
  onDrop, 
  canEdit, 
  onDelete,
  onNewCourse,
  onDuplicate,
  // Slot-grid props
  isFirstSlot,  // true = render tile here; false = blocked continuation cell
  slotSpan,     // number of rows this tile spans (only used when isFirstSlot=true)
  slotTime,     // "HH:MM" label for empty cells
  hasBorderTop  // white top border when this booking immediately follows another in the same room
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const { user, isSuperuser, isAdmin, canEditBooking, canDeleteBooking } = useAuth();

  const bookingsList = bookings || (booking ? [booking] : []);

  const handleDragStart = (e, bookingItem) => {
    if (!canEdit || !bookingItem) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({
      bookingId: bookingItem.id,
      sourceRoomId: roomId,
      sourceSessionType: sessionType
    }));
  };

  const handleDragOver = (e) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.bookingId && (data.sourceRoomId !== roomId || data.sourceSessionType !== sessionType)) {
        onDrop(data.bookingId, roomId, sessionType);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleDelete = (e, bookingId) => {
    e.stopPropagation();
    setBookingToDelete(bookingId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (bookingToDelete) {
        onDelete(bookingToDelete);
    }
    setShowDeleteModal(false);
    setBookingToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setBookingToDelete(null);
  };

  const handlePlusClick = (e) => {
    e.stopPropagation();
    if (onCellClick) onCellClick(roomId, sessionType, null);
  };

  const handleQuickCopy = (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    if (courseId) {
        navigator.clipboard.writeText(courseId).catch(err => console.error('Failed to copy:', err));
        window.location.href = `${window.location.origin}/?view=courses&filter=All&search=${encodeURIComponent(courseId)}`;
    }
  };

  // When isFirstSlot is explicitly false, this cell is a silent continuation
  // of a tile that started in a previous slot row — render nothing interactive.
  const isContinuation = isFirstSlot === false;

  const isLearnerTrackSession = bookingsList.some(b => b.isLearnerTrackSession);

  const cellClasses = `
    w-[160px] md:w-[220px] flex-shrink-0 border-r border-gray-100 relative transition-all duration-200
    ${canEdit && !isContinuation && !isLearnerTrackSession ? 'cursor-pointer' : ''}
    ${isDragOver && !isContinuation ? 'bg-blue-200 scale-[0.98] ring-2 ring-blue-400 ring-inset z-10' : (!isContinuation ? (bookingsList.length > 0 ? (isLearnerTrackSession ? 'bg-blue-50' : 'bg-blue-100') : 'hover:bg-gray-50/50') : '')}
    ${bookingsList.length > 0 && !isContinuation ? 'p-2 md:p-3' : 'p-1'}
  `;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
  };

  // Silent continuation cell — same background as the first slot, no interactions
  if (isContinuation) {
    const isLearnerTrackSession = bookingsList[0]?.isLearnerTrackSession;
    return (
      <div
        className={`w-[160px] md:w-[220px] flex-shrink-0 border-r border-gray-100 ${
          isLearnerTrackSession ? 'bg-blue-50' : 'bg-blue-100'
        }`}
        style={{ height: `${SLOT_HEIGHT_PX}px` }}
      />
    );
  }

  return (
    <div
      className={cellClasses}
      style={{
        ...(bookingsList.length > 0 && slotSpan > 1
          ? { height: `${slotSpan * SLOT_HEIGHT_PX}px`, position: 'relative' }
          : { height: `${SLOT_HEIGHT_PX}px` }),
        ...(hasBorderTop ? { borderTop: '2px solid white' } : {})
      }}
      onClick={() => {
        if (bookingsList.length === 0 && canEdit && onCellClick) {
          onCellClick(roomId, sessionType, null);
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {bookingsList.length > 0 ? (
        <div className="flex flex-col gap-2 h-full">
            {bookingsList.map((bookingItem) => {
                // Date Display Logic
                const isLearnerTrackSession = bookingItem.isLearnerTrackSession;
                const isCourse = !!bookingItem['Course ID'] || !!bookingItem.courseStart;
                const startDate = bookingItem.courseStart || bookingItem['Start date'];
                const endDate = bookingItem.courseEnd || bookingItem['End date'];
                const showRange = startDate !== endDate;

                // Clean notes to remove schedule summary
                const cleanNotes = bookingItem['Notes']
                    ? bookingItem['Notes'].split('-- Schedule Summary --')[0].trim()
                    : '';

                const isUrgent = !isLearnerTrackSession && isBookingUrgent(bookingItem);

                return (
                    <div
                      key={bookingItem.id}
                      className={`shadow-sm rounded-xl p-3 relative group/card hover:shadow-md transition-all duration-200 flex flex-col gap-2 ${
                        isUrgent
                          ? 'bg-red-50 border border-red-200 hover:border-red-400'
                          : isLearnerTrackSession
                            ? 'bg-blue-50 border border-blue-200 hover:border-blue-400'
                            : 'bg-white border border-blue-100 hover:border-blue-300'
                      }`}
                      draggable={canEdit && !isLearnerTrackSession}
                      onDragStart={(e) => handleDragStart(e, bookingItem)}
                      onClick={(e) => {
                        if (isLearnerTrackSession) return;
                        // Check ownership-based permissions for this specific booking
                        if (canEdit && (isSuperuser() || isAdmin() ? canEditBooking(bookingItem) : true)) {
                          e.stopPropagation();
                          if (onCellClick) onCellClick(roomId, sessionType, bookingItem);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                            isUrgent
                              ? 'bg-red-600 text-white'
                              : isLearnerTrackSession
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-600 text-white'
                          }`}>
                            {bookingItem['Course ID']}
                          </span>
                          {canEdit && !isLearnerTrackSession && (
                            <button
                              onClick={(e) => handleQuickCopy(e, bookingItem['Course ID'])}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50"
                              title="Copy ID and Filter Courses"
                            >
                              <SafeIcon icon={FiCopy} className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                          {canEdit && !isLearnerTrackSession && onDuplicate && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDuplicate(bookingItem); }}
                              className="p-1.5 rounded-full bg-green-50 text-green-500 hover:bg-green-100 hover:text-green-600 transition-all duration-200 shadow-sm"
                              title="Duplicate"
                            >
                              <SafeIcon icon={FiCopy} className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Delete button - only show if user can delete this specific booking */}
                          {canEdit && !isLearnerTrackSession && canDeleteBooking(bookingItem) && (
                            <button
                              onClick={(e) => handleDelete(e, bookingItem.id)}
                              className="p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all duration-200 shadow-sm"
                              title="Delete Booking"
                            >
                              <SafeIcon icon={FiTrash2} className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight" title={bookingItem['Course Name']}>
                        {bookingItem['Course Name']}
                      </div>

                      <div className="flex flex-col gap-1 mt-auto">
                        <div className="flex items-center text-xs text-gray-600">
                            <SafeIcon icon={FiClock} className="w-3 h-3 mr-1.5 flex-shrink-0" />
                            <span className="truncate">{bookingItem['Start time']} - {bookingItem['End time']}</span>
                        </div>

                        <div className="text-xs text-gray-600 flex items-center">
                            <span className="font-medium mr-1 text-gray-500">Room:</span>
                            <span className="truncate">{bookingItem.displayRoomName || bookingItem['Room']}</span>
                        </div>

                        <div className="text-xs text-gray-600 flex items-center">
                            <span className="font-medium mr-1 text-gray-500">Tutor:</span>
                            <span className="truncate" title={bookingItem['Tutor']}>{bookingItem['Tutor']}</span>
                        </div>

                        {/* Course Status: Below Tutor */}
                        {bookingItem.courseStart && (
                             <div className={`text-xs flex items-center mt-1 ${
                                 isLearnerTrackSession
                                   ? 'text-blue-700'
                                   : bookingItem.courseStatus === 'Live'
                                     ? 'text-blue-600'
                                     : (bookingItem.courseStatus === 'Completed' || bookingItem.courseStatus === 'Closed')
                                       ? 'text-green-600'
                                       : 'text-red-600'
                             }`}>
                                 <span className="font-medium mr-1 text-gray-500">Status:</span>
                                 <span className="font-semibold truncate" title={bookingItem.courseStatus}>
                                     {bookingItem.courseStatus || 'Pending'}
                                 </span>
                             </div>
                        )}

                        {cleanNotes && (
                          <div className="text-xs text-gray-600 flex items-start mt-1" title={cleanNotes}>
                              <span className="font-medium mr-1 text-gray-500 shrink-0">Note:</span>
                              <span className="line-clamp-2">{cleanNotes}</span>
                          </div>
                        )}

                        {/* Book Room Status: Below Notes */}
                        {!bookingItem.courseStart && !isLearnerTrackSession && (
                             <div className={`text-xs flex items-center mt-1 ${
                                 bookingItem['Lesson Number'] === 'Approved' ? 'text-green-600' : 'text-red-600'
                             }`}>
                                 <span className="font-medium mr-1 text-gray-500">Status:</span>
                                 <span className="font-semibold truncate" title={bookingItem['Lesson Number']}>
                                     {bookingItem['Lesson Number'] || 'Pending'}
                                 </span>
                             </div>
                        )}

                        <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 mt-0.5 flex items-center justify-between">
                           <span>{isCourse && showRange ? 'Duration:' : 'Date:'}</span>
                           <span className="font-medium text-gray-500">
                             {formatDate(startDate)}
                             {showRange && ` - ${formatDate(endDate)}`}
                           </span>
                        </div>
                      </div>
                    </div>
                );
            })}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center group/empty">
          {user && (
            <button 
              className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-600 hover:scale-110 transition-all duration-200 shadow-sm opacity-0 group-hover/empty:opacity-100"
              onClick={handlePlusClick}
              title={isSuperuser() || isAdmin() ? 'Make a booking' : 'Request a booking'}
            >
              <SafeIcon icon={FiPlus} className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Important"
        message="Are you sure you want to delete this booking?"
        confirmLabel="OK"
        cancelLabel="Cancel"
        isDelete={true}
        verificationText="DELETE"
      />
    </div>
  );
};

export default React.memo(BookingCell);