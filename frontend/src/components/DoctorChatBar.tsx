import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, AlertCircle, Bell, Check } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Notification {
  id: string;
  patient_id: string;
  notification_type: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  first_name: string;
  last_name: string;
  medical_record_number: string;
}

interface DoctorChatBarProps {
  currentPatientId?: string;
  apiBaseUrl?: string;
}

export const DoctorChatBar: React.FC<DoctorChatBarProps> = ({
  currentPatientId,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch notifications periodically
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/notifications/unread`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSendMessage = async (messageContentOrEvent?: string | React.MouseEvent) => {
    // If it's a string, use it; otherwise use inputValue
    const content = typeof messageContentOrEvent === 'string' ? messageContentOrEvent : inputValue;
    if (!content.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: content,
      timestamp: new Date(),
    };

    // Always add the message to state
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Sending request to:', `${apiBaseUrl}/api/agent/chat`);
      console.log('Message count:', messages.length + 1);

      const response = await fetch(`${apiBaseUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          patientId: currentPatientId,
          includeRecentLabs: true,
          includeRiskAssessment: true,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Got response from AI');

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('API Base URL:', apiBaseUrl);

      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Sorry, I encountered an error processing your request. Please try again.'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    try {
      await fetch(`${apiBaseUrl}/api/notifications/${notification.id}/read`, {
        method: 'POST',
      });

      // Update local state
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notification.id)
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Add context to chat and trigger AI response
      const messageContent = `Tell me about the alert: ${notification.subject}`;

      setShowNotifications(false);
      handleSendMessage(messageContent);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-500 text-red-900';
      case 'HIGH':
        return 'bg-orange-100 border-orange-500 text-orange-900';
      case 'MODERATE':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-900';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MODERATE':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Notification Badge */}
        {unreadCount > 0 && !isOpen && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {unreadCount}
          </div>
        )}

        {/* Chat Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110"
          aria-label="Toggle Doctor Assistant"
        >
          {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl z-50 flex flex-col border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <h3 className="font-semibold">Doctor Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Notifications Toggle */}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-blue-700 rounded-full transition"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Patient Context Banner */}
          {currentPatientId && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
              <AlertCircle size={14} className="inline mr-1" />
              Context: Current patient
            </div>
          )}

          {/* Content Area */}
          {showNotifications ? (
            /* Notifications Panel */
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-700">
                  Notifications ({unreadCount})
                </h4>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Back to Chat
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Check size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>No unread notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition ${getPriorityColor(
                      notification.priority
                    )}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${getPriorityBadge(
                          notification.priority
                        )} text-white`}
                      >
                        {notification.priority}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-semibold text-sm mb-1">
                      {notification.subject}
                    </p>
                    <p className="text-xs opacity-90">{notification.message}</p>
                    <p className="text-xs mt-1 font-medium">
                      {notification.first_name} {notification.last_name} (MRN:{' '}
                      {notification.medical_record_number})
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Chat Messages */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                    <p className="mb-2">Hi! I'm your AI Doctor Assistant.</p>
                    <p className="text-sm">
                      Ask me about patients, lab results, clinical guidelines, or
                      treatment recommendations.
                    </p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    aria-label="Send message"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
