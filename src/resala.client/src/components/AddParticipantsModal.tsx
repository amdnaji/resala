import React, { useState, useEffect } from 'react';
import { X, Search, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface AddParticipantsModalProps {
  chatId: string;
  existingParticipantIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AddParticipantsModal: React.FC<AddParticipantsModalProps> = ({ chatId, existingParticipantIds, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    setIsSearching(true);
    try {
      const response = await api.get('/users/search?query=');
      // Filter out existing participants
      setUsers(response.data.filter((u: any) => !existingParticipantIds.includes(u.userId)));
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      setIsSearching(true);
      try {
        const response = await api.get(`/users/search?query=${query}`);
        setUsers(response.data.filter((u: any) => !existingParticipantIds.includes(u.userId)));
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    } else {
      loadAllUsers();
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    if (selectedUserIds.length === 0) return;
    
    setIsLoading(true);
    try {
      await api.post(`/chat/${chatId}/participants`, {
        participantIds: selectedUserIds
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to add participants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {t('chat.add_participants') || "Add Participants"}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-50 flex flex-col space-y-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              autoFocus
              type="text"
              placeholder={t('sidebar.search_placeholder')}
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            />
          </div>
          <div className="text-sm text-gray-500">
            {selectedUserIds.length} {t('chat.participants_selected')}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('sidebar.no_users')}</div>
          ) : (
            users.map(u => {
              const isSelected = selectedUserIds.includes(u.userId);
              const display = u.displayName || u.username.split('@')[0];
              
              return (
                <div
                  key={u.userId}
                  onClick={() => toggleUserSelection(u.userId)}
                  className="p-3 mb-1 rounded-xl flex items-center space-x-3 rtl:space-x-reverse cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                  
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden shrink-0">
                    {u.profilePictureUrl ? (
                      <img src={u.profilePictureUrl} alt={display} className="w-full h-full object-cover" />
                    ) : (
                      display.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{display}</div>
                    <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleAdd}
            disabled={selectedUserIds.length === 0 || isLoading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('common.add') || "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};
