
import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiPlus, FiTrash } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, parse, isValid } from 'date-fns';
import { dataService } from '../../lib/dataService';

const StatusModal = ({ isOpen, onClose, onSave, initialStatus, initialDeadline, initialActualEnrolments, initialActualCompletions, initialComments, initialPublishedOnWebenrol, courseId, courseName }) => {
  const [status, setStatus] = useState(initialStatus || 'Pending');
  const [deadline, setDeadline] = useState(null);
  const [manualDeadline, setManualDeadline] = useState('');
  const [actualEnrolments, setActualEnrolments] = useState(initialActualEnrolments || '');
  const [actualCompletions, setActualCompletions] = useState(initialActualCompletions || '');
  const [publishedOnWebenrol, setPublishedOnWebenrol] = useState(initialPublishedOnWebenrol || 'No');
  
  // Comment handling
  const [newComments, setNewComments] = useState(['']);

  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus || 'Pending');
      setActualEnrolments(initialActualEnrolments || '');
      setActualCompletions(initialActualCompletions || '');
      setPublishedOnWebenrol(initialPublishedOnWebenrol || 'No');
      setNewComments(['']);
      
      // Handle initial deadline
      if (initialDeadline) {
        // Try parsing dd/MM/yyyy or yyyy-MM-dd
        let parsedDate = parse(initialDeadline, 'dd/MM/yyyy', new Date());
        if (!isValid(parsedDate)) {
           parsedDate = parse(initialDeadline, 'yyyy-MM-dd', new Date());
        }

        if (isValid(parsedDate)) {
          setDeadline(parsedDate);
          setManualDeadline(initialDeadline); // Keep original string if valid
        } else {
          setDeadline(null);
          setManualDeadline(initialDeadline || '');
        }
      } else {
        setDeadline(null);
        setManualDeadline('');
      }
    }
  }, [isOpen, initialStatus, initialDeadline]);

  const handleDateChange = (date) => {
    setDeadline(date);
    if (date) {
      setManualDeadline(format(date, 'dd/MM/yyyy'));
    } else {
      setManualDeadline('');
    }
  };

  const handleManualDateChange = (e) => {
    const val = e.target.value;
    setManualDeadline(val);
    
    // Try to parse as user types if it matches format
    if (val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const parsed = parse(val, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        setDeadline(parsed);
      }
    }
  };

  const handleNewCommentChange = (index, value) => {
    const updatedComments = [...newComments];
    updatedComments[index] = value;
    setNewComments(updatedComments);
  };

  const addNewCommentBox = () => {
    setNewComments([...newComments, '']);
  };

  const removeNewCommentBox = (index) => {
    const updatedComments = newComments.filter((_, i) => i !== index);
    setNewComments(updatedComments);
  };

  const handleSave = async () => {
    // Determine final deadline string for database (yyyy-MM-dd)
    let finalDeadline = null;
    
    // If we have a valid date object selected, ensure formatting is correct
    if (deadline && isValid(deadline)) {
        finalDeadline = format(deadline, 'yyyy-MM-dd');
    } else if (manualDeadline) {
        // Try to parse manual input which is expected to be dd/MM/yyyy
        const parsed = parse(manualDeadline, 'dd/MM/yyyy', new Date());
        if (isValid(parsed)) {
            finalDeadline = format(parsed, 'yyyy-MM-dd');
        }
    }

    // Process comments
    let updatedComments = initialComments || '';
    
    // Filter out empty new comments
    const validNewComments = newComments.filter(c => c.trim() !== '');
    
    if (validNewComments.length > 0) {
        try {
            // Get current user initials
            const { data: { user } } = await dataService.auth.getUser();
            let initials = 'SYS';
            if (user && user.email) {
                // Check for overrides
                if (user.email === 'development@haringeylearns.ac.uk') initials = 'GJ';
                else if (user.email.includes('iona.oakley')) initials = 'IO';
                else {
                    const parts = user.email.split('@')[0].split('.');
                    if (parts.length >= 2) {
                        initials = (parts[0][0] + parts[1][0]).toUpperCase();
                    } else {
                        initials = parts[0].substring(0, 2).toUpperCase();
                    }
                }
            }

            const timestamp = format(new Date(), 'dd/MM/yy, HH:mm');
            const formattedComments = validNewComments.map(c => `(${timestamp}, ${initials}) ${c}`).join('\n');
            
            updatedComments = updatedComments 
                ? `${updatedComments}\n${formattedComments}`
                : formattedComments;

            // Insert notification
            try {
                 const { error: notifError } = await dataService
                    .from('notifications')
                    .insert([{
                      email: user && user.email ? user.email : 'System',
                      comments: formattedComments,
                      "Course ID": courseId
                    }]);

                 if (notifError) {
                    console.error('Backend Notification Insert Error:', notifError);
                    throw notifError;
                 }
            } catch (notifError) {
                console.error('Error creating notification:', notifError);
            }

        } catch (err) {
            console.error('Error getting user info for comments:', err);
            // Fallback without initials if auth fails
            const timestamp = format(new Date(), 'dd/MM/yy, HH:mm');
            const formattedComments = validNewComments.map(c => `(${timestamp}, SYS) ${c}`).join('\n');
             updatedComments = updatedComments 
                ? `${updatedComments}\n${formattedComments}`
                : formattedComments;
        }
    }

    onSave(courseId, status, finalDeadline, actualEnrolments, actualCompletions, updatedComments, publishedOnWebenrol);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold text-gray-800">Status</h3>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
             <p className="text-sm text-gray-500 mb-4">Update status for: <span className="font-medium text-gray-700">{courseName}</span></p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="Pending">Pending</option>
                <option value="Not started">Not started</option>
                <option value="Planned">Planned</option>
                <option value="Live">Live</option>
                <option value="Incomplete">Incomplete</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Errors">Errors</option>
                <option value="Ended">Ended</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <FiCalendar className="text-gray-400" />
                    </div>
                    <DatePicker
                      selected={deadline}
                      onChange={handleDateChange}
                      dateFormat="dd/MM/yyyy"
                      customInput={
                        <input 
                            type="text" 
                            value={manualDeadline} 
                            onChange={handleManualDateChange}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="dd/mm/yyyy"
                        />
                      }
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Format: dd/mm/yyyy</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Enrolments</label>
                  <input
                    type="number"
                    value={actualEnrolments}
                    onChange={(e) => setActualEnrolments(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Actual Completions</label>
                   <input
                     type="number"
                     value={actualCompletions}
                     onChange={(e) => setActualCompletions(e.target.value)}
                     className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                     placeholder="0"
                   />
                 </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Published on webenrol</label>
                <select
                    value={publishedOnWebenrol}
                    onChange={(e) => setPublishedOnWebenrol(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                </select>
            </div>

             <div className="border-t pt-4 mt-4">
               <h4 className="font-medium text-gray-800 mb-3">Comments</h4>
               
               <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Previous Comments</label>
                   <textarea
                     value={initialComments || ''}
                     readOnly
                     className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 outline-none min-h-[80px]"
                     placeholder="No previous comments..."
                   />
               </div>

               <div className="space-y-3">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Add New Comments</label>
                   {newComments.map((comment, index) => (
                       <div key={index} className="flex gap-2">
                           <textarea
                               value={comment}
                               onChange={(e) => handleNewCommentChange(index, e.target.value)}
                               className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[60px]"
                               placeholder="Enter new comment..."
                           />
                           {newComments.length > 1 && (
                               <button 
                                   type="button" 
                                   onClick={() => removeNewCommentBox(index)} 
                                   className="text-red-500 self-center hover:text-red-700 transition-colors p-1"
                                   title="Remove comment"
                               >
                                   <FiTrash size={18} />
                               </button>
                           )}
                       </div>
                   ))}
                   
                   <button 
                       type="button" 
                       onClick={addNewCommentBox} 
                       className="text-blue-600 text-sm flex items-center hover:text-blue-800 transition-colors font-medium"
                   >
                       <FiPlus className="mr-1" /> Add comment
                   </button>
               </div>
             </div>
           </div>
         </div>

        <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50 rounded-b-xl sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
