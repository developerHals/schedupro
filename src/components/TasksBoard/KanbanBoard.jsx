import React from 'react';
import { format } from 'date-fns';
import { FiClock, FiUser, FiPlus } from 'react-icons/fi';

const COLUMNS = [
  { id: 'To do', title: 'To Do', color: 'bg-gray-100', border: 'border-gray-200' },
  { id: 'Planned', title: 'Planned', color: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'In course', title: 'In Course', color: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'Completed', title: 'Completed', color: 'bg-green-50', border: 'border-green-200' },
  { id: 'Closed', title: 'Closed', color: 'bg-purple-50', border: 'border-purple-200' }
];

const PRIORITY_LABELS = {
  1: { label: 'Urgent & Important', color: 'bg-red-100 text-red-800' },
  2: { label: 'Urgent', color: 'bg-orange-100 text-orange-800' },
  3: { label: 'Important', color: 'bg-blue-100 text-blue-800' },
  4: { label: 'Routine', color: 'bg-gray-100 text-gray-800' }
};

const KanbanBoard = ({ tasks, users, onUpdateStatus, onEditTask, onNewTask }) => {
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onUpdateStatus(taskId, status);
    }
  };

  const getAssigneeName = (userId) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user ? (user.full_name || user.email) : 'Unknown';
  };

  // Sort tasks by priority (1 is highest)
  const sortedTasks = [...tasks].sort((a, b) => {
    const pA = a.priority || 99;
    const pB = b.priority || 99;
    return pA - pB;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-[500px] overflow-x-auto pb-4">
      {COLUMNS.map(column => (
        <div
          key={column.id}
          className={`flex-1 min-w-[280px] rounded-xl ${column.color} border ${column.border} flex flex-col`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="p-3 border-b border-gray-200/50 bg-white/50 rounded-t-xl sticky top-0 backdrop-blur-sm z-10">
            <h3 className="font-semibold text-gray-700 flex justify-between items-center">
              <span>{column.title}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNewTask(column.id)}
                  className="p-1 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-blue-600"
                  title={`Add task to ${column.title}`}
                >
                  <FiPlus className="h-4 w-4" />
                </button>
                <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm text-gray-500">
                  {tasks.filter(t => t.status === column.id).length}
                </span>
              </div>
            </h3>
          </div>

          <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-250px)]">
            {sortedTasks
              .filter(task => task.status === column.id)
              .map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => onEditTask(task)}
                  className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow group relative"
                >
                  {/* Priority Badge */}
                  {task.priority && (
                    <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mb-2 font-medium ${PRIORITY_LABELS[task.priority]?.color || 'bg-gray-100'}`}>
                      {PRIORITY_LABELS[task.priority]?.label || 'No Priority'}
                    </div>
                  )}

                  <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">{task.description}</h4>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-2 border-t border-gray-50">
                    <div className="flex items-center" title="Assignee">
                      <FiUser className="mr-1" />
                      <span className="max-w-[80px] truncate">{getAssigneeName(task.assigned_to)}</span>
                    </div>
                    
                    {task.deadline && (
                      <div className={`flex items-center ${new Date(task.deadline) < new Date() ? 'text-red-600 font-bold' : ''}`} title="Deadline">
                        <FiClock className="mr-1" />
                        {format(new Date(task.deadline), 'MMM d')}
                      </div>
                    )}
                  </div>
                  
                  {/* Hover visual cue */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-1.5 w-8 bg-gray-200 rounded-full" />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;
