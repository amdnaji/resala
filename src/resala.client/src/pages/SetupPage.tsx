import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  HardDrive, 
  ShieldCheck, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Lock, 
  Eye, 
  EyeOff, 
  Server, 
  Cloud, 
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  setupService, 
  type SetupStatusResponse, 
  type TestDatabaseRequest, 
  type TestStorageRequest, 
  type TestLdapRequest, 
  type AdminUserSetupDTO,
  type ConfigurationSourceInfo 
} from '../services/setupService';

export const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);

  // Form State - Step 1: Database
  const [dbConfig, setDbConfig] = useState<TestDatabaseRequest>({
    host: 'localhost',
    port: 5432,
    database: 'resala_chat',
    username: 'postgres',
    password: '',
    sslMode: 'Prefer',
    rawConnectionString: ''
  });
  const [useRawDbConn, setUseRawDbConn] = useState<boolean>(false);
  const [showDbPassword, setShowDbPassword] = useState<boolean>(false);
  const [testingDb, setTestingDb] = useState<boolean>(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Form State - Step 2: Storage
  const [storageConfig, setStorageConfig] = useState<TestStorageRequest>({
    provider: 'LocalStorage',
    path: '',
    azureConnectionString: '',
    azureContainerName: 'files',
    sasExpiryDays: 365
  });
  const [testingStorage, setTestingStorage] = useState<boolean>(false);
  const [storageTestResult, setStorageTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form State - Step 3: Auth & Mode
  const [authMode, setAuthMode] = useState<string>('Standalone');
  const [adminUser, setAdminUser] = useState<AdminUserSetupDTO>({
    displayName: 'Administrator',
    email: 'admin@resala.local',
    password: ''
  });
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [ldapConfig, setLdapConfig] = useState<TestLdapRequest>({
    domainName: '',
    upnBase: '',
    port: 389,
    useSsl: false,
    skipCertValidation: true,
    testUsername: '',
    testPassword: ''
  });
  const [testingLdap, setTestingLdap] = useState<boolean>(false);
  const [ldapTestResult, setLdapTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Save / Submit State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [setupCompletedSuccessfully, setSetupCompletedSuccessfully] = useState<boolean>(false);

  // Fetch initial status on load
  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const status = await setupService.getStatus();
      setSetupStatus(status);

      // Pre-fill form from existing settings if available
      if (status.currentConfig) {
        if (status.currentConfig.databaseHost && status.currentConfig.databaseHost !== 'configured (raw)') {
          setDbConfig(prev => ({
            ...prev,
            host: status.currentConfig.databaseHost || prev.host,
            database: status.currentConfig.databaseName || prev.database,
            username: status.currentConfig.databaseUsername || prev.username
          }));
        }

        if (status.currentConfig.storageProvider) {
          setStorageConfig(prev => ({
            ...prev,
            provider: status.currentConfig.storageProvider,
            path: status.currentConfig.storagePath || prev.path,
            azureContainerName: status.currentConfig.azureContainerName || prev.azureContainerName
          }));
        }

        if (status.currentConfig.authMode) {
          setAuthMode(status.currentConfig.authMode);
        }
        if (status.currentConfig.ldapDomain) {
          setLdapConfig(prev => ({
            ...prev,
            domainName: status.currentConfig.ldapDomain
          }));
        }
      }
    } catch (err: any) {
      console.warn('Failed to load setup status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Handlers for Testing
  const handleTestDatabase = async () => {
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const payload: TestDatabaseRequest = useRawDbConn
        ? { rawConnectionString: dbConfig.rawConnectionString }
        : { ...dbConfig };
      const res = await setupService.testDatabase(payload);
      setDbTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Database test failed';
      setDbTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingDb(false);
    }
  };

  const handleTestStorage = async () => {
    setTestingStorage(true);
    setStorageTestResult(null);
    try {
      const res = await setupService.testStorage(storageConfig);
      setStorageTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Storage verification failed';
      setStorageTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingStorage(false);
    }
  };

  const handleTestLdap = async () => {
    setTestingLdap(true);
    setLdapTestResult(null);
    try {
      const res = await setupService.testLdap(ldapConfig);
      setLdapTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'LDAP test failed';
      setLdapTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingLdap(false);
    }
  };

  const handleSaveSetup = async () => {
    if (authMode === 'Standalone' && (!adminUser.email || !adminUser.password)) {
      toast.error('Admin email and password are required.');
      setCurrentStep(3);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        database: useRawDbConn 
          ? { rawConnectionString: dbConfig.rawConnectionString } 
          : dbConfig,
        storage: storageConfig,
        authMode,
        ldapSettings: authMode === 'LDAP' ? ldapConfig : undefined,
        adminUser: authMode === 'Standalone' ? adminUser : undefined
      };

      const res = await setupService.saveSetup(payload);
      if (res.success) {
        setSetupCompletedSuccessfully(true);
        toast.success('Resala successfully configured and initialized!');
      } else {
        toast.error(res.message || 'Setup could not be finalized.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Setup execution failed';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper badge component for smart source
  const renderSourceBadge = (info?: ConfigurationSourceInfo) => {
    if (!info || info.sourceType === 'NotSet') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
          Not Set
        </span>
      );
    }

    switch (info.sourceType) {
      case 'CustomConfig':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Custom (appsettings.config.json)
          </span>
        );
      case 'UserSecrets':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
            <Lock className="w-3 h-3 mr-1 text-indigo-600" />
            User Secrets (secrets.json)
          </span>
        );
      case 'Environment':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            <Server className="w-3 h-3 mr-1 text-amber-600" />
            Environment Variable
          </span>
        );
      case 'AppSettings':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
            <FileCode className="w-3 h-3 mr-1 text-blue-600" />
            Default ({info.providerName || 'appsettings.json'})
          </span>
        );
    }
  };

  const steps = [
    { id: 1, name: 'Database', icon: Database },
    { id: 2, name: 'Storage', icon: HardDrive },
    { id: 3, name: 'Authentication', icon: ShieldCheck },
    { id: 4, name: 'Review & Initialize', icon: Sparkles },
  ];

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Checking Resala Configuration Status...</p>
      </div>
    );
  }

  // Completion Success View
  if (setupCompletedSuccessfully) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-6">
            <div className="p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
              <img src="/logo.png" alt="Resala Logo" className="w-16 h-16 object-contain" />
            </div>
          </div>
          <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 text-center">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Setup Complete!</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Resala has been successfully configured. Your settings have been written to{' '}
              <code className="bg-gray-100 text-blue-600 px-1.5 py-0.5 rounded text-xs font-mono font-semibold">
                appsettings.config.json
              </code>{' '}
              outside Git, and database migrations have finished running.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Database:</span>
                <span className="text-gray-800 font-mono font-semibold">{dbConfig.database} ({dbConfig.host})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Storage Provider:</span>
                <span className="text-gray-800 font-mono font-semibold">{storageConfig.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Auth Mode:</span>
                <span className="text-gray-800 font-mono font-semibold">{authMode}</span>
              </div>
              {authMode === 'Standalone' && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Admin Account:</span>
                  <span className="text-gray-800 font-mono font-semibold">{adminUser.email}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
            >
              Go to Resala Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
      {/* Top Brand Header */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-1 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
              <img src="/logo.png" alt="Resala Logo" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 tracking-tight">Resala Platform Setup</h1>
              <p className="text-xs text-gray-500">System Configuration & Initial Onboarding</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {setupStatus?.isSetupCompleted ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Active & Configured
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Initial Setup Required
              </span>
            )}
            <button
              onClick={loadStatus}
              title="Refresh status"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex-grow">
        {/* Wizard Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center relative">
                  {idx > 0 && (
                    <div 
                      className={`absolute top-5 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                        isDone ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center font-medium transition-all ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-4 ring-blue-100 font-bold' 
                        : isDone 
                        ? 'bg-blue-50 border border-blue-200 text-blue-600' 
                        : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </button>
                  <span className={`text-xs mt-2 font-medium ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Card Container */}
        <div className="bg-white shadow-xl sm:rounded-2xl border border-gray-100 p-6 sm:p-10">
          
          {/* STEP 1: DATABASE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 flex items-center">
                    <Database className="w-5 h-5 text-blue-600 mr-2" />
                    PostgreSQL Database Configuration
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Set up your database connection. Saved externally to <span className="font-mono text-blue-600 font-semibold">appsettings.config.json</span>.
                  </p>
                </div>
                <div>
                  {renderSourceBadge(setupStatus?.databaseSource)}
                </div>
              </div>

              {/* Toggle Mode */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setUseRawDbConn(!useRawDbConn)}
                  className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                >
                  {useRawDbConn ? 'Switch to Form Fields' : 'Switch to Raw Connection String'}
                </button>
              </div>

              {useRawDbConn ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Raw PostgreSQL Connection String
                  </label>
                  <textarea
                    rows={3}
                    value={dbConfig.rawConnectionString || ''}
                    onChange={(e) => setDbConfig({ ...dbConfig, rawConnectionString: e.target.value })}
                    placeholder="Host=localhost;Database=resala_chat;Username=postgres;Password=admin"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Host / Server IP
                    </label>
                    <input
                      type="text"
                      value={dbConfig.host || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                      placeholder="localhost"
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Port
                    </label>
                    <input
                      type="number"
                      value={dbConfig.port || 5432}
                      onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) || 5432 })}
                      placeholder="5432"
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={dbConfig.database || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                      placeholder="resala_chat"
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={dbConfig.username || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                      placeholder="postgres"
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showDbPassword ? 'text' : 'password'}
                        value={dbConfig.password || ''}
                        onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                        placeholder="••••••••"
                        className="appearance-none block w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDbPassword(!showDbPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showDbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      SSL Mode
                    </label>
                    <select
                      value={dbConfig.sslMode || 'Prefer'}
                      onChange={(e) => setDbConfig({ ...dbConfig, sslMode: e.target.value })}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                    >
                      <option value="Prefer">Prefer</option>
                      <option value="Require">Require</option>
                      <option value="Disable">Disable</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Test Button & Result */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={testingDb}
                  className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-300 shadow-sm transition disabled:opacity-50 text-sm"
                >
                  {testingDb ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <span>Test Database Connection</span>
                    </>
                  )}
                </button>

                {dbTestResult && (
                  <div 
                    className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                      dbTestResult.success 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {dbTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{dbTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: STORAGE */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 flex items-center">
                    <HardDrive className="w-5 h-5 text-blue-600 mr-2" />
                    File & Media Storage Configuration
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Select where chat uploads, attachments, and user avatars will be stored.
                  </p>
                </div>
                <div>
                  {renderSourceBadge(setupStatus?.storageSource)}
                </div>
              </div>

              {/* Provider Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setStorageConfig({ ...storageConfig, provider: 'LocalStorage' })}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    storageConfig.provider === 'LocalStorage'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${storageConfig.provider === 'LocalStorage' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Local Disk Storage</h3>
                    <p className="text-xs text-gray-500 mt-1">Store uploaded files locally on disk or on an attached volume.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStorageConfig({ ...storageConfig, provider: 'AzureBlob' })}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    storageConfig.provider === 'AzureBlob'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${storageConfig.provider === 'AzureBlob' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Azure Blob Storage</h3>
                    <p className="text-xs text-gray-500 mt-1">Enterprise cloud storage with secure signed SAS tokens.</p>
                  </div>
                </button>
              </div>

              {/* Local Storage Fields */}
              {storageConfig.provider === 'LocalStorage' ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Storage Directory Path
                  </label>
                  <input
                    type="text"
                    value={storageConfig.path || ''}
                    onChange={(e) => setStorageConfig({ ...storageConfig, path: e.target.value })}
                    placeholder="Leave empty for default './storage' directory"
                    className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 font-mono transition-all bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Relative paths are resolved relative to the application content root.
                  </p>
                </div>
              ) : (
                /* Azure Fields */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Azure Storage Connection String
                    </label>
                    <input
                      type="password"
                      value={storageConfig.azureConnectionString || ''}
                      onChange={(e) => setStorageConfig({ ...storageConfig, azureConnectionString: e.target.value })}
                      placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;"
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 font-mono transition-all bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Container Name
                      </label>
                      <input
                        type="text"
                        value={storageConfig.azureContainerName || 'files'}
                        onChange={(e) => setStorageConfig({ ...storageConfig, azureContainerName: e.target.value })}
                        placeholder="files"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        SAS Expiry (Days)
                      </label>
                      <input
                        type="number"
                        value={storageConfig.sasExpiryDays || 365}
                        onChange={(e) => setStorageConfig({ ...storageConfig, sasExpiryDays: parseInt(e.target.value) || 365 })}
                        placeholder="365"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test Button & Result */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleTestStorage}
                  disabled={testingStorage}
                  className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-300 shadow-sm transition disabled:opacity-50 text-sm"
                >
                  {testingStorage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Validating Storage...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <span>Validate Storage Permissions</span>
                    </>
                  )}
                </button>

                {storageTestResult && (
                  <div 
                    className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                      storageTestResult.success 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {storageTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{storageTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: AUTHENTICATION & MODE */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 flex items-center">
                    <ShieldCheck className="w-5 h-5 text-blue-600 mr-2" />
                    Authentication Mode & Accounts
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose between local standalone user accounts or Active Directory / LDAP.
                  </p>
                </div>
                <div>
                  {renderSourceBadge(setupStatus?.authModeSource)}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAuthMode('Standalone')}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    authMode === 'Standalone'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${authMode === 'Standalone' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Standalone Mode</h3>
                    <p className="text-xs text-gray-500 mt-1">Self-managed database with local users, email/password, and an initial administrator.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode('LDAP')}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    authMode === 'LDAP'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${authMode === 'LDAP' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Active Directory / LDAP</h3>
                    <p className="text-xs text-gray-500 mt-1">Corporate directory authentication with automatic user provisioning.</p>
                  </div>
                </button>
              </div>

              {/* Standalone Admin Setup */}
              {authMode === 'Standalone' ? (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Initial Super Admin Account
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={adminUser.displayName}
                        onChange={(e) => setAdminUser({ ...adminUser, displayName: e.target.value })}
                        placeholder="Administrator"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={adminUser.email}
                        onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })}
                        placeholder="admin@example.com"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          value={adminUser.password}
                          onChange={(e) => setAdminUser({ ...adminUser, password: e.target.value })}
                          placeholder="••••••••"
                          className="appearance-none block w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* LDAP Settings */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Domain / Server Host
                      </label>
                      <input
                        type="text"
                        value={ldapConfig.domainName}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, domainName: e.target.value })}
                        placeholder="ldap.corp.com or 192.168.1.10"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 font-mono transition-all bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        UPN Base / Realm
                      </label>
                      <input
                        type="text"
                        value={ldapConfig.upnBase || ''}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, upnBase: e.target.value })}
                        placeholder="corp.domain.com"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Port
                      </label>
                      <input
                        type="number"
                        value={ldapConfig.port}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, port: parseInt(e.target.value) || 389 })}
                        placeholder="389"
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 transition-all bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 rtl:space-x-reverse pt-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ldapConfig.useSsl}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, useSsl: e.target.checked, port: e.target.checked ? 636 : 389 })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="ml-2 rtl:mr-2 text-sm text-gray-700">Use SSL / LDAPS (Port 636)</span>
                    </label>

                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ldapConfig.skipCertValidation}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, skipCertValidation: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="ml-2 rtl:mr-2 text-sm text-gray-700">Allow Self-Signed / Skip Cert Check</span>
                    </label>
                  </div>

                  {/* LDAP Test Button & Result */}
                  <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleTestLdap}
                      disabled={testingLdap || !ldapConfig.domainName}
                      className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-300 shadow-sm transition disabled:opacity-50 text-sm"
                    >
                      {testingLdap ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Testing LDAP...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                          <span>Test LDAP Reachability</span>
                        </>
                      )}
                    </button>

                    {ldapTestResult && (
                      <div 
                        className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                          ldapTestResult.success 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {ldapTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <span>{ldapTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SMART INSPECTOR & REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-extrabold text-gray-900 flex items-center">
                  <Sparkles className="w-5 h-5 text-blue-600 mr-2" />
                  Configuration Review & Smart Detection
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Verify your choices and inspect where settings are resolved across ASP.NET Core configuration providers.
                </p>
              </div>

              {/* Target File Notification */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 flex items-start space-x-3.5 rtl:space-x-reverse">
                <FileCode className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <h4 className="font-bold text-blue-900">External Configuration Destination</h4>
                  <p className="text-blue-800/80 text-xs mt-1 leading-relaxed">
                    Configurations will be written directly to{' '}
                    <code className="bg-white border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                      appsettings.config.json
                    </code>
                    . This file is excluded in <code className="bg-white border border-blue-200 text-gray-700 px-1.5 py-0.5 rounded font-mono">.gitignore</code>, ensuring database credentials and storage paths are never committed into Git.
                  </p>
                </div>
              </div>

              {/* Configuration Hierarchy Badges */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                  Current Detected Configuration Sources:
                </h3>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-gray-100 text-xs">
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-gray-900 font-semibold font-mono">ConnectionStrings:DefaultConnection</span>
                        <p className="text-gray-500 text-[11px] mt-0.5">Database connection string</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.databaseSource)}</div>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-gray-900 font-semibold font-mono">Storage:Provider</span>
                        <p className="text-gray-500 text-[11px] mt-0.5">Active file store ({storageConfig.provider})</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.storageSource)}</div>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-gray-900 font-semibold font-mono">AuthMode</span>
                        <p className="text-gray-500 text-[11px] mt-0.5">Authentication provider mode</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.authModeSource)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Checklist */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Summary of Changes to Apply</h3>
                <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                  <li>Write <code className="text-blue-700 font-semibold">appsettings.config.json</code> with new database & storage configuration.</li>
                  <li>Execute pending Entity Framework Core migrations automatically.</li>
                  {authMode === 'Standalone' && (
                    <li>Create or verify Super Admin user <code className="text-blue-700 font-semibold">{adminUser.email}</code>.</li>
                  )}
                  <li>Lock setup mode to prevent unauthorized tampering.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSetup}
                  disabled={isSaving}
                  className="w-full flex justify-center items-center space-x-2 rtl:space-x-reverse py-3.5 px-6 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Writing appsettings.config.json & Migrating DB...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Initialize & Launch Resala</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="border-t border-gray-100 mt-8 pt-6 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-sm font-medium rounded-xl transition shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : <div />}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400">
        Resala Messenger &copy; {new Date().getFullYear()} — Secure Communications Platform
      </footer>
    </div>
  );
};

export default SetupPage;
