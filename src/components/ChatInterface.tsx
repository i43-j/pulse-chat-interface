
import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
}

interface ChatInterfaceProps {
  user: User;
}

export const ChatInterface = ({ user }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    let sessionId = localStorage.getItem('pulseSessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('pulseSessionId', sessionId);
    }
    return sessionId;
  });
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' || 
           (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Webhook URL - replace with your actual endpoint
  const WEBHOOK_URL = 'https://9423-180-190-164-163.ngrok-free.app/webhook/chat/rba';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    localStorage.setItem('darkMode', (!isDark).toString());
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }, 50);
  };

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  const parseMarkdown = (text: string) => {
    // Simple markdown parsing for basic formatting
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
    
    return html;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const retryMessage = async (messageIndex: number) => {
    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.type !== 'user') return;

    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      isLoading: true,
      isError: false
    };
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: userMessage.text,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.answer ?? data.output ?? 'No response received';

      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        text: responseText,
        isLoading: false,
        timestamp: new Date()
      };
      setMessages([...updatedMessages]);

    } catch (error) {
      console.error('Error retrying message:', error);
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        isLoading: false,
        isError: true
      };
      setMessages([...updatedMessages]);
    }

    setIsLoading(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = inputValue.trim();
    if (!messageText || isLoading) return;

    // Add user message
    const userMessage: Message = {
      type: 'user',
      text: messageText,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    // Add bot loading message
    const botMessage: Message = {
      type: 'bot',
      text: '',
      timestamp: new Date(),
      isLoading: true,
      isError: false
    };

    setMessages([...newMessages, botMessage]);
    scrollToBottom();

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: messageText,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.answer ?? data.output ?? 'No response received';

      // Update bot message with response
      const updatedBotMessage: Message = {
        type: 'bot',
        text: responseText,
        timestamp: new Date(),
        isLoading: false,
        isError: false
      };

      setMessages([...newMessages, updatedBotMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update bot message with error state
      const errorBotMessage: Message = {
        type: 'bot',
        text: '',
        timestamp: new Date(),
        isLoading: false,
        isError: true
      };

      setMessages([...newMessages, errorBotMessage]);
    }

    setIsLoading(false);
    setTimeout(() => {
      inputRef.current?.focus();
      scrollToBottom();
    }, 100);
  };

  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Chat Assistant</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Messages Container */}
      <main 
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-lg">Welcome! Start a conversation by typing a message below.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className="max-w-xs sm:max-w-md">
                <div 
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    message.type === 'user' 
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {message.type === 'user' ? (
                    message.text
                  ) : message.isLoading ? (
                    <div className="flex space-x-1" aria-label="Loading response">
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  ) : message.isError ? (
                    <div>
                      <p className="text-red-600 dark:text-red-400 mb-2">Sorry, I encountered an error. Please try again.</p>
                      <button 
                        onClick={() => retryMessage(index)}
                        className="text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-1 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors duration-200 min-h-[44px] min-w-[44px]"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(message.text) }}
                    />
                  )}
                </div>
                <div className={`text-xs text-gray-400 dark:text-gray-500 mt-1 px-2 ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Input Area */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <form onSubmit={sendMessage} className="flex gap-3">
          <input 
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 min-h-[44px]"
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors duration-200 flex items-center justify-center min-w-[44px] min-h-[44px]"
            aria-label="Send message"
          >
            {isLoading ? (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            )}
          </button>
        </form>
      </footer>
    </div>
  );
};
