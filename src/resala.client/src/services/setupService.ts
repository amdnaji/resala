import api from './api';

export interface ConfigurationSourceInfo {
  key: string;
  value: string | null;
  sourceType: 'AppSettings' | 'UserSecrets' | 'CustomConfig' | 'Environment' | 'CommandLine' | 'NotSet' | string;
  providerName: string;
  isMasked: boolean;
}

export interface SetupStatusResponse {
  isSetupCompleted: boolean;
  canConnectToDatabase: boolean;
  customConfigFileExists: boolean;
  customConfigFilePath: string;
  databaseSource?: ConfigurationSourceInfo;
  storageSource?: ConfigurationSourceInfo;
  authModeSource?: ConfigurationSourceInfo;
  allSources: Record<string, ConfigurationSourceInfo>;
  currentConfig: {
    databaseHost: string;
    databaseName: string;
    databaseUsername: string;
    storageProvider: string;
    storagePath: string;
    azureContainerName: string;
    authMode: string;
    ldapDomain: string;
  };
}

export interface TestDatabaseRequest {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslMode?: string;
  rawConnectionString?: string;
}

export interface TestStorageRequest {
  provider: string; // "LocalStorage" | "AzureBlob"
  path?: string;
  azureConnectionString?: string;
  azureContainerName?: string;
  sasExpiryDays?: number;
}

export interface TestLdapRequest {
  domainName: string;
  upnBase?: string;
  port: number;
  useSsl: boolean;
  skipCertValidation: boolean;
  testUsername?: string;
  testPassword?: string;
}

export interface AdminUserSetupDTO {
  email: string;
  password: string;
  displayName: string;
}

export interface SaveSetupRequest {
  database: TestDatabaseRequest;
  storage: TestStorageRequest;
  authMode: string;
  ldapSettings?: TestLdapRequest;
  adminUser?: AdminUserSetupDTO;
}

export interface TestResultDTO {
  success: boolean;
  message: string;
  details?: string;
}

export const setupService = {
  getStatus: async (): Promise<SetupStatusResponse> => {
    const res = await api.get<SetupStatusResponse>('/setup/status');
    return res.data;
  },

  getConfigurationSources: async (): Promise<Record<string, ConfigurationSourceInfo>> => {
    const res = await api.get<Record<string, ConfigurationSourceInfo>>('/setup/sources');
    return res.data;
  },

  testDatabase: async (data: TestDatabaseRequest): Promise<TestResultDTO> => {
    const res = await api.post<TestResultDTO>('/setup/test-db', data);
    return res.data;
  },

  testStorage: async (data: TestStorageRequest): Promise<TestResultDTO> => {
    const res = await api.post<TestResultDTO>('/setup/test-storage', data);
    return res.data;
  },

  testLdap: async (data: TestLdapRequest): Promise<TestResultDTO> => {
    const res = await api.post<TestResultDTO>('/setup/test-ldap', data);
    return res.data;
  },

  saveSetup: async (data: SaveSetupRequest): Promise<TestResultDTO> => {
    const res = await api.post<TestResultDTO>('/setup/save', data);
    return res.data;
  }
};
