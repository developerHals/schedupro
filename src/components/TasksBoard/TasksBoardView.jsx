import React, { useState, useEffect } from 'react';
import { FiPlus, FiGrid, FiLayout, FiActivity, FiRefreshCw } from 'react-icons/fi';
import { dataService } from '../../lib/dataService';
import KanbanBoard from './KanbanBoard';
import EisenhowerMatrix from './EisenhowerMatrix';
import GanttChart from './GanttChart';
import TaskModal from './TaskModal';

const TasksBoardView = () => {
  const [view, setView] = useState('kanban'); // 'kanban', 'matrix', 'gantt'
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await dataService
        .from('profiles')
        .select('*');
      
      if (usersError) console.error('Error fetching users:', usersError);
      else setUsers(usersData || []);

      // Fetch tasks
      // Assuming 'tasks' table exists. If not, we might need to handle it.
      const { data: tasksData, error: tasksError } = await dataService
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        // If table doesn't exist, we might get an error. 
        // For now, we'll assume it exists or fail gracefully.
      } else {
        setTasks(tasksData || []);
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = (initialStatus = 'To do') => {
    setCurrentTask({ status: initialStatus });
    setIsModalOpen(true);
  };

  const handleEditTask = (task) => {
    setCurrentTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (currentTask?.id) {
        // Update
        const { error } = await dataService
          .from('tasks')
          .update(taskData)
          .eq('id', currentTask.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await dataService
          .from('tasks')
          .insert([taskData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task. Please try again.');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus, newPriority = null) => {
    try {
      const updates = { status: newStatus };
      if (newPriority !== null) updates.priority = newPriority;

      // Auto-set completion date if moved to Completed
      if (newStatus === 'Completed') {
        updates.completion_date = new Date().toISOString();
      }

      const { error } = await dataService
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Optimistic update
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
      setRefreshTrigger(prev => prev + 1); // Revert on error
    }
  };
  
  const handleUpdateTaskPriority = async (taskId, newPriority) => {
    try {
      const { error } = await dataService
        .from('tasks')
        .update({ priority: newPriority })
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Optimistic update
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, priority: newPriority } : t
      ));
    } catch (error) {
      console.error('Error updating task priority:', error);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FiLayout className="mr-2" /> Tasks Board
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage project tasks and priorities</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
              view === 'kanban' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FiLayout className="mr-2" /> Kanban
          </button>
          <button
            onClick={() => setView('matrix')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
              view === 'matrix' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FiGrid className="mr-2" /> Eisenhower
          </button>
          <button
            onClick={() => setView('gantt')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
              view === 'gantt' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FiActivity className="mr-2" /> Gantt
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateTask('To do')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FiPlus className="mr-2" /> New Task
          </button>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 rounded-xl min-h-[600px] border border-gray-200 p-4 overflow-x-auto">
        {view === 'kanban' && (
          <KanbanBoard 
            tasks={tasks} 
            users={users}
            onUpdateStatus={handleUpdateTaskStatus}
            onEditTask={handleEditTask}
            onNewTask={handleCreateTask}
          />
        )}
        {view === 'matrix' && (
          <EisenhowerMatrix 
            tasks={tasks.filter(t => t.status === 'To do')} 
            users={users}
            onUpdatePriority={handleUpdateTaskPriority}
            onEditTask={handleEditTask}
          />
        )}
        {view === 'gantt' && (
          <GanttChart 
            tasks={tasks} 
            users={users}
            onEditTask={handleEditTask}
          />
        )}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={currentTask}
        users={users}
      />
    </div>
  );
};

export default TasksBoardView;
