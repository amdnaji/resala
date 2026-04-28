import React, { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSignalR } from '../contexts/SignalRContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { CreateGroupModal } from './CreateGroupModal';
import { playNotificationSound } from '../utils/audio';
import toast from 'react-hot-toast';

interface Participant {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  profilePictureUrl?: string;
  lastSeenAt: string;
  isOnline: boolean;
}

interface Chat {
  id: string;
  type: 0 | 1;
  title?: string;
  profilePictureUrl?: string;
  participants: Participant[];
  lastMessage?: any;
  unreadCount: number;
}

interface SidebarProps {
  onSelectChat: (chat: Chat) => void;
  selectedChatId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, selectedChatId }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { connection } = useSignalR();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  // Listen for global messages to update sidebar
  useEffect(() => {
    if (!connection) return;

    const handleReceiveMessage = (message: any) => {
      setChats(prevChats => {
        const chatExists = prevChats.some(c => c.id === message.chatId);
        const isFromMe = message.senderId === user?.userId;
        const isSelected = selectedChatId === message.chatId;

        // Play sound and show toast if not from me
        if (!isFromMe) {
          playNotificationSound();
          if (!isSelected || document.visibilityState === 'hidden') {
            const chatName = chatExists 
              ? (prevChats.find(c => c.id === message.chatId)?.title || t('chat.new_message'))
              : t('chat.new_message');
              
            // Show native desktop notification if tab is hidden
            if (document.visibilityState === 'hidden') {
              if (Notification.permission === 'granted') {
                new Notification(chatName, { body: message.content });
              } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    new Notification(chatName, { body: message.content });
                  }
                });
              }
            }
              
            toast.custom((tItem) => (
              <div
                className={`${
                  tItem.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              >
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="ml-3 rtl:mr-3 rtl:ml-0 flex-1">
                      <p className="text-sm font-bold text-gray-900">
                        {chatName}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 truncate">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l rtl:border-r rtl:border-l-0 border-gray-200">
                  <button
                    onClick={() => toast.dismiss(tItem.id)}
                    className="w-full border border-transparent rounded-none rounded-r-xl rtl:rounded-r-none rtl:rounded-l-xl p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                  >
                    {t('common.close') || 'Close'}
                  </button>
                </div>
              </div>
            ));
          }
        }
        
        if (chatExists) {
          // Update existing chat and move to top
          const updatedChats = prevChats.map(c => {
            if (c.id === message.chatId) {
              return { 
                ...c, 
                lastMessage: message,
                unreadCount: (isSelected || isFromMe) ? 0 : (c.unreadCount + 1)
              };
            }
            return c;
          });
          
          return updatedChats.sort((a, b) => {
            const dateA = new Date(a.lastMessage?.createdAt || 0).getTime();
            const dateB = new Date(b.lastMessage?.createdAt || 0).getTime();
            return dateB - dateA;
          });
        } else {
          // If a new chat was created but not loaded yet, fetch all again
          loadChats();
          return prevChats;
        }
      });
    };

    const handleMessagesRead = (chatId: string, userId: string) => {
      setChats(prevChats => 
        prevChats.map(c => 
          c.id === chatId 
            ? { 
                ...c, 
                unreadCount: userId === user?.userId ? 0 : c.unreadCount,
                lastMessage: c.lastMessage && c.lastMessage.chatId === chatId 
                  ? { ...c.lastMessage, isRead: true } 
                  : c.lastMessage 
              } 
            : c
        )
      );
    };

    const handleNewChatCreated = async () => {
      loadChats();
    };

    const handleGroupUpdated = async () => {
      loadChats();
    };

    const handleUserRemoved = async (chatId: string, removedUserId: string) => {
      if (removedUserId === user?.userId) {
         setChats(prev => prev.filter(c => c.id !== chatId));
         if (selectedChatId === chatId) {
            onSelectChat({ id: '' } as any); // Clear selection
         }
      } else {
         loadChats();
      }
    };

    const handleUserStatusChanged = (userId: string, isOnline: boolean, lastSeenAt: string) => {
      setChats(prevChats => 
        prevChats.map(c => ({
          ...c,
          participants: c.participants.map(p => 
            p.userId === userId ? { ...p, isOnline, lastSeenAt } : p
          )
        }))
      );
      
      setSearchResults(prev => 
        prev.map(u => u.userId === userId ? { ...u, isOnline, lastSeenAt } : u)
      );
    };

    connection.on('receivemessage', handleReceiveMessage);
    connection.on('messagesread', handleMessagesRead);
    connection.on('userstatuschanged', handleUserStatusChanged);
    connection.on('newchatcreated', handleNewChatCreated);
    connection.on('groupupdated', handleGroupUpdated);
    connection.on('userremovedfromgroup', handleUserRemoved);

    // Also listen for locally sent messages to update the snippet immediately
    const handleLocalMessage = (event: any) => {
      handleReceiveMessage(event.detail);
    };
    window.addEventListener('LocalMessageSent', handleLocalMessage);

    return () => {
      connection.off('receivemessage', handleReceiveMessage);
      connection.off('messagesread', handleMessagesRead);
      connection.off('userstatuschanged', handleUserStatusChanged);
      connection.off('newchatcreated', handleNewChatCreated);
      connection.off('groupupdated', handleGroupUpdated);
      connection.off('userremovedfromgroup', handleUserRemoved);
      window.removeEventListener('LocalMessageSent', handleLocalMessage);
    };
  }, [connection, user?.userId, selectedChatId]);

  // Re-fetch chats when SignalR connects to get latest online status
  useEffect(() => {
    if (connection?.state === 'Connected') {
      loadChats();
    }
  }, [connection?.state]);

  // Update document title with unread count
  useEffect(() => {
    const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
    const appTitle = t('common.app_title');
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${appTitle}`;
    } else {
      document.title = appTitle;
    }
    
    // Cleanup on unmount
    return () => {
      document.title = appTitle;
    };
  }, [chats, t]);

  const loadChats = async () => {
    try {
      const response = await api.get('/chat');
      const loadedChats = response.data;
      setChats(loadedChats);
      
      // Update the selected chat in the parent if it's currently active 
      // to reflect metadata changes (title, picture, etc.)
      if (selectedChatId) {
        const updatedChat = loadedChats.find((c: Chat) => c.id === selectedChatId);
        if (updatedChat) {
          onSelectChat(updatedChat);
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await api.get('/users/search?query=');
      setSearchResults(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      try {
        const response = await api.get(`/users/search?query=${query}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error('Search failed:', error);
      }
    } else {
      loadAllUsers();
    }
  };

  const startPrivateChat = async (targetUserId: string) => {
    try {
      const response = await api.post('/chat/private', { targetUserId });
      const chatId = response.data.chatId;
      
      // Load updated chats to ensure it's in the list
      const chatResponse = await api.get('/chat');
      setChats(chatResponse.data);
      
      // Find the chat in the newly fetched data
      const newChat = chatResponse.data.find((c: Chat) => c.id === chatId);
      if (newChat) {
        onSelectChat(newChat);
      }
      
      setIsSearching(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const formatChatTimestamp = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('chat.just_now');

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (compareDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    }
    if (compareDate.getTime() === yesterday.getTime()) {
      return t('chat.yesterday');
    }
    
    return date.toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (

    <div className="w-80 border-r rtl:border-l rtl:border-r-0 border-gray-200 bg-white flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
        <h2 className="text-xl font-bold text-gray-800">{t('sidebar.chats')}</h2>
        <button 
          onClick={() => {
            setIsSearching(true);
            loadAllUsers();
          }}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search Bar - Shown either when searching or inline */}
      {isSearching && (
        <div className="p-4 border-b border-gray-200 bg-white shrink-0 flex items-center space-x-2 relative z-10 shadow-sm">
          <div className="relative flex-1">
            <input
              autoFocus
              type="text"
              placeholder={t('sidebar.search_placeholder')}
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm"
            />
            <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-2.5 text-gray-400" size={18} />
          </div>
          <button 
            onClick={() => setIsSearching(false)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Chat List / Search Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div>
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 flex justify-between items-center">
              <span>{searchQuery ? t('sidebar.search_results') : t('sidebar.all_users')}</span>
              {!searchQuery && (
                <button 
                  onClick={() => setShowGroupModal(true)}
                  className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 rtl:space-x-reverse"
                >
                  <Users size={14} />
                  <span>{t('chat.new_group') || "New Group"}</span>
                </button>
              )}
            </div>
            {searchResults.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">{t('sidebar.no_users')}</div>
            )}
            {searchResults.map(u => {
              const display = u.displayName || u.username.split('@')[0];
              return (
                <div
                  key={u.userId}
                  onClick={() => startPrivateChat(u.userId)}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer flex items-center space-x-3 rtl:space-x-reverse transition-colors border-b border-gray-50"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                      {u.profilePictureUrl ? (
                        <img src={u.profilePictureUrl} alt={display} className="w-full h-full object-cover" />
                      ) : (
                        display.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{display}</div>
                    <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full text-gray-500">
             <MessageSquare size={48} className="mb-4 opacity-20" />
             <p className="text-sm">{t('chat.no_chats')}</p>
             <button 
                onClick={() => { setIsSearching(true); loadAllUsers(); }}
                className="mt-4 text-sm text-blue-600 hover:underline font-medium"
             >
               {t('chat.start_conversation')}
             </button>
          </div>
        ) : (
          chats.map(chat => {
            const isSelected = selectedChatId === chat.id;
            // Get display name for private chat
            let chatName = chat.title;
            if (chat.type === 0 && chat.participants) {
               const otherParticipant = chat.participants.find(p => 
                 String(p.userId).toLowerCase() !== String(user?.userId).toLowerCase()
               );
               const resolvedName = otherParticipant?.displayName || otherParticipant?.username;
               chatName = resolvedName ? (resolvedName.includes('@') ? resolvedName.split('@')[0] : resolvedName) : "Unknown User";
            }

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`px-4 py-3 cursor-pointer flex items-center space-x-3 rtl:space-x-reverse transition-colors border-b border-gray-100 group ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${chat.type === 1 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                    {chat.type === 1 ? (
                      chat.profilePictureUrl ? (
                        <img src={chat.profilePictureUrl} alt={chatName} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={20} />
                      )
                    ) : (
                      (() => {
                        const otherParticipant = chat.participants.find(p => p.userId.toLowerCase() !== user?.userId.toLowerCase());
                        const avatar = otherParticipant?.profilePictureUrl;
                        return avatar ? (
                          <img src={avatar} alt={chatName} className="w-full h-full object-cover" />
                        ) : (
                          <MessageSquare size={20} />
                        );
                      })()
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {chatName}
                    </h3>
                    {chat.lastMessage && (
                      <span className={`text-xs ${chat.unreadCount > 0 ? 'text-[#00a884] font-medium' : 'text-gray-400'}`}>
                        {formatChatTimestamp(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={`text-xs truncate flex-1 ${chat.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                      {chat.lastMessage ? chat.lastMessage.content : 'No messages yet...'}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 rtl:mr-2 rtl:ml-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showGroupModal && (
        <CreateGroupModal 
          onClose={() => setShowGroupModal(false)}
          onSuccess={(chatId) => {
            setShowGroupModal(false);
            setIsSearching(false);
            // newchatcreated signalR event will refresh chats, then we can select it
            setTimeout(() => {
               const newChat = chats.find(c => c.id === chatId);
               if (newChat) onSelectChat(newChat);
               else {
                 api.get('/chat').then(response => {
                   setChats(response.data);
                   const found = response.data.find((c: Chat) => c.id === chatId);
                   if (found) onSelectChat(found);
                 });
               }
            }, 500);
          }}
        />
      )}
    </div>
  );
};
