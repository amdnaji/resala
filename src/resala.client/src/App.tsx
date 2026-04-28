import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SignalRProvider } from './contexts/SignalRContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { getLanguageByCode } from './config/languages';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { FakeInbox } from './pages/FakeInbox';
import { Toaster } from 'react-hot-toast';

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
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/fake-inbox" element={<FakeInbox />} />
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
          <Toaster 
            position="top-center" 
            toastOptions={{
              duration: 4000,
              className: 'rtl:text-right',
            }} 
          />
        </BrowserRouter>
      </SignalRProvider>
    </AuthProvider>
  );
}

export default App;
