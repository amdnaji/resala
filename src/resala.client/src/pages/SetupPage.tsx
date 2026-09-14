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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          Not Set
        </span>
      );
    }

    switch (info.sourceType) {
      case 'CustomConfig':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
            Custom (appsettings.config.json)
          </span>
        );
      case 'UserSecrets':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
            <Lock className="w-3 h-3 mr-1 text-indigo-400" />
            User Secrets (secrets.json)
          </span>
        );
      case 'Environment':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
            <Server className="w-3 h-3 mr-1 text-amber-400" />
            Environment Variable
          </span>
        );
      case 'AppSettings':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-300 border border-sky-500/40">
            <FileCode className="w-3 h-3 mr-1 text-sky-400" />
            Default ({info.providerName || 'appsettings.json'})
          </span>
        );
    }
  };

  const steps = [
    { id: 1, name: 'Database', icon: Database },
    { id: 2, name: 'Storage', icon: HardDrive },
    { id: 3, name: 'Authentication', icon: ShieldCheck },
    { id: 4, name: 'Smart Inspector & Save', icon: Sparkles },
  ];

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Checking Resala Configuration Status...</p>
      </div>
    );
  }

  // Completion Success View
  if (setupCompletedSuccessfully) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            Resala has been successfully configured. Your settings have been written to{' '}
            <code className="bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono">
              appsettings.config.json
            </code>{' '}
            outside Git, and database migrations have finished running.
          </p>
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 mb-6 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Database:</span>
              <span className="text-zinc-200 font-mono">{dbConfig.database} ({dbConfig.host})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Storage Provider:</span>
              <span className="text-zinc-200 font-mono">{storageConfig.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Auth Mode:</span>
              <span className="text-zinc-200 font-mono">{authMode}</span>
            </div>
            {authMode === 'Standalone' && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Admin Account:</span>
                <span className="text-zinc-200 font-mono">{adminUser.email}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition duration-200 shadow-lg shadow-emerald-600/20"
          >
            Go to Resala Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-emerald-500 selection:text-white">
      {/* Header Banner */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-600/30">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Resala Platform Setup</h1>
              <p className="text-xs text-zinc-400">External Configuration & Installation Wizard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {setupStatus?.isSetupCompleted ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-600/30">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Active & Configured
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Initial Setup Required
              </span>
            )}
            <button
              onClick={loadStatus}
              title="Refresh status"
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Wizard Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center relative">
                  {idx > 0 && (
                    <div 
                      className={`absolute top-5 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                        isDone ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    />
                  )}
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center font-medium transition-all ${
                      isActive 
                        ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/20 font-bold' 
                        : isDone 
                        ? 'bg-emerald-900/60 border border-emerald-500/50 text-emerald-300' 
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </button>
                  <span className={`text-xs mt-2 font-medium ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Content Card */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          
          {/* STEP 1: DATABASE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center">
                    <Database className="w-5 h-5 text-emerald-400 mr-2" />
                    PostgreSQL Database Configuration
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Set up your database connection. These settings will be saved to <span className="font-mono text-emerald-400">appsettings.config.json</span>.
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
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  {useRawDbConn ? 'Switch to Form Fields' : 'Switch to Raw Connection String'}
                </button>
              </div>

              {useRawDbConn ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Raw PostgreSQL Connection String
                  </label>
                  <textarea
                    rows={3}
                    value={dbConfig.rawConnectionString || ''}
                    onChange={(e) => setDbConfig({ ...dbConfig, rawConnectionString: e.target.value })}
                    placeholder="Host=localhost;Database=resala_chat;Username=postgres;Password=admin"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Host / Server IP
                    </label>
                    <input
                      type="text"
                      value={dbConfig.host || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                      placeholder="localhost"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Port
                    </label>
                    <input
                      type="number"
                      value={dbConfig.port || 5432}
                      onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) || 5432 })}
                      placeholder="5432"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={dbConfig.database || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                      placeholder="resala_chat"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={dbConfig.username || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                      placeholder="postgres"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showDbPassword ? 'text' : 'password'}
                        value={dbConfig.password || ''}
                        onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDbPassword(!showDbPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
                      >
                        {showDbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      SSL Mode
                    </label>
                    <select
                      value={dbConfig.sslMode || 'Prefer'}
                      onChange={(e) => setDbConfig({ ...dbConfig, sslMode: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
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
                  className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition disabled:opacity-50 text-sm"
                >
                  {testingDb ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>Test Database Connection</span>
                    </>
                  )}
                </button>

                {dbTestResult && (
                  <div 
                    className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                      dbTestResult.success 
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' 
                        : 'bg-red-950/70 text-red-300 border-red-500/40'
                    }`}
                  >
                    {dbTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <span>{dbTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: STORAGE */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center">
                    <HardDrive className="w-5 h-5 text-emerald-400 mr-2" />
                    File & Media Storage Configuration
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Select where user chat uploads, media attachments, and avatars will be stored.
                  </p>
                </div>
                <div>
                  {renderSourceBadge(setupStatus?.storageSource)}
                </div>
              </div>

              {/* Provider Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setStorageConfig({ ...storageConfig, provider: 'LocalStorage' })}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    storageConfig.provider === 'LocalStorage'
                      ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${storageConfig.provider === 'LocalStorage' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Local Disk Storage</h3>
                    <p className="text-xs text-zinc-400 mt-1">Store uploaded files locally on disk or on an attached NAS volume.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStorageConfig({ ...storageConfig, provider: 'AzureBlob' })}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    storageConfig.provider === 'AzureBlob'
                      ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${storageConfig.provider === 'AzureBlob' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Azure Blob Storage</h3>
                    <p className="text-xs text-zinc-400 mt-1">Enterprise cloud storage with SAS secure signed token delivery.</p>
                  </div>
                </button>
              </div>

              {/* Local Storage Fields */}
              {storageConfig.provider === 'LocalStorage' ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Storage Directory Path
                  </label>
                  <input
                    type="text"
                    value={storageConfig.path || ''}
                    onChange={(e) => setStorageConfig({ ...storageConfig, path: e.target.value })}
                    placeholder="Leave empty for default './storage' directory"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Relative paths are resolved relative to the application content root.
                  </p>
                </div>
              ) : (
                /* Azure Fields */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Azure Storage Connection String
                    </label>
                    <input
                      type="password"
                      value={storageConfig.azureConnectionString || ''}
                      onChange={(e) => setStorageConfig({ ...storageConfig, azureConnectionString: e.target.value })}
                      placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Container Name
                      </label>
                      <input
                        type="text"
                        value={storageConfig.azureContainerName || 'files'}
                        onChange={(e) => setStorageConfig({ ...storageConfig, azureContainerName: e.target.value })}
                        placeholder="files"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        SAS Expiry (Days)
                      </label>
                      <input
                        type="number"
                        value={storageConfig.sasExpiryDays || 365}
                        onChange={(e) => setStorageConfig({ ...storageConfig, sasExpiryDays: parseInt(e.target.value) || 365 })}
                        placeholder="365"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
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
                  className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition disabled:opacity-50 text-sm"
                >
                  {testingStorage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Validating Storage...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>Validate Storage Permissions</span>
                    </>
                  )}
                </button>

                {storageTestResult && (
                  <div 
                    className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                      storageTestResult.success 
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' 
                        : 'bg-red-950/70 text-red-300 border-red-500/40'
                    }`}
                  >
                    {storageTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <span>{storageTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: AUTHENTICATION & MODE */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 mr-2" />
                    Authentication Mode & Setup
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Choose between local standalone user accounts or Active Directory / LDAP synchronization.
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
                      ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${authMode === 'Standalone' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Standalone Mode</h3>
                    <p className="text-xs text-zinc-400 mt-1">Self-managed database with local users, email/password, and initial administrator.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode('LDAP')}
                  className={`p-5 rounded-2xl border text-left transition-all flex items-start space-x-4 rtl:space-x-reverse ${
                    authMode === 'LDAP'
                      ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${authMode === 'LDAP' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Active Directory / LDAP</h3>
                    <p className="text-xs text-zinc-400 mt-1">Corporate directory authentication with automatic user provisioning.</p>
                  </div>
                </button>
              </div>

              {/* Standalone Admin Setup */}
              {authMode === 'Standalone' ? (
                <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Initial Super Admin Account
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={adminUser.displayName}
                        onChange={(e) => setAdminUser({ ...adminUser, displayName: e.target.value })}
                        placeholder="Administrator"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={adminUser.email}
                        onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })}
                        placeholder="admin@example.com"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          value={adminUser.password}
                          onChange={(e) => setAdminUser({ ...adminUser, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
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
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Domain / Server Host
                      </label>
                      <input
                        type="text"
                        value={ldapConfig.domainName}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, domainName: e.target.value })}
                        placeholder="ldap.corp.com or 192.168.1.10"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        UPN Base / Realm
                      </label>
                      <input
                        type="text"
                        value={ldapConfig.upnBase || ''}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, upnBase: e.target.value })}
                        placeholder="corp.domain.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Port
                      </label>
                      <input
                        type="number"
                        value={ldapConfig.port}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, port: parseInt(e.target.value) || 389 })}
                        placeholder="389"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 rtl:space-x-reverse pt-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ldapConfig.useSsl}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, useSsl: e.target.checked, port: e.target.checked ? 636 : 389 })}
                        className="rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950 w-4 h-4"
                      />
                      <span className="ml-2 rtl:mr-2 text-sm text-zinc-300">Use SSL / LDAPS (Port 636)</span>
                    </label>

                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ldapConfig.skipCertValidation}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, skipCertValidation: e.target.checked })}
                        className="rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950 w-4 h-4"
                      />
                      <span className="ml-2 rtl:mr-2 text-sm text-zinc-300">Allow Self-Signed / Skip Cert Check</span>
                    </label>
                  </div>

                  {/* LDAP Test Button & Result */}
                  <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleTestLdap}
                      disabled={testingLdap || !ldapConfig.domainName}
                      className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition disabled:opacity-50 text-sm"
                    >
                      {testingLdap ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Testing LDAP...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 text-emerald-400" />
                          <span>Test LDAP Reachability</span>
                        </>
                      )}
                    </button>

                    {ldapTestResult && (
                      <div 
                        className={`flex items-center space-x-2 rtl:space-x-reverse text-xs px-3.5 py-2 rounded-xl border ${
                          ldapTestResult.success 
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' 
                            : 'bg-red-950/70 text-red-300 border-red-500/40'
                        }`}
                      >
                        {ldapTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
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
              <div className="border-b border-zinc-800 pb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <Sparkles className="w-5 h-5 text-emerald-400 mr-2" />
                  Configuration Review & Smart Detection
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Verify your choices and inspect where settings are resolved in the ASP.NET Core provider chain.
                </p>
              </div>

              {/* Target File Notification */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 flex items-start space-x-3.5 rtl:space-x-reverse">
                <FileCode className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <h4 className="font-semibold text-emerald-300">External Configuration Destination</h4>
                  <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                    Configurations will be written directly to{' '}
                    <code className="bg-zinc-900 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                      appsettings.config.json
                    </code>
                    . This file is explicitly listed in <code className="bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded font-mono">.gitignore</code>, ensuring database credentials, storage paths, and secrets are never committed into Git.
                  </p>
                </div>
              </div>

              {/* Configuration Hierarchy Badges */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Current Detected Configuration Sources:
                </h3>
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-zinc-800/60 text-xs font-mono">
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-300 font-semibold">ConnectionStrings:DefaultConnection</span>
                        <p className="text-zinc-400 text-[11px] font-sans mt-0.5">Database connection string</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.databaseSource)}</div>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-300 font-semibold">Storage:Provider</span>
                        <p className="text-zinc-400 text-[11px] font-sans mt-0.5">Active file store ({storageConfig.provider})</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.storageSource)}</div>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-300 font-semibold">AuthMode</span>
                        <p className="text-zinc-400 text-[11px] font-sans mt-0.5">Authentication provider mode</p>
                      </div>
                      <div>{renderSourceBadge(setupStatus?.authModeSource)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready to Initialize */}
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Summary of Changes to Apply</h3>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                  <li>Write <code className="text-emerald-300">appsettings.config.json</code> with new database & storage configuration.</li>
                  <li>Execute pending Entity Framework Core migrations automatically.</li>
                  {authMode === 'Standalone' && (
                    <li>Create or verify Super Admin user <code className="text-emerald-300">{adminUser.email}</code>.</li>
                  )}
                  <li>Lock setup mode to prevent unauthorized tampering.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSetup}
                  disabled={isSaving}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-60"
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
          <div className="border-t border-zinc-800 mt-8 pt-6 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : <div />}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SetupPage;
