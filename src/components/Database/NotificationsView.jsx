import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiBell, FiClock, FiUser, FiBook, FiRefreshCw, FiCopy, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const NotificationsView = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications and updates
    const subscription = dataService
      .channel('notifications_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications' }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => 
              n.id === payload.new.id ? payload.new : n
            ));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await dataService
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Fetch last 50 notifications

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompleted = async (notification) => {
    try {
      const newStatus = notification['Completed?'] === 'Yes' ? null : 'Yes';
      
      // Optimistic update
      setNotifications(prev => prev.map(n => 
        n.id === notification.id 
          ? { ...n, 'Completed?': newStatus } 
          : n
      ));

      const { error } = await dataService
        .from('notifications')
        .update({ 'Completed?': newStatus })
        .eq('id', notification.id);

      if (error) {
        // Revert on error
        setNotifications(prev => prev.map(n => 
          n.id === notification.id 
            ? { ...n, 'Completed?': notification['Completed?'] } 
            : n
        ));
        throw error;
      }
    } catch (error) {
      console.error('Error updating notification status:', error);
      toast.error('Failed to update status. Please check if the "Completed?" column exists in the database.');
    }
  };

  const handleCourseClick = (courseId) => {
    // Copy to clipboard (optional but good UX)
    navigator.clipboard.writeText(courseId).catch(err => console.error('Failed to copy:', err));
    
    // Open Our Courses view
    const url = `${window.location.origin}/?view=our-courses&filter=All&search=${encodeURIComponent(courseId)}`;
    window.open(url, '_blank');
  };

  const handleQuickCopyClick = (courseId) => {
    // Copy to clipboard
    navigator.clipboard.writeText(courseId).catch(err => console.error('Failed to copy:', err));
    
    // Open Courses view (database view)
    const url = `${window.location.origin}/?view=courses&filter=All&search=${encodeURIComponent(courseId)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiBell className="h-6 w-6 text-blue-600" />
          Notifications
        </h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Showing last {notifications.length} notifications
          </div>
          <button 
            onClick={fetchNotifications}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Refresh notifications"
          >
            <FiRefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <FiUser className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.email}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <FiClock className="mr-1 h-3 w-3" />
                        {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                    {notification['Course ID'] && (
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-blue-600 group"
                          onClick={() => handleCourseClick(notification['Course ID'])}
                          title="Click to view course"
                        >
                          <FiBook className="h-3 w-3 text-gray-400 group-hover:text-blue-600" />
                          <p className="text-xs font-medium text-gray-600 group-hover:text-blue-600 underline decoration-dotted">
                            {notification['Course ID']}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickCopyClick(notification['Course ID']);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy Course ID and open in new tab"
                        >
                          <FiCopy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 break-words bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                      {notification.comments}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-2 mt-1">
                    <button 
                      onClick={() => toggleCompleted(notification)} 
                      title={notification['Completed?'] === 'Yes' ? 'Mark as incomplete' : 'Mark as completed'}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      {notification['Completed?'] === 'Yes' 
                        ? <FiCheckSquare className="h-5 w-5 text-green-600" /> 
                        : <FiSquare className="h-5 w-5 text-gray-400 hover:text-blue-600" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-50 p-4 rounded-full">
                <FiBell className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm mt-1">Comments added to courses will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
