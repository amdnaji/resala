import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from 'i18next';
import { userService } from '../services/userService';

interface User {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  profilePictureUrl?: string;
  preferredLanguage?: string;
}

interface AuthContextType {
  user: User | null;
  login: (data: User) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // First, check local storage for a quick UI restore
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Then verify with backend to ensure the cookie is still valid
        const userData = await userService.getMe();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Sync language
        if (userData.preferredLanguage && i18n.language !== userData.preferredLanguage) {
          i18n.changeLanguage(userData.preferredLanguage);
        }
      } catch (error: any) {
        console.warn('Session verification failed:', error);
        // If 401, clear local state
        if (error.response?.status === 401) {
          setUser(null);
          localStorage.removeItem('user');
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      // Identity API does not have an explicit logout endpoint in MapIdentityApi by default, 
      // typically we'd just want to clear cookies, but for now we clear frontend state.
      // We will implement a backend logout endpoint if needed, or just rely on clearing state.
      setUser(null);
      localStorage.removeItem('user');
    } catch (e) {
      console.error(e);
    }
  };

  const updateUserData = (userData: User | null) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, setUser: updateUserData, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
