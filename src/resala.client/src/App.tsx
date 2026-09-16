import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SignalRProvider } from './contexts/SignalRContext';
import { CallProvider } from './contexts/CallContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CallOverlay } from './components/CallOverlay';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { getLanguageByCode } from './config/languages';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { FakeInbox } from './pages/FakeInbox';
import { BlurTest } from './pages/BlurTest';
import { SetupPage } from './pages/SetupPage';
import { setupService } from './services/setupService';
import { Toaster } from 'react-hot-toast';

import { useState } from 'react';

function SetupGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [checking, setChecking] = useState<boolean>(() => {
    if (location.pathname === '/setup') return false;
    return sessionStorage.getItem('resala_setup_completed') !== 'true';
  });
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (sessionStorage.getItem('resala_setup_completed') === 'true') {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    if (location.pathname !== '/setup') {
      setChecking(true);
    }

    setupService.getStatus()
      .then(res => {
        if (!isMounted) return;
        if (res.isSetupCompleted) {
          setIsSetupRequiredFalse();
          sessionStorage.setItem('resala_setup_completed', 'true');
          setNeedsSetup(false);
        } else {
          sessionStorage.removeItem('resala_setup_completed');
          setNeedsSetup(true);
        }
      })
      .catch(() => {
        if (isMounted) setNeedsSetup(false);
      })
      .finally(() => {
        if (isMounted) setChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const setIsSetupRequiredFalse = () => {
    setNeedsSetup(false);
  };

  if (checking && location.pathname !== '/setup') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!checking && needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const langMetadata = getLanguageByCode(i18n.language);
    document.documentElement.dir = langMetadata.dir;
    document.documentElement.lang = i18n.language;
    document.title = t('common.app_title');
  }, [i18n.language, t]);

  return (
    <AuthProvider>
      <SignalRProvider>
        <CallProvider>
          <BrowserRouter>
            <SetupGuard>
              <Routes>
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/fake-inbox" element={<FakeInbox />} />
                <Route path="/blur-test" element={<BlurTest />} />
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <CallOverlay />
              <Toaster 
                position="top-center" 
                toastOptions={{
                  duration: 4000,
                  className: 'rtl:text-right',
                }} 
              />
            </SetupGuard>
          </BrowserRouter>
        </CallProvider>
      </SignalRProvider>
    </AuthProvider>
  );
}

export default App;
