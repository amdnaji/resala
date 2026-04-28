import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../services/api';

export const FakeInbox: React.FC = () => {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLink = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/latest-reset-link');
      setLink(response.data.link);
    } catch (err) {
      console.error('Failed to fetch link', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLink();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Mail size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Fake Mail Inbox</h1>
          </div>
          <button
            onClick={fetchLink}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Inbox
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Latest Received Emails</h2>
          </div>
          
          <div className="p-6">
            {!link ? (
              <div className="text-center py-12 text-gray-500">
                <Mail size={48} className="mx-auto text-gray-300 mb-4" />
             <p>No recent emails found.</p>
             <p className="text-sm mt-1">Request a password reset first, then check back here.</p>
              </div>
            ) : (
              <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Password Reset Request</h3>
                    <p className="text-sm text-gray-500 mt-1">Just now</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    System Message
                  </span>
                </div>
                
                <div className="bg-white p-4 rounded border border-gray-200 mt-4">
                  <p className="text-gray-700 mb-4">Click the button below to reset your password:</p>
                  
                  <a 
                    href={link}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    Reset Password
                    <ExternalLink size={18} />
                  </a>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">Or copy this link raw:</p>
                    <code className="block w-full p-3 bg-gray-50 text-gray-600 text-xs rounded border border-gray-200 break-all">
                      {link}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FakeInbox;
