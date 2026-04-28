import React, { useState, useEffect, useRef } from 'react';
import { Send, MoreVertical, Phone, Video, CheckCheck, ArrowLeft, Smile, Reply, X, Plus, Paperclip, Loader2, Trash2 } from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../contexts/AuthContext';
import { useSignalR } from '../contexts/SignalRContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { ChatInfoSidebar } from './ChatInfoSidebar';

interface ChatAreaProps {
  chat: any;
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ chat, onBack }) => {
  const { user } = useAuth();
  const { connection, isConnected } = useSignalR();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [activeMessagePicker, setActiveMessagePicker] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<any[]>([]);
  const [focusedAttachmentIndex, setFocusedAttachmentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const { t, i18n } = useTranslation();

  // Determine chat name
  let chatName = chat.title;
  const [otherParticipant, setOtherParticipant] = useState<any>(null);

  useEffect(() => {
    if (chat.type === 0 && user && chat.participants) {
      const other = chat.participants.find((p: any) => 
        String(p.userId).toLowerCase() !== String(user.userId).toLowerCase()
      );
      setOtherParticipant(other);
    } else {
      setOtherParticipant(null);
    }
  }, [chat, user]);

  if (chat.type === 0 && otherParticipant) {
    const name = otherParticipant.displayName || otherParticipant.username || "Private Chat";
    chatName = name.includes('@') ? name.split('@')[0] : name;
  }

  const formatLastSeen = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('chat.just_now');
    if (diffMins < 60) return `${diffMins}m ${t('chat.ago')}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${t('chat.ago')}`;
    
    return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (compareDate.getTime() === today.getTime()) return t('chat.today');
    if (compareDate.getTime() === yesterday.getTime()) return t('chat.yesterday');
    
    return date.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const isSameDay = (date1: string, date2: string) => {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // even if the other values haven't changed.
  const relativeLastSeen = tick > -1 && otherParticipant?.lastSeenAt ? formatLastSeen(otherParticipant.lastSeenAt) : '';
  const lastSeenLabel = otherParticipant?.isOnline ? t('chat.online') : (otherParticipant?.lastSeenAt ? `${t('chat.last_seen')} ${relativeLastSeen}` : t('chat.last_seen_recent'));

  useEffect(() => {
    if (chat.id && isConnected) {
      loadMessages();
      markAsRead();
    }
  }, [chat.id, isConnected]);

  const markAsRead = () => {
    if (connection && chat.id) {
      connection.invoke('MarkMessagesAsRead', chat.id).catch(console.error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (connection) {
      const handleReceive = (message: any) => {
        if (message.chatId === chat.id) {
          setMessages(prev => [...prev, message]);
          // If we are currently looking at this chat, mark as read
          markAsRead();
        }
      };

      const handleRead = (chatId: string, _userId: string) => {
        if (chatId === chat.id) {
          setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
        }
      };

      const handleTyping = (chatId: string, _senderId: string, status: boolean) => {
        if (chatId === chat.id) {
           setIsTyping(status);
           if (status && messagesEndRef.current) {
               // Quick scroll when someone starts typing to ensure it's visible
               setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
           }
        }
      };

      const handleUserStatus = (userId: string, isOnline: boolean, lastSeenAt: string) => {
        setOtherParticipant((prev: any) => {
          if (prev && prev.userId.toLowerCase() === userId.toLowerCase()) {
            return { ...prev, isOnline, lastSeenAt };
          }
          return prev;
        });
      };

      const handleReaction = (reactionUpdate: any) => {
         setMessages(prev => prev.map(m => {
           if (m.id === reactionUpdate.messageId) {
             const reactions = m.reactions || [];
             // First, remove any existing reaction from this user regardless of emoji
             const filteredReactions = reactions.filter((r: any) => r.userId !== reactionUpdate.userId);
             
             if (reactionUpdate.isAdded) {
               return { ...m, reactions: [...filteredReactions, reactionUpdate] };
             } else {
               return { ...m, reactions: filteredReactions };
             }
           }
           return m;
         }));
      };

      const handleSystemMessage = (cId: string, content: string, createdAt: string) => {
        if (cId === chat.id) {
           setMessages(prev => [...prev, {
             id: crypto.randomUUID(),
             chatId: cId,
             senderId: 'SYSTEM',
             content,
             createdAt,
             isRead: true,
             attachments: [],
             reactions: []
           }]);
        }
      };

        connection.on('receivemessage', handleReceive);
        connection.on('messagesread', handleRead);
        connection.on('usertyping', handleTyping);
        connection.on('userstatuschanged', handleUserStatus);
        connection.on('messagereactionchanged', handleReaction);
        connection.on('systemmessage', handleSystemMessage);

        return () => {
          connection.off('receivemessage', handleReceive);
          connection.off('usertyping', handleTyping);
          connection.off('messagesread', handleRead);
          connection.off('userstatuschanged', handleUserStatus);
          connection.off('messagereactionchanged', handleReaction);
          connection.off('systemmessage', handleSystemMessage);
        };
    }
  }, [connection, chat.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const loadMessages = async () => {
    try {
      const response = await api.get(`/chat/${chat.id}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-yellow-400');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-yellow-400');
      }, 2000);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleReaction = async (messageId: string, emoji: string) => {
    setActiveMessagePicker(null);
    if (connection && chat.id) {
      try {
        await connection.invoke('ToggleReaction', messageId, emoji);
      } catch (error) {
        console.error('Failed to toggle reaction', error);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    const files = Array.from(e.target.files);
    
    const isFirstUpload = pendingAttachments.length === 0;
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPendingAttachments(prev => [...prev, response.data]);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
    
    if (isFirstUpload) setFocusedAttachmentIndex(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const newArr = prev.filter((_, i) => i !== index);
      if (focusedAttachmentIndex >= newArr.length) {
        setFocusedAttachmentIndex(Math.max(0, newArr.length - 1));
      } else if (focusedAttachmentIndex > index) {
        setFocusedAttachmentIndex(focusedAttachmentIndex - 1);
      }
      return newArr;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !connection || isUploading) return;

    try {
      const content = newMessage.trim();
      await connection.invoke('SendMessage', chat.id, content, replyingTo?.id || null, pendingAttachments);
      
      // Dispatch an event so the sidebar can update instantly
      const localMessage = {
        id: crypto.randomUUID(), // Temp ID
        chatId: chat.id,
        senderId: user?.userId,
        content: content,
        createdAt: new Date().toISOString(),
        isRead: false,
        parentMessageId: replyingTo?.id,
        parentMessageContent: replyingTo?.content,
        parentMessageSenderName: replyingTo?.senderName || (replyingTo?.senderId === user?.userId ? user?.displayName : otherParticipant?.displayName),
        attachments: pendingAttachments
      };
      const event = new CustomEvent('LocalMessageSent', { detail: localMessage });
      window.dispatchEvent(event);
      
      setNewMessage('');
      setReplyingTo(null);
      setPendingAttachments([]);
    } catch (error) {
      console.error('Error sending message: ', error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (connection) {
      // Send started typing
      if (e.target.value.length === 1 && newMessage.length === 0) {
        connection.invoke('TypingStatus', chat.id, true).catch(console.error);
      }

      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send stopped typing if no input for 2 seconds
      typingTimeoutRef.current = setTimeout(() => {
        connection.invoke('TypingStatus', chat.id, false).catch(console.error);
      }, 2000);
    }
  };

  return (
    <>
      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {pendingAttachments.length > 0 ? (
        <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] z-50 relative">
          {/* Header */}
          <div className="h-16 px-4 bg-white flex items-center justify-between shadow-sm shrink-0">
            <button 
              onClick={() => { setPendingAttachments([]); setFocusedAttachmentIndex(0); setNewMessage(''); }} 
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors rtl:rotate-180"
            >
              <X size={24} />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center truncate px-4">
              <h2 className="text-gray-800 font-medium truncate w-full text-center max-w-md">
                {pendingAttachments[focusedAttachmentIndex]?.originalFileName}
              </h2>
              <p className="text-xs text-gray-500">
                {pendingAttachments[focusedAttachmentIndex] ? Math.round(pendingAttachments[focusedAttachmentIndex].fileSize / 1024) + ' KB' : ''}
              </p>
            </div>
            <button 
              onClick={() => removePendingAttachment(focusedAttachmentIndex)} 
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Remove file"
            >
              <Trash2 size={24} />
            </button>
          </div>

          {/* Center Preview */}
          <div className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center">
            {isUploading && pendingAttachments.length === 0 ? (
              <div className="flex flex-col items-center text-gray-500">
                <Loader2 size={48} className="animate-spin mb-4 text-green-500" />
                <p>Preparing files...</p>
              </div>
            ) : pendingAttachments[focusedAttachmentIndex] ? (
              pendingAttachments[focusedAttachmentIndex].fileType === 'image' ? (
                <div className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-xl">
                  <img 
                    src={pendingAttachments[focusedAttachmentIndex].fileUrl} 
                    className="object-contain max-h-[60vh] md:max-h-[70vh] w-auto" 
                    alt="preview" 
                  />
                </div>
              ) : (
                <div className="h-48 w-48 sm:h-64 sm:w-64 bg-white shadow-xl flex flex-col items-center justify-center text-gray-400 rounded-lg transform transition-transform hover:scale-105">
                  <Paperclip size={64} className="mb-4 text-green-500" />
                  <span className="text-sm font-medium px-4 text-center truncate w-full">
                    {pendingAttachments[focusedAttachmentIndex].originalFileName}
                  </span>
                </div>
              )
            ) : null}
          </div>

          {/* Bottom Action Area */}
          <div className="bg-white px-4 py-4 md:px-8 flex flex-col items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative">
            
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full mb-2 right-4 sm:right-auto z-50">
                <EmojiPicker 
                  onEmojiClick={onEmojiClick} 
                  autoFocusSearch={false}
                  theme={Theme.LIGHT}
                  width={300}
                  height={350}
                />
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="w-full max-w-2xl bg-gray-100 rounded-2xl flex items-center px-4 py-3 mb-6 border border-gray-200 focus-within:ring-2 focus-within:ring-green-400 focus-within:border-transparent transition-all">
              <input
                type="text"
                placeholder={t('chat.type_message')}
                value={newMessage}
                onChange={handleTyping}
                className="flex-1 bg-transparent focus:outline-none text-gray-700 placeholder-gray-500"
              />
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className="text-gray-500 hover:text-gray-700 ml-2 transition-colors"
              >
                <Smile size={24} />
              </button>
            </form>

            {/* Thumbnails */}
            <div className="flex items-center gap-3 overflow-x-auto w-full max-w-3xl justify-center pb-2 hidden-scrollbar">
              {pendingAttachments.map((att, idx) => (
                <div key={idx} className="relative group shrink-0">
                  <div 
                    onClick={() => setFocusedAttachmentIndex(idx)}
                    className={`h-14 w-14 sm:h-16 sm:w-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      focusedAttachmentIndex === idx 
                        ? 'border-green-500 scale-105 shadow-md' 
                        : 'border-transparent opacity-80 hover:opacity-100 bg-white'
                    }`}
                  >
                    {att.fileType === 'image' ? (
                      <img src={att.fileUrl} className="h-full w-full object-cover" alt="thumb" />
                    ) : (
                      <div className="h-full w-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Paperclip size={24} />
                      </div>
                    )}
                  </div>
                  
                  {/* Delete Thumbnail Button */}
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePendingAttachment(idx); }}
                    className="absolute top-0.5 right-0.5 text-gray-700 hover:text-red-600 z-10 p-0.5 rounded-full bg-white/40 hover:bg-white/80 transition-colors"
                    title="Remove this file"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              
              {isUploading ? (
                 <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-green-500">
                   <Loader2 size={24} className="animate-spin" />
                 </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()} 
                  className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                  <Plus size={28} />
                </button>
              )}
            </div>

            {/* Send Button Absolute */}
            <div className="absolute top-0 right-4 sm:right-8 -translate-y-1/2">
              <button 
                type="button"
                onClick={handleSendMessage}
                disabled={isUploading}
                className="h-14 w-14 sm:h-16 sm:w-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_4px_15px_rgba(34,197,94,0.4)] hover:bg-green-600 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed rtl:rotate-180"
              >
                <Send size={24} className="ml-1 rtl:mr-1 rtl:ml-0" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full bg-[#E4EFE7]">
          {/* Header */}
          <div className="h-16 px-4 md:px-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
            <div className="flex items-center space-x-2 md:space-x-4">
              {onBack && (
                <button 
                  onClick={onBack}
                  className="p-2 -ml-2 rtl:-mr-2 rtl:ml-0 text-gray-500 hover:bg-gray-100 rounded-full transition-colors rtl:rotate-180"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                  {(() => {
                    const avatar = otherParticipant?.profilePictureUrl;
                    if (avatar) return <img src={avatar} alt={chatName} className="w-full h-full object-cover" />;
                    return chatName?.charAt(0).toUpperCase();
                  })()}
                </div>
                {chat.type === 0 && otherParticipant?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-800 truncate">{chatName}</h2>
                {chat.type === 0 && (
                  <div className="h-4"> {/* Fixed height to prevent layout shift */}
                     {isTyping ? (
                       <p className="text-xs text-blue-500 font-medium animate-pulse">{t('chat.typing')}</p>
                     ) : (
                       <p className={`text-xs font-medium tracking-wide ${otherParticipant?.isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                         {lastSeenLabel}
                       </p>
                     )}
                  </div>
                )}
                {chat.type === 1 && (
                  <div className="h-4">
                     {isTyping ? (
                       <p className="text-xs text-blue-500 font-medium animate-pulse">{t('chat.someone_typing')}</p>
                     ) : (
                       <p className="text-xs text-gray-500">
                         {chat.participants.length} {t('chat.participants')}
                       </p>
                     )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center space-x-3 text-gray-400 shrink-0">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Phone size={20} /></button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Video size={20} /></button>
              <button 
                onClick={() => setShowChatInfo(!showChatInfo)}
                className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${showChatInfo ? 'text-blue-600 bg-blue-50' : ''}`}
                title="Chat Info"
              >
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col h-full min-w-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 shadow-inner">
                {messages.map((msg, index) => {
                  const isMine = msg.senderId === user?.userId;
                  const showSenderName = !isMine && chat.type === 1 && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                  const showDateSeparator = index === 0 || !isSameDay(messages[index - 1].createdAt, msg.createdAt);

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-6">
                          <div className="px-4 py-1 bg-white/60 backdrop-blur-sm border border-gray-100 rounded-full text-[11px] font-bold text-gray-500 shadow-sm uppercase tracking-wider">
                            {formatDateSeparator(msg.createdAt)}
                          </div>
                        </div>
                      )}
                      
                      {msg.senderId === 'SYSTEM' ? (
                        <div className="flex justify-center my-4">
                          <div className="px-4 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium text-center shadow-sm w-fit max-w-[80%]">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] relative group ${isMine ? 'order-2' : 'order-1'}`}>
                          {showSenderName && (
                            <span className="text-xs text-gray-500 ml-2 mb-1 block">{msg.senderName}</span>
                          )}
                          <div 
                            id={`msg-${msg.id}`}
                            className={`px-4 py-2.5 rounded-2xl shadow-sm transition-shadow duration-500 ${
                              isMine 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                            }`}
                          >
                            {msg.parentMessageId && (
                              <div 
                                onClick={() => scrollToMessage(msg.parentMessageId)}
                                className={`mb-1.5 p-2 rounded text-[13px] border-l-4 rtl:border-r-4 rtl:border-l-0 cursor-pointer hover:opacity-80 transition-opacity ${isMine ? 'bg-blue-700/40 border-blue-300' : 'bg-gray-50 border-gray-300'}`}>
                                <div className={`font-semibold text-xs mb-0.5 ${isMine ? 'text-blue-100' : 'text-gray-600'}`}>{msg.parentMessageSenderName}</div>
                                <div className={`truncate opacity-90 ${isMine ? 'text-white' : 'text-gray-600'}`}>{msg.parentMessageContent}</div>
                              </div>
                            )}
                            
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`mb-2 ${msg.attachments.length > 1 ? 'w-48 sm:w-64 max-w-full grid gap-[2px]' : 'flex flex-col gap-2'}`}
                                   style={{
                                     gridTemplateColumns: msg.attachments.length > 1 ? 'repeat(2, 1fr)' : undefined,
                                     gridTemplateRows: msg.attachments.length === 2 ? '1fr' : msg.attachments.length >= 3 ? 'repeat(2, 1fr)' : undefined,
                                   }}
                              >
                                {msg.attachments.length === 1 ? (
                                  msg.attachments.map((att: any, attIdx: number) => (
                                    att.fileType === 'image' ? (
                                      <a key={attIdx} href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={att.fileUrl} alt="attachment" className="max-w-xs sm:max-w-sm rounded-lg cursor-pointer hover:opacity-90 max-h-64 object-contain shadow-sm" />
                                      </a>
                                    ) : (
                                      <a key={attIdx} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex w-full items-center gap-2 p-2.5 rounded-lg transition-colors text-sm font-medium shadow-sm ${isMine ? 'bg-blue-700/40 hover:bg-blue-700/60 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>
                                        <Paperclip size={16} className="shrink-0" /> 
                                        <span className="truncate flex-1 max-w-[200px]">{att.originalFileName}</span>
                                      </a>
                                    )
                                  ))
                                ) : (
                                  msg.attachments.slice(0, 4).map((att: any, attIdx: number) => {
                                    const isLastAndMore = attIdx === 3 && msg.attachments.length > 4;
                                    const remainingCount = msg.attachments.length - 4;
                                    const isThreeGridFirst = msg.attachments.length === 3 && attIdx === 0;

                                    return (
                                      <a 
                                        key={attIdx} 
                                        href={att.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className={`relative overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity bg-black/5 shadow-sm outline outline-1 ${isMine ? 'outline-blue-700/20' : 'outline-black/5'} ${
                                          isThreeGridFirst ? "col-span-2 h-32 sm:h-40" : "h-24 sm:h-32"
                                        } rounded-lg ${!isMine && att.fileType !== 'image' ? 'bg-gray-200' : ''}`}
                                      >
                                        {att.fileType === 'image' ? (
                                          <img src={att.fileUrl} alt="attachment" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className={`flex flex-col items-center justify-center p-2 w-full h-full ${isMine ? 'bg-[#567fb1] text-blue-50' : 'bg-[#e0e7ee] text-gray-700'}`}>
                                            <div className="px-3 py-1.5 rounded-full flex gap-1 items-center bg-black/20 text-white mb-2 shadow-[0_2px_4px_rgba(0,0,0,0.1)] shrink-0">
                                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                              <span className="text-[11px] font-medium leading-none whitespace-nowrap">{att.fileSize ? Math.round(att.fileSize / 1024) + ' KB' : 'DOC'}</span>
                                            </div>
                                            <span className="truncate text-[10px] w-full text-center px-1 font-medium z-10">{att.originalFileName}</span>
                                            <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                            <span className="absolute bottom-1 right-2 text-[9px] text-white/90 z-10">{new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                        )}
                                        {isLastAndMore && (
                                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-3xl font-medium pt-1 z-20">
                                            +{remainingCount}
                                          </div>
                                        )}
                                      </a>
                                    );
                                  })
                                )}
                              </div>
                            )}
                            
                            {msg.content && msg.content.trim() !== '' && (
                              <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                            )}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 -mb-1">
                                {Object.entries(msg.reactions.reduce((acc: any, r: any) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                }, {})).map(([emoji, count]) => (
                                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[11px] border ${msg.reactions.some((r: any) => r.userId === user?.userId && r.emoji === emoji) ? 'bg-blue-100 border-blue-200 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <span>{emoji}</span>
                                    <span className="font-medium">{count as React.ReactNode}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Reply and Reaction Buttons */}
                          <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 ${isMine ? '-left-64' : '-right-64'}`}>
                            <div className="flex bg-white border border-gray-100 shadow-md rounded-full px-2 py-1.5 items-center gap-0.5 shadow-xl">
                              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(e => (
                                <button key={e} onClick={() => toggleReaction(msg.id, e)} className="w-8 h-8 flex items-center justify-center rounded-full transition-transform hover:bg-gray-100 hover:scale-125 text-xl">
                                  {e}
                                </button>
                              ))}
                              <button onClick={() => setActiveMessagePicker(msg.id)} className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 rounded-full transition-colors ml-1">
                                <Plus size={18} />
                              </button>
                            </div>
                            <button onClick={() => setReplyingTo(msg)} className="p-2 bg-white border border-gray-100 shadow-md rounded-full hover:text-gray-600 transition-colors" title="Reply">
                              <Reply size={18} />
                            </button>
                          </div>
                          
                          {activeMessagePicker === msg.id && (
                            <div className={`absolute z-50 ${isMine ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'}`}>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMessagePicker(null)} />
                              <div className="relative z-50 shadow-xl rounded-lg">
                                <EmojiPicker 
                                  onEmojiClick={(emojiData) => toggleReaction(msg.id, emojiData.emoji)} 
                                  autoFocusSearch={false}
                                  theme={Theme.LIGHT}
                                  width={300}
                                  height={350}
                                />
                              </div>
                            </div>
                          )}

                          <div className={`text-[10px] mt-1 flex items-center ${isMine ? 'justify-end text-blue-100' : 'justify-start text-gray-500'}`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (
                               <span className="ml-1">
                                 <CheckCheck size={14} className={msg.isRead ? "text-blue-400" : "text-gray-400"} />
                               </span>
                            )}
                          </div>
                        </div>
                      </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex space-x-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-gray-200 shrink-0 relative flex flex-col">
                {replyingTo && (
                  <div className="mb-3 mx-1 p-3 bg-gray-50 rounded-lg border-l-4 rtl:border-r-4 rtl:border-l-0 border-blue-500 shadow-sm flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4 rtl:pl-4 rtl:pr-0">
                      <div className="text-sm font-semibold text-blue-600 mb-0.5">{t('chat.replying_to')} {replyingTo.senderName || (replyingTo.senderId === user?.userId ? user?.displayName : otherParticipant?.displayName)}</div>
                      <div className="text-sm text-gray-600 truncate">{replyingTo.content}</div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                )}
                
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-full left-4 rtl:right-4 rtl:left-auto mb-2 z-50">
                    <EmojiPicker 
                      onEmojiClick={onEmojiClick} 
                      autoFocusSearch={false}
                      theme={Theme.LIGHT}
                      width={350}
                      height={400}
                    />
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3 rtl:space-x-reverse hidden-scrollbar relative z-10">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    title="Attach file"
                  >
                    <Paperclip size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    title="Add emoji"
                  >
                    <Smile size={24} />
                  </button>
                  <input
                    type="text"
                    placeholder={t('chat.type_message')}
                    value={newMessage}
                    onChange={handleTyping}
                    className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all border border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={(newMessage.trim() === '' && pendingAttachments.length === 0) || isUploading}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <Send size={20} className="ml-0.5 rtl:mr-0.5 rtl:ml-0" />
                  </button>
                </form>
              </div>
            </div>
            
            {showChatInfo && (
              <ChatInfoSidebar 
                chat={{ ...chat, title: chatName }} 
                onClose={() => setShowChatInfo(false)} 
                onGoToMessage={scrollToMessage}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};
