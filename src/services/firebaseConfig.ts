/**
 * Firebase Firestore & Authentication configuration module for Extintores Manager.
 * - Zero administrative credentials or service accounts on the frontend.
 * - Supports firebase-applet-config.json, VITE_FIREBASE_* env vars, and manual runtime config.
 * - Tracks REAL server verification status: never reports "connected" without a verified server handshake.
 */

import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import {
  sanitizeFirebaseClientConfig,
  validateFirebaseApiKeyFormat,
} from '../utils/firebaseConfigParser';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

export type FirebaseConnectionPhase =
  | 'UNCONFIGURED'
  | 'CONFIGURED_UNVERIFIED'
  | 'TESTING'
  | 'REACHABLE_NEEDS_AUTH'
  | 'CONNECTED'
  | 'ERROR';

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean; // True ONLY after verified server check
  phase: FirebaseConnectionPhase;
  mode: 'LOCAL_STORAGE' | 'FIRESTORE';
  projectId?: string;
  source: 'APPLET_CONFIG' | 'ENV' | 'MANUAL' | 'NONE';
  lastChecked?: string;
  statusMessage: string;
  errorMessage?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const MANUAL_CONFIG_KEY = 'extintores_manager_firebase_config_v1';

// Optional compile-safe load of firebase-applet-config.json if present in workspace root
const appletConfigModules =
  typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function'
    ? (import.meta.glob('/firebase-applet-config.json', { eager: true }) as Record<
        string,
        { default?: FirebaseClientConfig } | FirebaseClientConfig
      >)
    : {};

function getBundledAppletConfig(): FirebaseClientConfig | null {
  const mod = appletConfigModules['/firebase-applet-config.json'];
  if (!mod) return null;
  const cfg = ('default' in mod && mod.default ? mod.default : mod) as FirebaseClientConfig;
  if (!cfg || !cfg.projectId || cfg.projectId === 'remixed-project-id') return null;
  return cfg;
}

