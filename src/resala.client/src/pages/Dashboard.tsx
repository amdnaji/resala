import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { ProfilePanel } from '../components/ProfilePanel';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, LogOut, Settings, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* App Navigation / Profile Rail (Optional) */}
      <div className="w-16 bg-gray-900 text-white flex flex-col items-center py-4 justify-between">
        <div 
          onClick={() => setSelectedChat(null)}
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden mb-6 cursor-pointer border border-gray-100 shadow-sm"
        >
          <img src="/logo.png" alt="Resala Logo" className="w-8 h-8 object-contain" />
        </div>
        
        <div className="flex-1 w-full flex flex-col items-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-blue-400 flex items-center justify-center cursor-pointer relative group">
            <MessageSquare size={22} />
            <div className="absolute left-14 rtl:right-14 rtl:left-auto bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity">
              {t('nav.chats')}
            </div>
          </div>

          <div 
            onClick={() => setIsProfileOpen(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer relative group transition-colors ${
              isProfileOpen ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-blue-400'
            }`}
          >
            <User size={22} />
            <div className="absolute left-14 rtl:right-14 rtl:left-auto bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity">
              {t('nav.profile_settings')}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div 
            onClick={() => setIsProfileOpen(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-sm font-bold shadow-md cursor-pointer relative group overflow-hidden"
          >
            {user?.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              user?.displayName?.charAt(0).toUpperCase()
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Settings size={14} className="text-white" />
            </div>
            <div className="absolute left-14 rtl:right-14 rtl:left-auto bottom-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
              {t('nav.profile')}: {user?.displayName}
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-10 h-10 rounded-xl hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors"
            title={t('nav.logout')}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <Sidebar onSelectChat={setSelectedChat} selectedChatId={selectedChat?.id} />
      
      {selectedChat ? (
        <ChatArea chat={selectedChat} onBack={() => setSelectedChat(null)} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
            <img src="/logo.png" alt="Resala Logo" className="w-16 h-16 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('chat.welcome_title')}</h2>
          <p className="text-gray-500 text-center max-w-sm">
            {t('chat.welcome_desc')}
          </p>
        </div>
      )}

      <ProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
