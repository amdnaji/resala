import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, FileText, Film, Download, Search, Info, ExternalLink, Users, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { AddParticipantsModal } from './AddParticipantsModal';
import toast from 'react-hot-toast';

interface ChatInfoSidebarProps {
  chat: any;
  onClose: () => void;
  onGoToMessage?: (messageId: string) => void;
}

interface Attachment {
  id: string;
  messageId: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  originalFileName: string;
  fileSize: number;
  createdAt: string;
}

export const ChatInfoSidebar: React.FC<ChatInfoSidebarProps> = ({ chat, onClose, onGoToMessage }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Group state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'files' && chat.id) {
      fetchAttachments();
    }
  }, [activeTab, chat.id]);

  const fetchAttachments = async () => {
    if (!chat.id) return;
    setIsLoading(true);
    console.log(`[ChatInfoSidebar] Fetching attachments for chat: ${chat.id}`);
    try {
      const response = await api.get(`/chat/${chat.id}/attachments`);
      console.log(`[ChatInfoSidebar] Received ${response.data.length} attachments`);
      setAttachments(response.data);
    } catch (error) {
      console.error('[ChatInfoSidebar] Failed to fetch attachments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const otherParticipant = chat.type === 0 && chat.participants 
    ? chat.participants.find((p: any) => p.userId !== user?.userId) 
    : null;

  const displayTitle = chat.title || (otherParticipant ? (otherParticipant.displayName || otherParticipant.username) : t('chat.private_conversation'));

  const filteredAttachments = attachments.filter(att => 
    att.originalFileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentUserParticipant = chat.participants?.find((p: any) => p.userId === user?.userId);
  const isAdmin = currentUserParticipant?.role === 1;

  const handleUpdateTitle = async () => {
    if (editTitle.trim() === '' || editTitle === chat.title) {
       setIsEditingTitle(false);
       return;
    }
    try {
       await api.put(`/chat/${chat.id}`, { title: editTitle.trim() });
       // The UI will update via SignalR groupupdated event
       setIsEditingTitle(false);
    } catch (error) {
       console.error('Failed to group title:', error);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/chat/${chat.id}/participants/${participantId}`);
      // UI updates via userremovedfromgroup SignalR event
    } catch (error) {
      console.error('Failed to remove participant:', error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await api.delete(`/chat/${chat.id}/participants/${user?.userId}`);
      onClose();
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await api.post(`/chat/${chat.id}/picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // SignalR will trigger groupupdated, which refreshes Sidebar
      // We might need to refresh local state if not synced
    } catch (error) {
      console.error('Failed to upload group picture:', error);
      toast.error(t('common.upload_failed') || 'Failed to upload group picture.');
    } finally {
      setIsUploading(false);
    }
  };

  // Grouping logic
  const groupedAttachments: { [key: string]: Attachment[] } = {};
  filteredAttachments.forEach(att => {
    const date = new Date(att.createdAt);
    const monthYear = date.toLocaleString(i18n.language, { month: 'long', year: 'numeric' });
    if (!groupedAttachments[monthYear]) {
      groupedAttachments[monthYear] = [];
    }
    groupedAttachments[monthYear].push(att);
  });

  const monthKeys = Object.keys(groupedAttachments).sort((a, b) => {
    return new Date(groupedAttachments[b][0].createdAt).getTime() - new Date(groupedAttachments[a][0].createdAt).getTime();
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="text-blue-500" size={20} />;
      case 'video': return <Film className="text-purple-500" size={20} />;
      default: return <FileText className="text-orange-500" size={20} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-[350px] h-full bg-white border-l border-r rtl:border-r rtl:border-l-0 border-gray-200 flex flex-col shadow-xl z-20">
      {/* Header */}
      <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-gray-800">{t('chat.contact_info')}</h2>
        <div className="flex items-center space-x-1 rtl:space-x-reverse">
          {activeTab === 'files' && (
            <button 
              onClick={fetchAttachments}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              title={t('chat.refresh_files')}
            >
              <Search size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('chat.overview')}
        </button>
        <button 
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'files' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('chat.shared_files')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' ? (
          <div className="p-6 space-y-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold mb-4 overflow-hidden border-4 border-white shadow-md relative group/avatar">
                {chat.type === 1 ? (
                  chat.profilePictureUrl ? (
                    <img src={chat.profilePictureUrl} alt={displayTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-indigo-600"><Users size={48} /></div>
                  )
                ) : (otherParticipant?.profilePictureUrl || chat.participants?.[0]?.profilePictureUrl) ? (
                  <img src={otherParticipant?.profilePictureUrl || chat.participants?.[0]?.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  displayTitle.charAt(0).toUpperCase()
                )}

                {chat.type === 1 && isAdmin && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ImageIcon size={24} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase">{isUploading ? '...' : t('common.change_photo')}</span>
                  </div>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
              />
              
              {isEditingTitle ? (
                <div className="flex items-center space-x-2 mt-2">
                  <input 
                    autoFocus
                    type="text" 
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="px-3 py-1.5 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-gray-800 font-semibold"
                  />
                  <button onClick={handleUpdateTitle} className="p-1.5 text-green-600 hover:bg-green-50 rounded-full"><Check size={18} /></button>
                  <button onClick={() => setIsEditingTitle(false)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full"><X size={18} /></button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 w-full justify-center group relative px-8">
                  <h3 className="text-xl font-bold text-gray-900 truncate" title={displayTitle}>
                    {displayTitle}
                  </h3>
                  {chat.type === 1 && isAdmin && (
                    <button 
                      onClick={() => { setEditTitle(chat.title || ''); setIsEditingTitle(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity absolute right-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500 mt-1">
                {chat.type === 0 ? t('chat.private_conversation') : `${chat.participants?.length || 0} ${t('chat.participants')}`}
              </p>
            </div>

            <div className="space-y-4">
              {chat.type === 0 ? (
                <div className="flex items-start space-x-3 rtl:space-x-reverse p-3 bg-gray-50 rounded-xl">
                  <div className="min-w-0 flex-1 flex items-start space-x-3 rtl:space-x-reverse">
                    <Info size={18} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('common.about')}</p>
                      <p className="text-sm text-gray-700 mt-0.5 break-words">
                        {(otherParticipant?.bio || chat.participants?.[0]?.bio) || t('common.default_bio')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('chat.participants')}</p>
                     {isAdmin && (
                       <button onClick={() => setShowAddModal(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
                         <Search size={12} className="mr-1 rtl:ml-1 rtl:mr-0" /> Add
                       </button>
                     )}
                  </div>
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {chat.participants?.map((p: any) => {
                       const isMe = p.userId === user?.userId;
                       const display = p.displayName || p.username.split('@')[0];
                       const isParticipantAdmin = p.role === 1;

                       return (
                         <div key={p.userId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition-colors group">
                           <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0 flex-1">
                             <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden shrink-0 relative">
                               {p.profilePictureUrl ? (
                                 <img src={p.profilePictureUrl} alt={display} className="w-full h-full object-cover" />
                               ) : (
                                 display.charAt(0).toUpperCase()
                               )}
                               {p.isOnline && (
                                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                               )}
                             </div>
                             <div className="min-w-0 pr-2">
                               <div className="flex items-center">
                                 <p className="text-sm font-medium text-gray-900 truncate">
                                   {isMe ? t('chat.you') : display}
                                 </p>
                                 {isParticipantAdmin && (
                                   <span className="ml-2 rtl:mr-2 rtl:ml-0 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded">
                                     Admin
                                   </span>
                                 )}
                               </div>
                               <p className="text-xs text-gray-500 truncate">{p.bio || `@${p.username}`}</p>
                             </div>
                           </div>
                           
                           <div className="shrink-0 pl-2">
                             {isAdmin && !isMe ? (
                               <button 
                                 onClick={() => handleRemoveParticipant(p.userId)}
                                 className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-all"
                                 title="Remove"
                               >
                                 <X size={16} />
                               </button>
                             ) : null}
                           </div>
                         </div>
                       );
                    })}
                  </div>
                  
                  {chat.type === 1 && (
                    <button 
                      onClick={handleLeaveGroup}
                      className="w-full p-4 flex items-center justify-center space-x-2 rtl:space-x-reverse text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 font-medium text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                      <span>Leave Group</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center space-x-2 rtl:space-x-reverse bg-gray-50 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder={t('chat.search_files')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-gray-700"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : filteredAttachments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText size={32} className="text-gray-300" />
                </div>
                <h4 className="text-gray-800 font-medium">{t('chat.no_files')}</h4>
                <p className="text-sm text-gray-500 mt-1">{t('chat.no_files_desc')}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {monthKeys.map(month => (
                  <div key={month} className="mb-4">
                    <div className="sticky top-0 bg-white/95 backdrop-blur px-4 py-2 text-xs font-bold text-blue-600 uppercase tracking-widest border-b border-blue-50 z-10">
                      {month}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {groupedAttachments[month].map((att) => (
                        <div key={att.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center space-x-3 rtl:space-x-reverse group">
                          <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0">
                            {getFileIcon(att.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate" title={att.originalFileName}>
                              {att.originalFileName}
                            </p>
                            <div className="flex items-center space-x-2 rtl:space-x-reverse mt-0.5">
                              <span className="text-xs text-gray-500">{formatFileSize(att.fileSize)}</span>
                              <span className="text-[10px] text-gray-300">•</span>
                              <span className="text-xs text-gray-400 truncate uppercase">{att.mimeType.split('/')[1] || att.fileType}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onGoToMessage && att.messageId && (
                              <button 
                                onClick={() => onGoToMessage(att.messageId)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                title={t('chat.go_to_message')}
                              >
                                <ExternalLink size={18} className="rtl:rotate-180" />
                              </button>
                            )}
                            <a 
                              href={att.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              download={att.originalFileName}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                              title="Download"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddParticipantsModal
          chatId={chat.id}
          existingParticipantIds={chat.participants?.map((p: any) => p.userId) || []}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            // newchatcreated or systemmessage will trigger a sidebar reload
          }}
        />
      )}
    </div>
  );
};