export function getSavedManualConfig(): FirebaseClientConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MANUAL_CONFIG_KEY);
    if (!raw) return null;
    const parsed = sanitizeFirebaseClientConfig(JSON.parse(raw) as FirebaseClientConfig);
    if (!parsed || !parsed.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Runtime cached instances
let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedConfigKey = '';

let currentStatus: FirebaseConnectionStatus = {
  isConfigured: false,
  isConnected: false,
  phase: 'UNCONFIGURED',
  mode: 'LOCAL_STORAGE',
  source: 'NONE',
  statusMessage: 'Firebase não configurado (Armazenamento Local ativo).',
};

const statusListeners = new Set<(status: FirebaseConnectionStatus) => void>();

function notifyStatusListeners() {
  statusListeners.forEach((listener) => listener({ ...currentStatus }));
}

export function subscribeFirebaseStatus(
  listener: (status: FirebaseConnectionStatus) => void
): () => void {
  statusListeners.add(listener);
  listener(getFirebaseConnectionStatus());
  return () => statusListeners.delete(listener);
}

export function getActiveFirebaseConfig(): {
  config: FirebaseClientConfig | null;
  source: 'APPLET_CONFIG' | 'ENV' | 'MANUAL' | 'NONE';
} {
  // 1. Manual runtime override saved by administrator
  const manual = getSavedManualConfig();
  if (manual && manual.projectId && manual.apiKey) {
    return { config: manual, source: 'MANUAL' };
  }

  // 2. Bundled firebase-applet-config.json
  const bundled = getBundledAppletConfig();
  if (bundled && bundled.projectId && bundled.apiKey) {
    return { config: bundled, source: 'APPLET_CONFIG' };
  }

  // 3. Vite environment variables (.env / .env.production)
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const envProjectId = (env?.VITE_FIREBASE_PROJECT_ID as string) || '';
  const envApiKey = (env?.VITE_FIREBASE_API_KEY as string) || '';

  if (envProjectId && envApiKey) {
    return {
      config: {
        projectId: envProjectId,
        apiKey: envApiKey,
        authDomain:
          (env?.VITE_FIREBASE_AUTH_DOMAIN as string) || `${envProjectId}.firebaseapp.com`,
        storageBucket:
          (env?.VITE_FIREBASE_STORAGE_BUCKET as string) || `${envProjectId}.appspot.com`,
        messagingSenderId: (env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
        appId: (env?.VITE_FIREBASE_APP_ID as string) || '',
        firestoreDatabaseId: (env?.VITE_FIREBASE_DATABASE_ID as string) || undefined,
      },
      source: 'ENV',
    };
  }

  // If user saved a partial manual config (only projectId, missing apiKey), expose it so UI prompts for apiKey
  if (manual && manual.projectId) {
    return { config: manual, source: 'MANUAL' };
  }

  return { config: null, source: 'NONE' };
}

export function isFirebaseFullyConfigured(): boolean {
  const { config } = getActiveFirebaseConfig();
  return Boolean(config?.projectId?.trim() && config?.apiKey?.trim());
}

function resetCachedInstances() {
  cachedDb = null;
  cachedAuth = null;
  cachedConfigKey = '';
  if (cachedApp) {
    const appToDelete = cachedApp;
    cachedApp = null;
    deleteApp(appToDelete).catch(() => {});
  }
}

export function saveManualConfig(rawConfig: FirebaseClientConfig): void {
  if (typeof window === 'undefined') return;
  const config = sanitizeFirebaseClientConfig(rawConfig);
  localStorage.setItem(MANUAL_CONFIG_KEY, JSON.stringify(config));
  resetCachedInstances();
  currentStatus = {
    isConfigured: Boolean(config.projectId && config.apiKey),
    isConnected: false,
    phase: config.projectId && config.apiKey ? 'CONFIGURED_UNVERIFIED' : 'UNCONFIGURED',
    mode: 'LOCAL_STORAGE',
    projectId: config.projectId,
    source: 'MANUAL',
    statusMessage:
      config.projectId && config.apiKey
        ? 'Configuração salva. Aguardando verificação real de conexão com o servidor.'
        : 'Informe a API Key do Firebase para habilitar a conexão.',
  };
  notifyStatusListeners();
}

export function removeManualConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MANUAL_CONFIG_KEY);
  resetCachedInstances();
  currentStatus = {
    isConfigured: false,
    isConnected: false,
    phase: 'UNCONFIGURED',
    mode: 'LOCAL_STORAGE',
    source: 'NONE',
    statusMessage: 'Configuração manual removida. Operando em armazenamento local.',
  };
  notifyStatusListeners();
}

export function getFirebaseApp(): FirebaseApp | null {
  const { config: rawConfig } = getActiveFirebaseConfig();
  if (!rawConfig) return null;
  const config = sanitizeFirebaseClientConfig(rawConfig);
  if (!config.projectId || !config.apiKey) return null;

  const key = `${config.projectId}:${config.apiKey}:${config.firestoreDatabaseId || ''}`;
  if (
    cachedApp &&
    cachedConfigKey === key &&
    cachedApp.options.apiKey === config.apiKey &&
    cachedApp.options.projectId === config.projectId
  ) {
    return cachedApp;
  }

  try {
    if (cachedApp && cachedConfigKey !== key) {
      resetCachedInstances();
    }

    const apps = getApps();
    const exactMatch = apps.find(
      (a) => a.options.projectId === config.projectId && a.options.apiKey === config.apiKey
    );

    if (exactMatch) {
      cachedApp = exactMatch;
    } else if (!apps.some((a) => a.name === '[DEFAULT]')) {
      cachedApp = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    } else {
      const keySuffix = config.apiKey.slice(-8).replace(/[^a-zA-Z0-9]/g, '');
      const appName = `extintores-${config.projectId}-${keySuffix}-${Date.now()}`;
      cachedApp = initializeApp(
        {
          apiKey: config.apiKey,
          authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
          projectId: config.projectId,
          storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        },
        appName
      );
    }

    cachedConfigKey = key;
    return cachedApp;
  } catch (err) {
    console.warn('Erro ao inicializar Firebase App:', err);
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (cachedDb && cachedDb.app === app) return cachedDb;

  const { config } = getActiveFirebaseConfig();
  try {
    if (typeof window !== 'undefined') {
      try {
        cachedDb = config?.firestoreDatabaseId
          ? initializeFirestore(
              app,
              {
                localCache: persistentLocalCache({
                  tabManager: persistentMultipleTabManager(),
                }),
              },
              config.firestoreDatabaseId
            )
          : initializeFirestore(app, {
              localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
              }),
            });
      } catch {
        // Fallback when Firestore was already initialized on this app instance
        cachedDb = config?.firestoreDatabaseId
          ? getFirestore(app, config.firestoreDatabaseId)
          : getFirestore(app);
      }
    } else {
      cachedDb = config?.firestoreDatabaseId
        ? getFirestore(app, config.firestoreDatabaseId)
        : getFirestore(app);
    }
    return cachedDb;
  } catch (err) {
    console.warn('Erro ao inicializar Cloud Firestore:', err);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (cachedAuth && cachedAuth.app === app) return cachedAuth;

  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    console.warn('Erro ao inicializar Firebase Auth:', err);
    return null;
  }
}

