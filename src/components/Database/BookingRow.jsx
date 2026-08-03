import React, { memo } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { format } from 'date-fns';

const BookingRow = memo(({ booking, viewMode, rooms, onApprove, onDelete, onEdit }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const roomName = rooms.find(r => r.id === booking['Room'])?.room_number || booking['Room'];
  const isPending = booking['Lesson Number'] === 'Pending' || booking['Status'] === 'Pending';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking['Course ID']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['Course Name']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['Lesson Number']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(booking['Start date'])}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['Lesson Length']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['Start time']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['End time']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{roomName}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking['Tutor']}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(booking['Start date'])}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(booking['End date'])}</td>
      {viewMode === 'approve-bookings' && (
        <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs">{booking['Comments']}</td>
      )}
      {viewMode === 'approve-bookings' && (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
          {isPending ? (
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => onApprove(booking)}
                className="p-1 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                title="Approve — assign room & fee"
              >
                <FiCheck className="h-5 w-5" />
              </button>
              <button
                onClick={() => onDelete(booking.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Reject"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {booking['Status'] || booking['Lesson Number'] || 'Approved'}
            </span>
          )}
        </td>
      )}
    </tr>
  );
});

export default BookingRow;
