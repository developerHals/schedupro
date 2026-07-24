import React from 'react';
import { FiAlertCircle, FiClock, FiCheckCircle, FiTrash2 } from 'react-icons/fi';

const EisenhowerMatrix = ({ tasks, users, onUpdatePriority, onEditTask }) => {
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, priority) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onUpdatePriority(taskId, priority);
    }
  };

  const getQuadrantTasks = (priority) => {
    return tasks.filter(t => (t.priority || 4) === priority);
  };

  const Quadrant = ({ priority, title, description, color, icon: Icon }) => (
    <div
      className={`flex-1 border rounded-xl flex flex-col h-full ${color}`}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, priority)}
    >
      <div className="p-4 border-b border-gray-200/50 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </h3>
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        </div>
        <span className="bg-white/80 px-2 py-1 rounded-full text-xs font-bold shadow-sm">
          {getQuadrantTasks(priority).length}
        </span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-2">
        {getQuadrantTasks(priority).map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onClick={() => onEditTask(task)}
            className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.description}</p>
            {task.assigned_to && (
              <p className="text-xs text-gray-500 mt-2 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
                {users.find(u => u.id === task.assigned_to)?.full_name || 'Assigned'}
              </p>
            )}
          </div>
        ))}
        {getQuadrantTasks(priority).length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4 min-h-[600px]">
      <div className="flex justify-between items-center text-gray-500 text-sm mb-2">
        <span>High Importance</span>
        <span>Low Importance</span>
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-4 h-full">
        {/* Row 1: Important */}
        <div className="flex flex-col gap-4 h-full">
            {/* Q1: Urgent & Important (P1) */}
            <Quadrant
                priority={1}
                title="Do First"
                description="Urgent & Important"
                color="bg-red-50 border-red-200"
                icon={FiAlertCircle}
            />
            {/* Q3: Urgent & Not Important (P2) */}
            <Quadrant
                priority={2}
                title="Delegate"
                description="Urgent & Not Important"
                color="bg-orange-50 border-orange-200"
                icon={FiClock}
            />
        </div>
        
        <div className="flex flex-col gap-4 h-full">
             {/* Q2: Not Urgent & Important (P3) */}
             <Quadrant
                priority={3}
                title="Schedule"
                description="Not Urgent & Important"
                color="bg-blue-50 border-blue-200"
                icon={FiCheckCircle}
            />
             {/* Q4: Not Urgent & Not Important (P4) */}
             <Quadrant
                priority={4}
                title="Don't Do"
                description="Not Urgent & Not Important"
                color="bg-gray-100 border-gray-200"
                icon={FiTrash2}
            />
        </div>
      </div>
      
       <div className="flex justify-between items-center text-gray-500 text-sm mt-2 px-10">
        <span className="font-bold text-red-600">Urgent</span>
        <span className="font-bold text-gray-600">Not Urgent</span>
      </div>
    </div>
  );
};

export default EisenhowerMatrix;