export function getGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Throws a structured JSON error for Firestore permission or operation failures.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getFirebaseConnectionStatus = (): FirebaseConnectionStatus => {
  const { config, source } = getActiveFirebaseConfig();
  const configured = Boolean(config?.projectId?.trim() && config?.apiKey?.trim());

  if (!configured) {
    return {
      isConfigured: false,
      isConnected: false,
      phase: 'UNCONFIGURED',
      mode: 'LOCAL_STORAGE',
      projectId: config?.projectId,
      source,
      statusMessage: config?.projectId
        ? 'Projeto parcial: informe também a API Key Web do Firebase.'
        : 'Firebase não configurado (Armazenamento Local ativo).',
    };
  }

  return {
    ...currentStatus,
    isConfigured: true,
    projectId: config?.projectId,
    source,
    mode: currentStatus.isConnected ? 'FIRESTORE' : 'LOCAL_STORAGE',
  };
};

export function markFirestoreLiveConnected(projectId: string) {
  const { source } = getActiveFirebaseConfig();
  currentStatus = {
    isConfigured: true,
    isConnected: true,
    phase: 'CONNECTED',
    mode: 'FIRESTORE',
    projectId,
    source,
    lastChecked: new Date().toISOString(),
    statusMessage: `Conectado e sincronizando em tempo real (${projectId}).`,
  };
  notifyStatusListeners();
}

export function markFirestoreError(message: string) {
  const { config, source } = getActiveFirebaseConfig();
  currentStatus = {
    isConfigured: Boolean(config?.projectId && config?.apiKey),
    isConnected: false,
    phase: 'ERROR',
    mode: 'LOCAL_STORAGE',
    projectId: config?.projectId,
    source,
    lastChecked: new Date().toISOString(),
    statusMessage: 'Falha na conexão com o Firebase.',
    errorMessage: message,
  };
  notifyStatusListeners();
}

/**
 * Verifies a Firebase Web API Key against Google Identity Toolkit (Firebase Auth)
 * before saving or assuming Auth will work.
 */
