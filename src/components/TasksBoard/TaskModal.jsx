import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiUser, FiFlag, FiCheckSquare, FiAlignLeft } from 'react-icons/fi';
import { format } from 'date-fns';

const TaskModal = ({ isOpen, onClose, onSave, task, users }) => {
  const [formData, setFormData] = useState({
    description: '',
    created_at: format(new Date(), 'yyyy-MM-dd'),
    assigned_to: '',
    deadline: '',
    status: 'To do',
    priority: 4,
    comments: '',
    completion_date: ''
  });

  useEffect(() => {
    if (task) {
      setFormData({
        description: task.description || '',
        created_at: task.created_at ? format(new Date(task.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        assigned_to: task.assigned_to || '',
        deadline: task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : '',
        status: task.status || 'To do',
        priority: task.priority || 4,
        comments: task.comments || '',
        completion_date: task.completion_date ? format(new Date(task.completion_date), 'yyyy-MM-dd') : ''
      });
    } else {
      setFormData({
        description: '',
        created_at: format(new Date(), 'yyyy-MM-dd'),
        assigned_to: '',
        deadline: '',
        status: 'To do',
        priority: 4,
        comments: '',
        completion_date: ''
      });
    }
  }, [task, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      // Convert empty strings to null for optional fields
      assigned_to: formData.assigned_to || null,
      deadline: formData.deadline || null,
      completion_date: formData.completion_date || null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {task?.id ? 'Edit Task' : 'New Task'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
          <div className="flex-grow overflow-y-auto p-6 space-y-5 custom-scrollbar-left" style={{ direction: 'rtl' }}>
            <div style={{ direction: 'ltr' }}>
              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <FiAlignLeft className="mr-2 text-blue-600" /> Description <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-24"
                  placeholder="What needs to be done?"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {/* Created At */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiCalendar className="mr-2 text-blue-600" /> Date Entered
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.created_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, created_at: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiFlag className="mr-2 text-blue-600" /> Deadline
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {/* Assignee */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiUser className="mr-2 text-blue-600" /> Assignee
                  </label>
                  <select
                    value={formData.assigned_to || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Unassigned</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Completion Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiCheckSquare className="mr-2 text-blue-600" /> Completion Date
                  </label>
                  <input
                    type="date"
                    value={formData.completion_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, completion_date: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiCheckSquare className="mr-2 text-blue-600" /> Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="To do">To Do</option>
                    <option value="Planned">Planned</option>
                    <option value="In course">In Course</option>
                    <option value="Completed">Completed</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              
                {/* Priority (Optional explicit control) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FiFlag className="mr-2 text-blue-600" /> Priority (Eisenhower)
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value={1}>Urgent & Important (Do First)</option>
                    <option value={2}>Urgent & Not Important (Delegate)</option>
                    <option value={3}>Not Urgent & Important (Schedule)</option>
                    <option value={4}>Not Urgent & Not Important (Don't Do)</option>
                  </select>
                </div>
              </div>

              {/* Comments */}
              <div className="mt-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <span className="mr-2 text-blue-600">💬</span> Comments
                </label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-24"
                  placeholder="Add your comments here..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-105"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
