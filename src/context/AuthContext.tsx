import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseAuthUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, UserRole } from '../types/extinguisher';
import { storageService } from '../services/storageService';
import {
  getFirebaseAuth,
  getFirestoreDb,
  getGoogleAuthProvider,
  isFirebaseFullyConfigured,
  subscribeFirebaseStatus,
  FIRESTORE_COLLECTIONS,
} from '../services/firebaseConfig';
import { resolveRolePermissions, stripUndefinedFields } from '../utils/migrationLogic';

interface AuthContextType {
  currentUser: User | null;
  availableUsers: User[];
  firebaseUser: FirebaseAuthUser | null;
  isFirebaseMode: boolean;
  isAuthLoading: boolean;
  isUnauthorizedAccount: boolean;
  isBlockedAccount: boolean;
  authError: string | null;
  switchUser: (userId: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerFirstAccessWithEmail: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  sendResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshFirebaseAuthBinding: () => void;
  canCreateExtinguisher: boolean;
  canEditExtinguisher: boolean;
  canDeleteExtinguisher: boolean;
  canRegisterMovement: boolean;
  canInterdict: boolean;
  canManageUsers: boolean;
  canManageUnits: boolean;
  canManageSettings: boolean;
  isReadOnly: boolean;
}

const CURRENT_USER_KEY = 'extintores_manager_current_user_v1';

const LOCAL_SETUP_USER: User = {
  id: 'local-setup-session',
  authProvider: 'local',
  name: 'Sessão Local (Firebase não configurado)',
  email: 'local@sem-firebase',
  role: 'ADMIN',
  status: 'ATIVO',
  department: 'Configuração Inicial',
  authorizedUnitIds: ['ALL'],
  createdAt: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('auth/configuration-not-found') ||
    msg.includes('CONFIGURATION_NOT_FOUND')
  ) {
    return 'Firebase Authentication ainda não foi ativado neste projeto (auth/configuration-not-found). No Firebase Console, acesse Criação > Authentication, clique em "Vamos começar" e ative E-mail/senha (e Google), ou confira se o projectId e a apiKey pertencem ao mesmo projeto.';
  }
  if (
    msg.includes('auth/api-key-not-valid') ||
    msg.includes('auth/invalid-api-key') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('api-key-not-valid')
  ) {
    return 'API Key do Firebase inválida (auth/api-key-not-valid). Clique em "Corrigir API Key / Config. Firebase" abaixo, copie novamente a "apiKey" (começa com AIza...) no Firebase Console > Configurações do Projeto > Seus aplicativos Web, ou volte ao Modo Local.';
  }
  if (
    msg.includes('API_KEY_HTTP_REFERRER_BLOCKED') ||
    msg.includes('requests-from-referer')
  ) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'este domínio';
    return `API Key bloqueada por restrição de domínio (HTTP Referrer). No Google Cloud Console > Credenciais, adicione "${origin}/*" à chave Web ou remova a restrição de referenciador.`;
  }
  if (msg.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
    return `Domínio "${host}" não autorizado no Firebase Authentication. No Firebase Console > Authentication > Settings > Authorized domains, clique em "Add domain" e adicione "${host}".`;
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'Nenhuma conta encontrada com este e-mail. Use "Primeiro Acesso" se você já foi pré-autorizado.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'Este e-mail já possui uma senha cadastrada. Utilize a aba "Entrar".';
  }
  if (msg.includes('auth/weak-password')) {
    return 'A senha deve possuir no mínimo 6 caracteres.';
  }
  if (msg.includes('auth/invalid-email')) {
    return 'Endereço de e-mail inválido.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos ou redefina a senha.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Login com Google cancelado antes da conclusão.';
  }
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Método de login não habilitado no Firebase Console > Authentication > Sign-in method.';
  }
  if (msg.includes('auth/network-request-failed')) {
    return 'Falha de rede ao contactar o Firebase Authentication.';
  }
  return `Erro na autenticação: ${msg}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configEpoch, setConfigEpoch] = useState(0);
  const [isFirebaseMode, setIsFirebaseMode] = useState<boolean>(() => isFirebaseFullyConfigured());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => isFirebaseFullyConfigured());
  const [isUnauthorizedAccount, setIsUnauthorizedAccount] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [availableUsers, setAvailableUsers] = useState<User[]>(() => storageService.getUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (isFirebaseFullyConfigured()) return null;
    const localUsers = storageService.getLocalUsers();
    if (localUsers.length > 0 && typeof window !== 'undefined') {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const found = localUsers.find((u) => u.id === parsed.id);
          if (found) return found;
        } catch {
          // ignore
        }
      }
      const admin = localUsers.find((u) => u.role === 'ADMIN' && u.status === 'ATIVO');
      return admin || LOCAL_SETUP_USER;
    }
    return LOCAL_SETUP_USER;
  });

  const refreshFirebaseAuthBinding = useCallback(() => {
    setIsFirebaseMode(isFirebaseFullyConfigured());
    setConfigEpoch((e) => e + 1);
  }, []);

  // Watch Firebase config status changes (when user saves/disconnects config in UI)
  useEffect(() => {
    return subscribeFirebaseStatus((status) => {
      setIsFirebaseMode(status.isConfigured);
    });
  }, []);

  // Resolve Firestore RBAC profile for an authenticated Firebase user
  const resolveFirestoreUserProfile = useCallback(async (fbUser: FirebaseAuthUser) => {
    const db = getFirestoreDb();
    if (!db) {
      setAuthError('Instância do Cloud Firestore não disponível.');
      return;
    }

    setIsUnauthorizedAccount(false);
    setAuthError(null);

    const emailLower = (fbUser.email || '').trim().toLowerCase();
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, fbUser.uid);

    try {
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const profile = userSnap.data() as User;
        const nowIso = new Date().toISOString();
        const updatedProfile: User = {
          ...profile,
          firebaseUid: fbUser.uid,
          lastLoginAt: nowIso,
          avatarUrl: profile.avatarUrl || fbUser.photoURL || undefined,
        };

        // Best-effort update of lastLoginAt (allowed by firestore.rules for own doc)
        setDoc(
          userRef,
          stripUndefinedFields(updatedProfile as unknown as Record<string, unknown>),
          { merge: true }
        ).catch(() => {});

        setCurrentUser(updatedProfile);
        if (updatedProfile.status === 'ATIVO') {
          storageService.connectFirestore(fbUser);
        } else {
          storageService.disconnectFirestore();
        }
        return;
      }

      // User document at /users/{uid} does not exist yet:
      // 1) Check /user_invites/{email} (created beforehand by an Administrator)
      let inviteProfile: User | null = null;
      if (emailLower) {
        try {
          const inviteSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USER_INVITES, emailLower));
          if (inviteSnap.exists()) {
            inviteProfile = inviteSnap.data() as User;
          }
        } catch {
          // ignore if no invite exists
        }
      }

      if (inviteProfile) {
        const nowIso = new Date().toISOString();
        const activatedProfile: User = {
          ...inviteProfile,
          id: fbUser.uid,
          firebaseUid: fbUser.uid,
          authProvider:
            fbUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password',
          name: inviteProfile.name || fbUser.displayName || emailLower,
          email: emailLower,
          avatarUrl: inviteProfile.avatarUrl || fbUser.photoURL || undefined,
          lastLoginAt: nowIso,
        };

        await setDoc(
          userRef,
          stripUndefinedFields(activatedProfile as unknown as Record<string, unknown>)
        );

        setCurrentUser(activatedProfile);
        if (activatedProfile.status === 'ATIVO') {
          storageService.connectFirestore(fbUser);
        }
        return;
      }

      // 2) Check initial project bootstrap (/system_settings/global does not exist yet)
      // or bootstrap owner email
      let isBootstrap = false;
      try {
        const settingsSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global'));
        if (!settingsSnap.exists()) {
          isBootstrap = true;
        }
      } catch {
        // ignore
      }

      if (
        isBootstrap ||
        (emailLower === 'silvagomesjoanderson2001@gmail.com' && fbUser.emailVerified)
      ) {
        const nowIso = new Date().toISOString();
        const adminProfile: User = {
          id: fbUser.uid,
          firebaseUid: fbUser.uid,
          authProvider:
            fbUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password',
          name: fbUser.displayName || emailLower.split('@')[0] || 'Administrador',
          email: emailLower,
          role: 'ADMIN',
          status: 'ATIVO',
          department: 'Gestão Patrimonial & SESMT',
          authorizedUnitIds: ['ALL'],
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };

        if (isBootstrap) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global'), {
            companyName: 'Extintores Manager',
            cnpj: '',
            sesmtDepartment: 'SESMT & Segurança Operacional',
            minTechnicalReservePercent: 15,
            maintenanceAlertWindowDays: 30,
            autoSyncFirestore: true,
          });
        }

        await setDoc(
          userRef,
          stripUndefinedFields(adminProfile as unknown as Record<string, unknown>)
        );

        setCurrentUser(adminProfile);
        storageService.connectFirestore(fbUser);
        return;
      }

      // Authenticated in Firebase Auth, but NOT authorized by an Admin in Firestore yet
      storageService.disconnectFirestore();
      setCurrentUser(null);
      setIsUnauthorizedAccount(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar perfil do usuário no Firestore:', msg);
      setAuthError(
        msg.includes('permission-denied')
          ? 'Permissão negada no Firestore ao verificar o perfil do usuário. Verifique se as regras de segurança (firestore.rules) foram publicadas.'
          : `Erro ao consultar perfil no Firestore: ${msg}`
      );
      storageService.disconnectFirestore();
    }
  }, []);

  // Listen to Firebase Auth state whenever Firebase is configured
  useEffect(() => {
    const configured = isFirebaseFullyConfigured();
    setIsFirebaseMode(configured);

    if (!configured) {
      storageService.disconnectFirestore();
      setFirebaseUser(null);
      setIsAuthLoading(false);
      setIsUnauthorizedAccount(false);
      setAuthError(null);

      const localUsers = storageService.getLocalUsers();
      if (localUsers.length > 0) {
        const admin = localUsers.find((u) => u.role === 'ADMIN' && u.status === 'ATIVO');
        setCurrentUser(admin || LOCAL_SETUP_USER);
      } else {
        setCurrentUser(LOCAL_SETUP_USER);
      }
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setIsAuthLoading(false);
      setAuthError('Não foi possível inicializar o Firebase Authentication.');
      return;
    }

    setIsAuthLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        storageService.disconnectFirestore();
        setCurrentUser(null);
        setIsUnauthorizedAccount(false);
        setIsAuthLoading(false);
        return;
      }

      await resolveFirestoreUserProfile(fbUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, [configEpoch, resolveFirestoreUserProfile]);

  // Keep availableUsers and active currentUser synchronized in real time
  useEffect(() => {
    const unsubscribe = storageService.subscribeUsers((users) => {
      // Deduplicate by email when both a pre-registered invite doc (usr-*) and an activated uid doc exist
      const byEmail = new Map<string, User>();
      for (const u of users) {
        const key = u.email.trim().toLowerCase();
        const prev = byEmail.get(key);
        if (!prev || (!prev.firebaseUid && u.firebaseUid)) {
          byEmail.set(key, u);
        }
      }
      const deduped = Array.from(byEmail.values());
      setAvailableUsers(deduped);

      setCurrentUser((prev) => {
        if (!prev) return prev;
        if (prev.id === LOCAL_SETUP_USER.id && !isFirebaseFullyConfigured()) {
          const admin = deduped.find((u) => u.role === 'ADMIN' && u.status === 'ATIVO');
          if (admin) {
            return admin;
          }
          return prev;
        }

        const refreshed =
          deduped.find((u) => u.id === prev.id) ||
          deduped.find((u) => u.email.toLowerCase() === prev.email.toLowerCase());
        if (refreshed) {
          if (!isFirebaseFullyConfigured()) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(refreshed));
          }
          return refreshed;
        }
        return prev;
      });
    });
    return unsubscribe;
  }, []);

  const switchUser = (userId: string) => {
    if (isFirebaseMode) return; // Disabled in real Firebase Auth mode
    const target = availableUsers.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(target));
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const auth = getFirebaseAuth();
    if (!auth) return { success: false, error: 'Firebase Authentication não configurado.' };
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const registerFirstAccessWithEmail = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const auth = getFirebaseAuth();
    if (!auth) return { success: false, error: 'Firebase Authentication não configurado.' };
    try {
      setAuthError(null);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    const auth = getFirebaseAuth();
    if (!auth) return { success: false, error: 'Firebase Authentication não configurado.' };
    try {
      setAuthError(null);
      await signInWithPopup(auth, getGoogleAuthProvider());
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const sendResetPassword = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const auth = getFirebaseAuth();
    if (!auth) return { success: false, error: 'Firebase Authentication não configurado.' };
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err) {
      return { success: false, error: mapFirebaseAuthError(err) };
    }
  };

  const logout = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    storageService.disconnectFirestore();
    if (auth) {
      await signOut(auth);
    }
    setFirebaseUser(null);
    setCurrentUser(null);
    setIsUnauthorizedAccount(false);
    setAuthError(null);
  };

  const role: UserRole = currentUser?.role || 'CONSULTA';
  const status = currentUser?.status || 'BLOQUEADO';
  const isBlockedAccount = Boolean(currentUser && currentUser.status === 'BLOQUEADO');
  const permissions = resolveRolePermissions(role, status);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        availableUsers,
        firebaseUser,
        isFirebaseMode,
        isAuthLoading,
        isUnauthorizedAccount,
        isBlockedAccount,
        authError,
        switchUser,
        loginWithEmail,
        registerFirstAccessWithEmail,
        loginWithGoogle,
        sendResetPassword,
        logout,
        refreshFirebaseAuthBinding,
        ...permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
