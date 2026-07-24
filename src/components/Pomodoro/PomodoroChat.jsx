import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiSend, FiMessageSquare } from 'react-icons/fi';
import { format, isValid } from 'date-fns';

const PomodoroChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    let channel;
    try {
      channel = dataService
        .channel('pomodoro_chat')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'pomodoro_chat_messages',
          },
          (payload) => {
            setMessages((current) => [...current, payload.new]);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Chat subscription failed', e);
    }

    return () => {
      if (channel) dataService.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await dataService
        .from('pomodoro_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Optimistic clear

    try {
      const { error } = await dataService
        .from('pomodoro_chat_messages')
        .insert([
          {
            content: messageContent,
            user_id: user.id,
            user_email: user.email, // Storing email for display simplicity
          },
        ]);

      if (error) {
        // Ideally restore message if failed, but for simple chat we alert
        // Fixed unreachable code by moving throw error to the end
        alert('Failed to send message');
        setNewMessage(messageContent);
        throw error;
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getInitials = (email) => {
    if (!email) return '??';
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return localPart.substring(0, 2).toUpperCase();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
        <FiMessageSquare className="w-12 h-12 mb-4 text-gray-300" />
        <p>Please log in to join the chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-xl">
          <FiMessageSquare className="text-blue-600 w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800">Team Chat</h2>
          <p className="text-xs text-gray-500 font-medium">Stay connected</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent hover:scrollbar-thumb-gray-300 transition-colors" style={{ direction: 'rtl' }}>
        <div style={{ direction: 'ltr' }}>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user.id;
            const initials = getInitials(msg.user_email);

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar for ALL users */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold shadow-sm ${
                    isOwn
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                  title={msg.user_email}
                >
                  {initials}
                </div>

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm shadow-sm break-words ${
                      isOwn
                        ? 'bg-blue-50 text-blue-900 rounded-tr-none'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <p>{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {(() => {
                      const d = new Date(msg.created_at);
                      return isValid(d) ? format(d, 'HH:mm') : '';
                    })()}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-200"
          >
            <FiSend className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default PomodoroChat;
