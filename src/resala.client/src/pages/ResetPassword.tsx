import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api from '../services/api';

export const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const location = useLocation();

  useEffect(() => {
    // Extract query parameters: e.g. ?email=user@example.com&resetCode=XYZ
    const searchParams = new URLSearchParams(location.search);
    const emailParam = searchParams.get('email');
    const codeParam = searchParams.get('resetCode');
    
    if (emailParam) setEmail(emailParam);
    if (codeParam) setResetCode(codeParam);
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }

    try {
      await api.post('/auth/resetPassword', { email, resetCode, newPassword });
      setStatus('success');
      setMessage('Your password has been reset successfully.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.detail || err.response?.data?.message || 'Failed to reset password. The link might be expired.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <KeyRound size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Set new password</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {status === 'success' ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-6">
                {message}
              </div>
              <Link
                to="/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in with new password
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {message}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <div className="mt-1">
                  <input
                    required
                    type="email"
                    readOnly={!!new URLSearchParams(location.search).get('email')}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-500 bg-gray-50 sm:text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Reset Code</label>
                <div className="mt-1">
                  <input
                    required
                    type="text"
                    readOnly={!!new URLSearchParams(location.search).get('resetCode')}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-500 bg-gray-50 sm:text-sm"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <div className="mt-1">
                  <input
                    required
                    type="password"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <div className="mt-1">
                  <input
                    required
                    type="password"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={status === 'loading' || !email || !resetCode}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
