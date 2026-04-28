import React, { useState, useEffect } from 'react';
import { X, Camera, Check, User, Info, Loader2, Pencil } from 'lucide-react';
import { userService } from '../services/userService';
import type { UpdateProfileRequest } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../config/languages';
import { Globe } from 'lucide-react';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ProfilePanel component provides a WhatsApp/Telegram-style slide-over interface
 * for viewing and editing the user's profile.
 */
export const ProfilePanel: React.FC<ProfilePanelProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t, i18n } = useTranslation();
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleUpdateProfile = async (updates: UpdateProfileRequest) => {
    setIsSaving(true);
    try {
      const updatedUser = await userService.updateProfile(updates);
      if (setUser) {
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveName = () => {
    if (displayName !== user?.displayName) {
      handleUpdateProfile({ displayName });
    }
    setIsEditingName(false);
  };

  const saveBio = () => {
    if (bio !== user?.bio) {
      handleUpdateProfile({ bio });
    }
    setIsEditingBio(false);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setUploadProgress(0);
    try {
      const url = await userService.uploadProfilePictureChunked(file, (progress) => {
        setUploadProgress(progress);
      });
      if (setUser && user) {
        setUser({ ...user, profilePictureUrl: url });
      }
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      alert(t('common.upload_failed'));
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div 
        className={`fixed top-0 left-0 rtl:right-0 rtl:left-auto h-screen w-full sm:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-gray-900 text-white p-6 pb-4 flex items-center space-x-6">
            <button 
              onClick={onClose}
              className="hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X size={24} className="rtl:rotate-90" />
            </button>
            <h2 className="text-xl font-semibold">{t('common.profile')}</h2>
          </div>

          {/* Profile Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {/* Avatar Section */}
            <div className="flex flex-col items-center justify-center py-10">
              <div className="relative group cursor-pointer" onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                />
                <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-6xl font-bold text-white shadow-xl overflow-hidden border-4 border-white relative">
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user?.displayName?.charAt(0).toUpperCase()
                  )}
                  
                  {/* Photo Overlay */}
                  {!isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Camera size={32} className="mb-2" />
                      <span className="text-xs uppercase font-bold tracking-wider">{t('common.change_photo')}</span>
                    </div>
                  )}

                  {/* Uploading State */}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-full">
                      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-2"></div>
                      <span className="text-sm font-semibold text-white">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-6">
              {/* Name Field */}
              <div className="bg-white p-6 shadow-sm">
                <div className="flex items-center text-blue-500 mb-4">
                  <User size={18} className="mr-3 rtl:ml-3 rtl:mr-0" />
                  <span className="text-sm font-medium uppercase tracking-wider">{t('common.name')}</span>
                </div>
                
                <div className="flex items-center justify-between group">
                  {isEditingName ? (
                    <div className="flex-1 flex items-center bg-gray-50 rounded-lg p-1 border-b-2 border-blue-500">
                      <input 
                        className="w-full bg-transparent outline-none py-1 px-2 text-lg"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                      />
                      <div className="flex items-center space-x-1">
                        <button onClick={saveName} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Save">
                          <Check size={20} />
                        </button>
                        <button onClick={() => { setDisplayName(user?.displayName || ''); setIsEditingName(false); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Cancel">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-lg text-gray-800">{user?.displayName}</p>
                    </div>
                  )}
                  
                  {!isEditingName && (
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                      title="Edit Name"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                </div>
                
                <p className="mt-4 text-xs text-gray-500 leading-relaxed">
                  {t('common.photo_info')}
                </p>
              </div>

              {/* Bio Field */}
              <div className="bg-white p-6 shadow-sm">
                <div className="flex items-center text-blue-500 mb-4">
                  <Info size={18} className="mr-3 rtl:ml-3 rtl:mr-0" />
                  <span className="text-sm font-medium uppercase tracking-wider">{t('common.about')}</span>
                </div>
                
                <div className="flex items-center justify-between group">
                  {isEditingBio ? (
                    <div className="flex-1 flex items-center bg-gray-50 rounded-lg p-1 border-b-2 border-blue-500">
                      <textarea 
                        className="w-full bg-transparent outline-none py-1 px-2 text-gray-800 min-h-[60px] resize-none"
                        value={bio}
                        placeholder={t('common.add_bio')}
                        onChange={(e) => setBio(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveBio();
                          }
                          if (e.key === 'Escape') setIsEditingBio(false);
                        }}
                      />
                      <div className="flex flex-col items-center space-y-1 self-start mt-1">
                        <button onClick={saveBio} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Save">
                          <Check size={20} />
                        </button>
                        <button onClick={() => { setBio(user?.bio || ''); setIsEditingBio(false); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Cancel">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-gray-800 whitespace-pre-wrap">{user?.bio || t('common.default_bio')}</p>
                    </div>
                  )}
                  
                  {!isEditingBio && (
                    <button 
                      onClick={() => setIsEditingBio(true)}
                      className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                      title={t('common.edit_bio')}
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Language Selection */}
              <div className="bg-white p-6 shadow-sm">
                <div className="flex items-center text-blue-500 mb-4">
                  <Globe size={18} className="mr-3 rtl:ml-3 rtl:mr-0" />
                  <span className="text-sm font-medium uppercase tracking-wider">{t('common.language')}</span>
                </div>
                
                <div className="space-y-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        if (i18n.language !== lang.code) {
                          i18n.changeLanguage(lang.code);
                          handleUpdateProfile({ preferredLanguage: lang.code });
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        i18n.language === lang.code
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="font-medium">{lang.name}</span>
                      {i18n.language === lang.code && (
                        <div className="bg-blue-500 text-white rounded-full p-0.5">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Status indicators */}
            {isSaving && (
              <div className="fixed bottom-10 left-10 rtl:right-10 rtl:left-auto flex items-center space-x-2 rtl:space-x-reverse bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg z-[60]">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-sm">{t('common.saving')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
