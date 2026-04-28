import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api from '../services/api';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      await api.post('/auth/forgotPassword', { email });
      setStatus('success');
      setMessage('Reset link generated!');
      
      // Since it's a dev environment, let's just automatically navigate to the fake inbox
      // where the user can click the link. We'll add a short delay so they see the success message.
      setTimeout(() => {
        window.location.href = '/fake-inbox';
      }, 1000);
    } catch (err: any) {
      // For security reasons, we might still want to show success even if email not found,
      // but Identity API might return 200 anyway if email is not found to prevent enumeration.
      setStatus('error');
      setMessage(err.response?.data?.detail || err.response?.data?.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
            <img src="/logo.png" alt="Resala Logo" className="w-16 h-16 object-contain" />
          </div>
        </div>
        <div className="flex justify-center text-blue-600">
          <KeyRound size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {status === 'success' ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-6">
                {message}
                <div className="mt-2 text-xs opacity-80">Redirecting to your reset link...</div>
              </div>
              <Link
                to="/fake-inbox"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Reset Link Now
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {status === 'loading' ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
             <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
               Back to sign in
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
