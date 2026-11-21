/**
 * Pure utilities for parsing, sanitizing, and validating Firebase Web SDK client configuration.
 * Keeps secrets out of the frontend (client config keys are public identifiers) and prevents
 * common copy-paste issues such as quotes, trailing commas, swapped App IDs, or invalid API keys.
 */

export interface ParsedFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

/**
 * Strips whitespace, surrounding quotes/backticks, and trailing commas/semicolons
 * from a pasted Firebase credential field.
 */
export function sanitizeConfigValue(value?: string): string {
  if (!value || typeof value !== 'string') return '';
  let cleaned = value.trim();
  // Remove trailing comma or semicolon (e.g. from JS object literal copy-paste)
  cleaned = cleaned.replace(/[,;]+$/g, '').trim();
  // Remove matching or dangling surrounding quotes/backticks
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
  return cleaned;
}

export function sanitizeFirebaseClientConfig<T extends ParsedFirebaseConfig>(config: T): T {
  const cleaned: ParsedFirebaseConfig = {
    apiKey: sanitizeConfigValue(config.apiKey),
    authDomain: sanitizeConfigValue(config.authDomain),
    projectId: sanitizeConfigValue(config.projectId),
    storageBucket: sanitizeConfigValue(config.storageBucket),
    messagingSenderId: sanitizeConfigValue(config.messagingSenderId),
    appId: sanitizeConfigValue(config.appId),
    firestoreDatabaseId: sanitizeConfigValue(config.firestoreDatabaseId),
  };

  const result: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(cleaned)) {
    if (v) result[k] = v;
  }
  return result as unknown as T;
}

/**
 * Validates the syntax of a Firebase Web API key before calling Firebase Auth/Firestore.
 */
export function validateFirebaseApiKeyFormat(rawApiKey?: string): {
  valid: boolean;
  cleanedKey: string;
  error?: string;
  details?: string;
} {
  const cleaned = sanitizeConfigValue(rawApiKey);

  if (!cleaned) {
    return {
      valid: false,
      cleanedKey: '',
      error: 'A API Key Web do Firebase é obrigatória.',
      details: 'Copie o campo apiKey em Firebase Console > Configurações do Projeto > Seus aplicativos Web.',
    };
  }

  const lower = cleaned.toLowerCase();
  if (
    cleaned.includes('...') ||
    lower.includes('sua_api_key') ||
    lower.includes('your_api_key') ||
    lower === 'aizasy'
  ) {
    return {
      valid: false,
      cleanedKey: cleaned,
      error: 'Você informou um texto de exemplo no lugar da API Key real.',
      details: 'Substitua pelo valor real de apiKey gerado pelo Firebase Console (aprox. 39 caracteres começando com "AIza").',
    };
  }

  if (/^\d+:\d+:web:/i.test(cleaned)) {
    return {
      valid: false,
      cleanedKey: cleaned,
      error: 'O valor colado no campo API Key é um App ID (1:...:web:...), e não a API Key.',
      details: 'Cole esse valor no campo "App ID" e informe no campo "API Key" a chave que começa com "AIza...".',
    };
  }

  if (/\s/.test(cleaned)) {
    return {
      valid: false,
      cleanedKey: cleaned,
      error: 'A API Key não pode conter espaços ou quebras de linha.',
      details: 'Cole apenas o valor da chave (ex: AIzaSyD...).',
    };
  }

  if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(cleaned)) {
    return {
      valid: false,
      cleanedKey: cleaned,
      error: 'Formato de API Key do Firebase inválido.',
      details: 'Uma Web API Key válida do Firebase sempre começa com "AIza" e possui cerca de 39 caracteres alfanuméricos.',
    };
  }

  return { valid: true, cleanedKey: cleaned };
}

/**
 * Parses a pasted Firebase JS snippet (`const firebaseConfig = { ... };`) or JSON object
 * into clean structured fields.
 */
export function parseFirebaseConfigSnippet(rawText: string): {
  success: boolean;
  config?: ParsedFirebaseConfig;
  error?: string;
} {
  const text = (rawText || '').trim();
  if (!text) {
    return { success: false, error: 'Cole o código firebaseConfig ou JSON do Firebase Console.' };
  }

  // 1. Try JSON directly first
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const cleaned = sanitizeFirebaseClientConfig(parsed as ParsedFirebaseConfig);
      if (cleaned.apiKey || cleaned.projectId) {
        return { success: true, config: cleaned };
      }
    }
  } catch {
    // Fallback to JS object literal regex extraction
  }

  const keys: (keyof ParsedFirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
    'firestoreDatabaseId',
  ];

  const extracted: ParsedFirebaseConfig = {};
  for (const key of keys) {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["'\`]([^"'\`\\r\\n]+)["'\`]`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      extracted[key] = sanitizeConfigValue(match[1]);
    }
  }

  const cleaned = sanitizeFirebaseClientConfig(extracted);
  if (!cleaned.apiKey && !cleaned.projectId) {
    return {
      success: false,
      error: 'Não foi possível identificar "apiKey" ou "projectId" no texto colado.',
    };
  }

  return { success: true, config: cleaned };
}