export async function verifyFirebaseWebApiKey(rawApiKey?: string): Promise<{
  valid: boolean;
  message?: string;
  details?: string;
}> {
  const formatCheck = validateFirebaseApiKeyFormat(rawApiKey);
  if (!formatCheck.valid) {
    return {
      valid: false,
      message: formatCheck.error || 'Formato de API Key inválido.',
      details: formatCheck.details,
    };
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        formatCheck.cleanedKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'validation-probe' }),
      }
    );

    const data = (await resp.json().catch(() => null)) as {
      error?: { message?: string; details?: Array<{ reason?: string }> };
    } | null;

    const errMsg = data?.error?.message || '';
    const reasons = (data?.error?.details || []).map((d) => d.reason || '').join(' ');

    if (
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('API key not valid') ||
      reasons.includes('API_KEY_INVALID')
    ) {
      return {
        valid: false,
        message: 'API Key inválida para o Firebase Authentication (auth/api-key-not-valid).',
        details:
          'Copie novamente exatamente o valor de "apiKey" (começa com AIza...) em Firebase Console > Configurações do Projeto > Seus aplicativos Web.',
      };
    }

    if (
      errMsg.includes('API_KEY_HTTP_REFERRER_BLOCKED') ||
      reasons.includes('API_KEY_HTTP_REFERRER_BLOCKED')
    ) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'este domínio';
      return {
        valid: false,
        message: 'API Key bloqueada por restrição de domínio (HTTP Referrer).',
        details: `No Google Cloud Console > APIs e Serviços > Credenciais, libere "${origin}/*" na chave Web do projeto.`,
      };
    }

    if (
      errMsg.includes('API_KEY_SERVICE_BLOCKED') ||
      errMsg.includes('SERVICE_DISABLED') ||
      reasons.includes('API_KEY_SERVICE_BLOCKED')
    ) {
      return {
        valid: false,
        message: 'Identity Toolkit API não habilitada para esta API Key.',
        details:
          'Ative o Firebase Authentication (Criação > Authentication > Vamos começar) no Firebase Console ou remova restrições de API da chave.',
      };
    }

    // INVALID_ID_TOKEN / USER_NOT_FOUND means the API key itself was accepted by Firebase Auth!
    // Next, verify Firebase Authentication has actually been initialized ("Get started") in the project.
    const continueUri =
      typeof window !== 'undefined' && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost';

    const authConfigResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(
        formatCheck.cleanedKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'probe@extintores.local',
          continueUri,
        }),
      }
    );

    if (!authConfigResp.ok) {
      const authData = (await authConfigResp.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const authErrMsg = authData?.error?.message || '';
      if (authErrMsg.includes('CONFIGURATION_NOT_FOUND')) {
        return {
          valid: false,
          message:
            'Firebase Authentication ainda não foi ativado neste projeto (auth/configuration-not-found).',
          details:
            'No Firebase Console deste projeto, abra Criação > Authentication, clique em "Vamos começar" (Get started) e ative os provedores E-mail/senha e Google.',
        };
      }
    }

    return { valid: true };
  } catch {
    // Offline or blocked probe: format passed, allow proceeding cleanly
    return { valid: true };
  }
}

/**
 * Performs a real server handshake with Firestore via getDocFromServer.
 * NEVER claims connected unless the server actually responds cleanly.
 */
export async function testFirestoreConnection(customConfig?: FirebaseClientConfig): Promise<{
  success: boolean;
  verifiedRead: boolean;
  message: string;
  details?: string;
}> {
  const active = getActiveFirebaseConfig();
  const rawTarget = customConfig || active.config;
  const targetConfig = rawTarget ? sanitizeFirebaseClientConfig(rawTarget) : null;
  const projectId = targetConfig?.projectId || '';
  const apiKey = targetConfig?.apiKey || '';

  if (!projectId || !apiKey) {
    return {
      success: false,
      verifiedRead: false,
      message: 'Credenciais incompletas: informe o ID do Projeto e a API Key Web.',
      details: 'Ambos os campos são obrigatórios no Firebase Console > Configurações do Projeto.',
    };
  }

  const isTestingCurrentActive = !customConfig;
  if (isTestingCurrentActive) {
    currentStatus = {
      ...getFirebaseConnectionStatus(),
      phase: 'TESTING',
      statusMessage: 'Validando API Key e conexão real com o Firebase...',
    };
    notifyStatusListeners();
  }

  // Validate API Key with Firebase Auth Identity Toolkit first
  const keyCheck = await verifyFirebaseWebApiKey(apiKey);
  if (!keyCheck.valid) {
    if (isTestingCurrentActive) {
      markFirestoreError(keyCheck.message || 'API Key inválida.');
    }
    return {
      success: false,
      verifiedRead: false,
      message: keyCheck.message || 'API Key inválida.',
      details: keyCheck.details,
    };
  }

  let tempApp: FirebaseApp | null = null;
  try {
    let testDb: Firestore | null = null;
    let isAuthenticated = false;

    if (customConfig && targetConfig) {
      const appName = `test-app-${Date.now()}`;
      tempApp = initializeApp(
        {
          apiKey,
          authDomain:
            targetConfig.authDomain || `${projectId}.firebaseapp.com`,
          projectId,
          storageBucket:
            targetConfig.storageBucket || `${projectId}.appspot.com`,
          messagingSenderId: targetConfig.messagingSenderId,
          appId: targetConfig.appId,
        },
        appName
      );
      testDb = targetConfig.firestoreDatabaseId
        ? getFirestore(tempApp, targetConfig.firestoreDatabaseId)
        : getFirestore(tempApp);
    } else {
      testDb = getFirestoreDb();
      isAuthenticated = Boolean(getFirebaseAuth()?.currentUser);
    }

    if (!testDb) {
      return {
        success: false,
        verifiedRead: false,
        message: 'Não foi possível inicializar a instância do Firestore.',
      };
    }

    try {
      await getDocFromServer(doc(testDb, 'test', 'connection'));
      if (isTestingCurrentActive) {
        markFirestoreLiveConnected(projectId);
      }
      return {
        success: true,
        verifiedRead: true,
        message: 'Conexão real com o Cloud Firestore verificada com sucesso!',
        details: `Projeto ativo: ${projectId}. Leitura de servidor confirmada.`,
      };
    } catch (testError: unknown) {
      const errMsg = testError instanceof Error ? testError.message : String(testError);

      if (errMsg.includes('the client is offline') || errMsg.includes('unavailable')) {
        if (isTestingCurrentActive) {
          markFirestoreError('Cliente offline ou servidor Firestore inacessível.');
        }
        return {
          success: false,
          verifiedRead: false,
          message: 'Servidor Firestore inacessível ou dispositivo offline.',
          details: 'Verifique sua conexão de internet e se o Project ID está correto.',
        };
      }

      if (errMsg.includes('API key not valid') || errMsg.includes('invalid-api-key')) {
        if (isTestingCurrentActive) {
          markFirestoreError('API Key inválida para este projeto Firebase.');
        }
        return {
          success: false,
          verifiedRead: false,
          message: 'API Key inválida.',
          details: 'Copie novamente a apiKey em Configurações do Projeto > Seus aplicativos Web.',
        };
      }

      if (errMsg.includes('not-found') || errMsg.includes('database does not exist')) {
        if (isTestingCurrentActive) {
          markFirestoreError('Banco de dados Firestore ainda não foi criado.');
        }
        return {
          success: false,
          verifiedRead: false,
          message: 'Banco de dados Firestore não encontrado neste projeto.',
          details:
            'Acesse Firebase Console > Criação > Firestore Database e clique em "Criar banco de dados".',
        };
      }

      if (
        errMsg.includes('permission-denied') ||
        errMsg.includes('Missing or insufficient permissions')
      ) {
        if (!isAuthenticated && isTestingCurrentActive) {
          currentStatus = {
            isConfigured: true,
            isConnected: false,
            phase: 'REACHABLE_NEEDS_AUTH',
            mode: 'LOCAL_STORAGE',
            projectId,
            source: active.source,
            lastChecked: new Date().toISOString(),
            statusMessage:
              'Servidor Firestore localizado. Faça login no Firebase Authentication para sincronizar.',
          };
          notifyStatusListeners();
        } else if (isTestingCurrentActive) {
          markFirestoreError(
            'Acesso negado pelas regras do Firestore (firestore.rules) para o usuário autenticado.'
          );
        }

        return {
          success: !isAuthenticated,
          verifiedRead: false,
          message: isAuthenticated
            ? 'Acesso bloqueado pelas regras de segurança do Firestore.'
            : 'Projeto e banco Firestore localizados! Autenticação necessária.',
          details: isAuthenticated
            ? 'Publique as regras do arquivo firestore.rules no Firebase Console > Firestore > Regras.'
            : 'As regras de segurança exigem usuário autenticado. Salve a configuração e entre com sua conta na tela de login.',
        };
      }

      if (isTestingCurrentActive) {
        markFirestoreError(errMsg);
      }
      return {
        success: false,
        verifiedRead: false,
        message: 'Não foi possível validar a conexão com o Firestore.',
        details: errMsg,
      };
    }
  } catch (err: unknown) {
    const errorString = err instanceof Error ? err.message : String(err);
    if (isTestingCurrentActive) {
      markFirestoreError(errorString);
    }
    return {
      success: false,
      verifiedRead: false,
      message: 'Erro ao inicializar cliente Firebase.',
      details: errorString,
    };
  } finally {
    if (tempApp) {
      deleteApp(tempApp).catch(() => {});
    }
  }
}

export const FIRESTORE_COLLECTIONS = {
  EXTINGUISHERS: 'extinguishers',
  MOVEMENTS: 'movements',
  USERS: 'users',
  USER_INVITES: 'user_invites',
  UNITS: 'units',
  SETTINGS: 'system_settings',
} as const;
