import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { User as FirebaseAuthUser } from 'firebase/auth';
import {
  Extinguisher,
  Movement,
  MovementType,
  User,
  UserRole,
  UserStatus,
  Unit,
  SystemSettings,
} from '../types/extinguisher';
import {
  getFirestoreDb,
  getFirebaseAuth,
  FIRESTORE_COLLECTIONS,
  markFirestoreLiveConnected,
  markFirestoreError,
  getActiveFirebaseConfig,
} from './firebaseConfig';
import {
  buildIdempotentMigrationPlan,
  chunkItems,
  DataSnapshot,
  MigrationPlan,
  parseBackupJson,
  stripUndefinedFields,
} from '../utils/migrationLogic';

const EXTINGUISHERS_STORAGE_KEY = 'extintores_manager_data_v1';
const MOVEMENTS_STORAGE_KEY = 'extintores_manager_movements_v1';
const UNITS_STORAGE_KEY = 'extintores_manager_units_v1';
const SETTINGS_STORAGE_KEY = 'extintores_manager_settings_v1';
const USERS_STORAGE_KEY = 'extintores_manager_users_v1';

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: 'Extintores Manager',
  cnpj: '',
  sesmtDepartment: 'SESMT & Segurança Operacional',
  minTechnicalReservePercent: 15,
  maintenanceAlertWindowDays: 30,
  autoSyncFirestore: true,
};

type ChangeListener<T> = (data: T) => void;

export interface MigrationResult {
  success: boolean;
  createdExtinguishers: number;
  createdMovements: number;
  createdUnits: number;
  createdUsers: number;
  createdSettings: boolean;
  skippedDuplicates: number;
  error?: string;
}

class StorageService {
  private extinguisherListeners: Set<ChangeListener<Extinguisher[]>> = new Set();
  private movementListeners: Set<ChangeListener<Movement[]>> = new Set();
  private unitListeners: Set<ChangeListener<Unit[]>> = new Set();
  private settingsListeners: Set<ChangeListener<SystemSettings>> = new Set();
  private userListeners: Set<ChangeListener<User[]>> = new Set();

  // Live Cloud Firestore state (active ONLY when Firebase is connected & authenticated)
  private firestoreActive = false;
  private firestoreUnsubscribers: Unsubscribe[] = [];
  private firestoreExtinguishers: Extinguisher[] = [];
  private firestoreMovements: Movement[] = [];
  private firestoreUnits: Unit[] = [];
  private firestoreUsers: User[] = [];
  private firestoreSettings: SystemSettings | null = null;
  private activeProjectId = '';

  public isFirestoreConnected(): boolean {
    return this.firestoreActive;
  }

  /**
   * Attaches real-time onSnapshot listeners to all 5 Firestore collections.
   * Never creates fake data and never deletes localStorage data.
   */
  public connectFirestore(firebaseUser: FirebaseAuthUser): void {
    const db = getFirestoreDb();
    const { config } = getActiveFirebaseConfig();
    if (!db || !config?.projectId) {
      this.disconnectFirestore();
      return;
    }

    // Avoid re-attaching if already listening to the same project
    if (this.firestoreActive && this.activeProjectId === config.projectId && this.firestoreUnsubscribers.length > 0) {
      return;
    }

    this.disconnectFirestore();
    this.firestoreActive = true;
    this.activeProjectId = config.projectId;

    let handshakeConfirmed = false;
    const confirmHandshake = () => {
      if (!handshakeConfirmed) {
        handshakeConfirmed = true;
        markFirestoreLiveConnected(config.projectId!);
      }
    };

    const handleSnapshotError = (colName: string, err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Erro no listener em tempo real (${colName}):`, msg);
      markFirestoreError(`Erro em ${colName}: ${msg}`);
    };

    // 1. Extinguishers real-time listener
    const unsubExt = onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS),
      (snapshot) => {
        confirmHandshake();
        const items = snapshot.docs.map((d) => d.data() as Extinguisher);
        items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        this.firestoreExtinguishers = items;
        this.notifyExtinguishers(items);
      },
      (err) => handleSnapshotError('extinguishers', err)
    );

    // 2. Movements real-time listener (sorted by timestamp descending)
    const unsubMov = onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.MOVEMENTS),
      (snapshot) => {
        confirmHandshake();
        const items = snapshot.docs.map((d) => d.data() as Movement);
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.firestoreMovements = items;
        this.notifyMovements(items);
      },
      (err) => handleSnapshotError('movements', err)
    );

    // 3. Units real-time listener
    const unsubUnits = onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.UNITS),
      (snapshot) => {
        confirmHandshake();
        const items = snapshot.docs.map((d) => d.data() as Unit);
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.firestoreUnits = items;
        this.unitListeners.forEach((l) => l(items));
      },
      (err) => handleSnapshotError('units', err)
    );

    // 4. Users real-time listener
    const unsubUsers = onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.USERS),
      (snapshot) => {
        confirmHandshake();
        const items = snapshot.docs.map((d) => d.data() as User);
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.firestoreUsers = items;
        this.notifyUsers(items);
      },
      (err) => handleSnapshotError('users', err)
    );

    // 5. System settings real-time listener
    const unsubSettings = onSnapshot(
      doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global'),
      (docSnap) => {
        confirmHandshake();
        if (docSnap.exists()) {
          const settings = docSnap.data() as SystemSettings;
          this.firestoreSettings = settings;
          this.settingsListeners.forEach((l) => l(settings));
        } else {
          this.firestoreSettings = this.getLocalSettings();
          this.settingsListeners.forEach((l) => l(this.firestoreSettings!));
        }
      },
      (err) => handleSnapshotError('system_settings', err)
    );

    this.firestoreUnsubscribers = [unsubExt, unsubMov, unsubUnits, unsubUsers, unsubSettings];

    // Touch auth uid for auditing clarity
    void firebaseUser.uid;
  }

  public disconnectFirestore(): void {
    this.firestoreUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore unsubscribe cleanup errors
      }
    });
    this.firestoreUnsubscribers = [];
    this.firestoreActive = false;
    this.activeProjectId = '';
    this.firestoreExtinguishers = [];
    this.firestoreMovements = [];
    this.firestoreUnits = [];
    this.firestoreUsers = [];
    this.firestoreSettings = null;

    // Restore local snapshot to UI listeners without deleting localStorage
    this.notifyExtinguishers(this.getExtinguishers());
    this.notifyMovements(this.getMovements());
    this.unitListeners.forEach((l) => l(this.getUnits()));
    this.notifyUsers(this.getUsers());
    this.settingsListeners.forEach((l) => l(this.getSettings()));
  }

  // ---------- LocalStorage non-destructive readers ----------

  public getLocalExtinguishers(): Extinguisher[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(EXTINGUISHERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public getLocalMovements(): Movement[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(MOVEMENTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public getLocalUnits(): Unit[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(UNITS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public getLocalUsers(): User[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public getLocalSettings(): SystemSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? { ...DEFAULT_SETTINGS, ...parsed } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public getLocalSnapshot(): DataSnapshot {
    return {
      extinguishers: this.getLocalExtinguishers(),
      movements: this.getLocalMovements(),
      units: this.getLocalUnits(),
      users: this.getLocalUsers(),
      settings:
        typeof window !== 'undefined' && localStorage.getItem(SETTINGS_STORAGE_KEY)
          ? this.getLocalSettings()
          : null,
    };
  }

  public getFirestoreSnapshot(): DataSnapshot {
    return {
      extinguishers: this.firestoreExtinguishers,
      movements: this.firestoreMovements,
      units: this.firestoreUnits,
      users: this.firestoreUsers,
      settings: this.firestoreSettings,
    };
  }

  // ---------- Unified Getters (Firestore when active, otherwise Local) ----------

  public getExtinguishers(): Extinguisher[] {
    return this.firestoreActive ? this.firestoreExtinguishers : this.getLocalExtinguishers();
  }

  public getMovements(): Movement[] {
    return this.firestoreActive ? this.firestoreMovements : this.getLocalMovements();
  }

  public getUnits(): Unit[] {
    return this.firestoreActive ? this.firestoreUnits : this.getLocalUnits();
  }

  public getUsers(): User[] {
    return this.firestoreActive ? this.firestoreUsers : this.getLocalUsers();
  }

  public getSettings(): SystemSettings {
    if (this.firestoreActive && this.firestoreSettings) {
      return this.firestoreSettings;
    }
    return this.getLocalSettings();
  }

  // ---------- Subscriptions ----------

  public subscribeExtinguishers(listener: ChangeListener<Extinguisher[]>): () => void {
    this.extinguisherListeners.add(listener);
    listener(this.getExtinguishers());
    return () => this.extinguisherListeners.delete(listener);
  }

  public subscribeMovements(listener: ChangeListener<Movement[]>): () => void {
    this.movementListeners.add(listener);
    listener(this.getMovements());
    return () => this.movementListeners.delete(listener);
  }

  public subscribeUnits(listener: ChangeListener<Unit[]>): () => void {
    this.unitListeners.add(listener);
    listener(this.getUnits());
    return () => this.unitListeners.delete(listener);
  }

  public subscribeSettings(listener: ChangeListener<SystemSettings>): () => void {
    this.settingsListeners.add(listener);
    listener(this.getSettings());
    return () => this.settingsListeners.delete(listener);
  }

  public subscribeUsers(listener: ChangeListener<User[]>): () => void {
    this.userListeners.add(listener);
    listener(this.getUsers());
    return () => this.userListeners.delete(listener);
  }

  private notifyExtinguishers(data: Extinguisher[]): void {
    this.extinguisherListeners.forEach((l) => l(data));
  }

  private notifyMovements(data: Movement[]): void {
    this.movementListeners.forEach((l) => l(data));
  }

  private notifyUsers(data: User[]): void {
    this.userListeners.forEach((l) => l(data));
  }

  // ---------- Settings ----------

  public async updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = this.getSettings();
    const updated: SystemSettings = { ...current, ...newSettings };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (db) {
        try {
          await setDoc(
            doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global'),
            stripUndefinedFields(updated as unknown as Record<string, unknown>)
          );
          return updated;
        } catch (err) {
          console.error('Erro ao salvar configurações no Firestore:', err);
          throw err;
        }
      }
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    this.settingsListeners.forEach((l) => l(updated));
    return updated;
  }

  // ---------- Units ----------

  public async addUnit(
    unit: Omit<Unit, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getUnits();
    const cleanCode = unit.code.trim().toUpperCase();
    if (list.some((u) => u.code.toUpperCase() === cleanCode)) {
      return { success: false, error: `Já existe uma unidade com a sigla/código "${unit.code}".` };
    }

    const newUnit: Unit = {
      ...unit,
      id: `unit-${Date.now()}`,
      code: cleanCode,
      createdAt: new Date().toISOString(),
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.UNITS, newUnit.id),
          stripUndefinedFields(newUnit as unknown as Record<string, unknown>)
        );
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao cadastrar unidade no Firestore.'),
        };
      }
    }

    const updated = [...list, newUnit];
    localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(updated));
    this.unitListeners.forEach((l) => l(updated));
    return { success: true };
  }

  public async updateUnit(
    id: string,
    updates: Partial<Unit>
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getUnits();
    const index = list.findIndex((u) => u.id === id);
    if (index === -1) return { success: false, error: 'Unidade não encontrada.' };

    const updatedUnit: Unit = { ...list[index], ...updates, id: list[index].id };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.UNITS, id),
          stripUndefinedFields(updatedUnit as unknown as Record<string, unknown>)
        );
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao atualizar unidade no Firestore.'),
        };
      }
    }

    list[index] = updatedUnit;
    localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(list));
    this.unitListeners.forEach((l) => l(list));
    return { success: true };
  }

  public async deleteUnit(id: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getUnits();
    if (list.length <= 1) {
      return { success: false, error: 'O sistema deve possuir ao menos uma unidade cadastrada.' };
    }

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.UNITS, id));
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao excluir unidade no Firestore.'),
        };
      }
    }

    const updated = list.filter((u) => u.id !== id);
    localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(updated));
    this.unitListeners.forEach((l) => l(updated));
    return { success: true };
  }

  // ---------- Users & RBAC ----------

  public async addUser(
    userData: {
      name: string;
      email: string;
      password?: string;
      role: UserRole;
      department: string;
      authorizedUnitIds?: string[];
      avatarUrl?: string;
    },
    adminUser: User
  ): Promise<{ success: boolean; error?: string; user?: User; notice?: string }> {
    if (adminUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Apenas Administradores têm permissão para cadastrar novos usuários.',
      };
    }

    const emailClean = userData.email.trim().toLowerCase();
    const users = this.getUsers();

    if (users.some((u) => u.email.toLowerCase() === emailClean)) {
      return {
        success: false,
        error: `Já existe um usuário cadastrado com o e-mail "${userData.email}".`,
      };
    }

    if (!userData.name.trim()) {
      return { success: false, error: 'O nome completo do usuário é obrigatório.' };
    }

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };

      const newUser: User = {
        id: `usr-${Date.now()}`,
        authProvider: 'password',
        name: userData.name.trim(),
        email: emailClean,
        role: userData.role,
        status: 'ATIVO',
        department: userData.department.trim() || 'SESMT & Operações',
        authorizedUnitIds:
          userData.authorizedUnitIds && userData.authorizedUnitIds.length > 0
            ? userData.authorizedUnitIds
            : ['ALL'],
        avatarUrl: userData.avatarUrl,
        createdAt: new Date().toISOString(),
      };

      try {
        const batch = writeBatch(db);
        // Save profile in users collection AND pre-authorization invite keyed by email
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USERS, newUser.id),
          stripUndefinedFields(newUser as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USER_INVITES, emailClean),
          stripUndefinedFields(newUser as unknown as Record<string, unknown>)
        );
        await batch.commit();

        return {
          success: true,
          user: newUser,
          notice:
            'Perfil salvo no Firestore e pré-autorizado! Para ativar a senha no Firebase Auth sem credenciais administrativas no app, o colaborador pode concluir o "Primeiro Acesso" na tela de login com este e-mail ou você pode criar o login no Firebase Console > Authentication.',
        };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao cadastrar usuário no Firestore.'),
        };
      }
    }

    // Local mode fallback (no plain text passwords stored)
    const passwordPlain = userData.password || '';
    if (passwordPlain.length < 6) {
      return { success: false, error: 'A senha inicial deve possuir no mínimo 6 caracteres.' };
    }

    let passwordHash = '';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(passwordPlain);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      passwordHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      authProvider: 'local',
      name: userData.name.trim(),
      email: emailClean,
      role: userData.role,
      status: 'ATIVO',
      department: userData.department.trim() || 'SESMT & Operações',
      authorizedUnitIds:
        userData.authorizedUnitIds && userData.authorizedUnitIds.length > 0
          ? userData.authorizedUnitIds
          : ['ALL'],
      avatarUrl: userData.avatarUrl,
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    const updated = [...users, newUser];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    this.notifyUsers(updated);
    return { success: true, user: newUser };
  }

  public async updateUser(
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      department?: string;
      authorizedUnitIds?: string[];
      status?: UserStatus;
    },
    adminUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role !== 'ADMIN') {
      return { success: false, error: 'Apenas Administradores têm permissão para editar usuários.' };
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const targetUser = users[index];

    if (
      targetUser.role === 'ADMIN' &&
      ((updates.role && updates.role !== 'ADMIN') || updates.status === 'BLOQUEADO')
    ) {
      const otherActiveAdmins = users.filter(
        (u) => u.id !== userId && u.role === 'ADMIN' && u.status === 'ATIVO'
      );
      if (otherActiveAdmins.length === 0) {
        return {
          success: false,
          error:
            'Operação bloqueada: Não é permitido desativar ou rebaixar o único Administrador ativo do sistema.',
        };
      }
    }

    if (userId === adminUser.id && updates.status === 'BLOQUEADO') {
      return {
        success: false,
        error: 'Você não pode bloquear a sua própria conta de Administrador em uso.',
      };
    }

    const updatedUser: User = {
      ...targetUser,
      ...updates,
      id: targetUser.id,
      email: targetUser.email,
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        const { passwordHash: _ignored, ...safeUser } = updatedUser;
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USERS, userId),
          stripUndefinedFields(safeUser as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USER_INVITES, targetUser.email.toLowerCase()),
          stripUndefinedFields(safeUser as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao atualizar usuário no Firestore.'),
        };
      }
    }

    users[index] = updatedUser;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    this.notifyUsers(users);
    return { success: true };
  }

  public async toggleUserStatus(
    userId: string,
    adminUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Apenas Administradores podem suspender ou reativar usuários.',
      };
    }

    if (userId === adminUser.id) {
      return {
        success: false,
        error: 'Você não pode suspender ou bloquear a sua própria conta ativa.',
      };
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const target = users[index];
    const newStatus: UserStatus = target.status === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO';

    if (target.role === 'ADMIN' && newStatus === 'BLOQUEADO') {
      const otherActiveAdmins = users.filter(
        (u) => u.id !== userId && u.role === 'ADMIN' && u.status === 'ATIVO'
      );
      if (otherActiveAdmins.length === 0) {
        return {
          success: false,
          error: 'Não é permitido suspender o único Administrador ativo do sistema.',
        };
      }
    }

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        const updatedUser = { ...target, status: newStatus };
        const { passwordHash: _ignored, ...safeUser } = updatedUser;
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USERS, userId),
          stripUndefinedFields(safeUser as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.USER_INVITES, target.email.toLowerCase()),
          stripUndefinedFields(safeUser as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao alterar status do usuário no Firestore.'),
        };
      }
    }

    users[index] = { ...target, status: newStatus };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    this.notifyUsers(users);
    return { success: true };
  }

  public async deleteUser(
    userId: string,
    adminUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Apenas Administradores possuem autorização para excluir usuários.',
      };
    }

    if (userId === adminUser.id) {
      return {
        success: false,
        error: 'Operação proibida: Você não pode excluir a sua própria conta de acesso.',
      };
    }

    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    if (target.role === 'ADMIN') {
      const otherAdmins = users.filter((u) => u.id !== userId && u.role === 'ADMIN');
      if (otherAdmins.length === 0) {
        return {
          success: false,
          error: 'Não é permitido excluir o único Administrador cadastrado no sistema.',
        };
      }
    }

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, FIRESTORE_COLLECTIONS.USERS, userId));
        batch.delete(doc(db, FIRESTORE_COLLECTIONS.USER_INVITES, target.email.toLowerCase()));
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao excluir usuário no Firestore.'),
        };
      }
    }

    const updated = users.filter((u) => u.id !== userId);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    this.notifyUsers(updated);
    return { success: true };
  }

  public async resetUserPassword(
    userId: string,
    newPasswordPlain: string,
    adminUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role !== 'ADMIN') {
      return { success: false, error: 'Apenas Administradores podem redefinir senhas.' };
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    if (this.firestoreActive) {
      // In Firebase Auth, client SDK cannot overwrite another user's password directly;
      // use official Firebase Auth password reset email instead.
      return this.requestPasswordReset(users[index].email);
    }

    if (newPasswordPlain.length < 6) {
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    let passwordHash = '';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(newPasswordPlain);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      passwordHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    users[index] = { ...users[index], passwordHash };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    this.notifyUsers(users);
    return { success: true };
  }

  public async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const auth = getFirebaseAuth();

    if (this.firestoreActive && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return {
          success: true,
          message: `E-mail oficial de redefinição de senha enviado pelo Firebase Authentication para ${cleanEmail}.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `Não foi possível enviar o e-mail pelo Firebase Auth: ${msg}`,
        };
      }
    }

    return {
      success: false,
      error:
        'Conecte o Firebase Authentication para disparar e-mails reais de redefinição de senha.',
    };
  }

  // ---------- Extinguishers ----------

  public async addExtinguisher(
    newExt: Extinguisher,
    user: User
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getExtinguishers();

    const cleanId = newExt.id.trim().toUpperCase();
    if (list.some((e) => e.id.toUpperCase() === cleanId)) {
      return {
        success: false,
        error: `Já existe um extintor cadastrado com a identificação "${newExt.id}".`,
      };
    }

    const cleanPat = newExt.patrimonyNumber.trim().toUpperCase();
    if (list.some((e) => e.patrimonyNumber.toUpperCase() === cleanPat)) {
      return {
        success: false,
        error: `Já existe um extintor com o patrimônio "${newExt.patrimonyNumber}".`,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const itemToSave: Extinguisher = {
      ...newExt,
      id: cleanId,
      patrimonyNumber: cleanPat,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const initialMovement: Movement = {
      id: `MOV-${Date.now()}`,
      date: nowIso.split('T')[0],
      time: now.toTimeString().slice(0, 5),
      timestamp: now.getTime(),
      extinguisherId: itemToSave.id,
      extinguisherPatrimony: itemToSave.patrimonyNumber,
      extinguisherType: itemToSave.type,
      movementType: itemToSave.locationArea === 'ESTOQUE' ? 'ENTRADA_ESTOQUE' : 'SAIDA_CAMPO',
      originLocation: 'Cadastro Inicial no Sistema',
      destinationLocation: itemToSave.locationDetails,
      responsibleUserId: user.id,
      responsibleUserName: user.name,
      notes: `Cadastro inicial do extintor (${itemToSave.capacity} - ${itemToSave.manufacturer}). Condição: ${itemToSave.operationalCondition}`,
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, itemToSave.id),
          stripUndefinedFields(itemToSave as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.MOVEMENTS, initialMovement.id),
          stripUndefinedFields(initialMovement as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao cadastrar extintor no Firestore.'),
        };
      }
    }

    const updatedList = [itemToSave, ...list];
    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(updatedList));
    this.notifyExtinguishers(updatedList);

    const movements = this.getMovements();
    const updatedMovements = [initialMovement, ...movements];
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(updatedMovements));
    this.notifyMovements(updatedMovements);
    return { success: true };
  }

  public async updateExtinguisher(
    id: string,
    updates: Partial<Extinguisher>,
    user: User,
    changeNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getExtinguishers();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) {
      return { success: false, error: 'Extintor não encontrado para atualização.' };
    }

    if (updates.patrimonyNumber) {
      const cleanPat = updates.patrimonyNumber.trim().toUpperCase();
      const duplicate = list.find(
        (e) => e.id !== id && e.patrimonyNumber.toUpperCase() === cleanPat
      );
      if (duplicate) {
        return {
          success: false,
          error: `Número de patrimônio "${updates.patrimonyNumber}" já em uso por outro equipamento.`,
        };
      }
      updates.patrimonyNumber = cleanPat;
    }

    const previous = list[index];
    const now = new Date();
    const updatedItem: Extinguisher = {
      ...previous,
      ...updates,
      id: previous.id,
      updatedAt: now.toISOString(),
    };

    const auditMovement: Movement | null = changeNote
      ? {
          id: `MOV-${Date.now()}`,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().slice(0, 5),
          timestamp: now.getTime(),
          extinguisherId: updatedItem.id,
          extinguisherPatrimony: updatedItem.patrimonyNumber,
          extinguisherType: updatedItem.type,
          movementType: 'RETORNO_ESTOQUE',
          originLocation: previous.locationDetails,
          destinationLocation: updatedItem.locationDetails,
          responsibleUserId: user.id,
          responsibleUserName: user.name,
          notes: `Atualização cadastral por ${user.name}: ${changeNote}`,
        }
      : null;

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, updatedItem.id),
          stripUndefinedFields(updatedItem as unknown as Record<string, unknown>)
        );
        if (auditMovement) {
          batch.set(
            doc(db, FIRESTORE_COLLECTIONS.MOVEMENTS, auditMovement.id),
            stripUndefinedFields(auditMovement as unknown as Record<string, unknown>)
          );
        }
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao atualizar extintor no Firestore.'),
        };
      }
    }

    list[index] = updatedItem;
    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(list));
    this.notifyExtinguishers(list);

    if (auditMovement) {
      const movements = this.getMovements();
      const updatedMovements = [auditMovement, ...movements];
      localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(updatedMovements));
      this.notifyMovements(updatedMovements);
    }

    return { success: true };
  }

  public getExtinguisherMovementsCount(extId: string): number {
    return this.getMovements().filter((m) => m.extinguisherId === extId).length;
  }

  public async archiveExtinguisher(
    id: string,
    user: User,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getExtinguishers();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) {
      return { success: false, error: 'Extintor não encontrado.' };
    }

    const ext = list[index];
    const now = new Date();
    const archivedItem: Extinguisher = {
      ...ext,
      isArchived: true,
      archivedAt: now.toISOString(),
      archivedReason: reason.trim(),
      archivedBy: user.name,
      updatedAt: now.toISOString(),
    };

    const auditMovement: Movement = {
      id: `MOV-${Date.now()}`,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      timestamp: now.getTime(),
      extinguisherId: ext.id,
      extinguisherPatrimony: ext.patrimonyNumber,
      extinguisherType: ext.type,
      movementType: 'INTERDICAO',
      originLocation: ext.locationDetails,
      destinationLocation: 'Arquivo Patrimonial (Desativado)',
      responsibleUserId: user.id,
      responsibleUserName: user.name,
      notes: `Arquivamento/Desativação de extintor por ${user.name}. Motivo: ${reason}`,
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, ext.id),
          stripUndefinedFields(archivedItem as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.MOVEMENTS, auditMovement.id),
          stripUndefinedFields(auditMovement as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao arquivar extintor no Firestore.'),
        };
      }
    }

    list[index] = archivedItem;
    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(list));
    this.notifyExtinguishers(list);

    const movements = this.getMovements();
    const updatedMovements = [auditMovement, ...movements];
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(updatedMovements));
    this.notifyMovements(updatedMovements);
    return { success: true };
  }

  public async unarchiveExtinguisher(
    id: string,
    user: User
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getExtinguishers();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) {
      return { success: false, error: 'Extintor não encontrado.' };
    }

    const ext = list[index];
    const now = new Date();
    const restoredItem: Extinguisher = {
      ...ext,
      isArchived: false,
      archivedAt: undefined,
      archivedReason: undefined,
      archivedBy: undefined,
      updatedAt: now.toISOString(),
    };

    const auditMovement: Movement = {
      id: `MOV-${Date.now()}`,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      timestamp: now.getTime(),
      extinguisherId: ext.id,
      extinguisherPatrimony: ext.patrimonyNumber,
      extinguisherType: ext.type,
      movementType: 'ENTRADA_ESTOQUE',
      originLocation: 'Arquivo Patrimonial',
      destinationLocation: ext.locationDetails,
      responsibleUserId: user.id,
      responsibleUserName: user.name,
      notes: `Reativação de extintor arquivado realizada por ${user.name}.`,
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, ext.id),
          stripUndefinedFields(restoredItem as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.MOVEMENTS, auditMovement.id),
          stripUndefinedFields(auditMovement as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao reativar extintor no Firestore.'),
        };
      }
    }

    list[index] = restoredItem;
    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(list));
    this.notifyExtinguishers(list);

    const movements = this.getMovements();
    const updatedMovements = [auditMovement, ...movements];
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(updatedMovements));
    this.notifyMovements(updatedMovements);
    return { success: true };
  }

  public async deleteExtinguisher(
    id: string,
    user: User,
    _reason: string,
    forcePermanent = false
  ): Promise<{ success: boolean; error?: string; hasHistory?: boolean; movementCount?: number }> {
    const list = this.getExtinguishers();
    const item = list.find((e) => e.id === id);
    if (!item) {
      return { success: false, error: 'Extintor não encontrado.' };
    }

    if (user.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Apenas Administradores possuem autorização para excluir extintores.',
      };
    }

    const movements = this.getMovements();
    const extMovements = movements.filter((m) => m.extinguisherId === id);

    if (extMovements.length > 0 && !forcePermanent) {
      return {
        success: false,
        hasHistory: true,
        movementCount: extMovements.length,
        error: `O extintor ${item.id} possui ${extMovements.length} registro(s) de movimentação no histórico. Em conformidade com a ABNT NBR 12962, utilize a opção "Arquivar / Desativar".`,
      };
    }

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, id));
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(err, 'Erro ao excluir extintor no Firestore.'),
        };
      }
    }

    const filtered = list.filter((e) => e.id !== id);
    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(filtered));
    this.notifyExtinguishers(filtered);
    return { success: true };
  }

  // ---------- Movements ----------

  public async registerMovement(params: {
    extinguisherId: string;
    movementType: MovementType;
    destinationLocation: string;
    responsibleUser: User;
    notes: string;
    incidentDescription?: string;
    date?: string;
    time?: string;
    rechargeNextMaintenanceDate?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const extinguishers = [...this.getExtinguishers()];
    const extIndex = extinguishers.findIndex((e) => e.id === params.extinguisherId);
    if (extIndex === -1) {
      return { success: false, error: 'Extintor selecionado não foi encontrado no sistema.' };
    }

    const ext = extinguishers[extIndex];
    const now = new Date();
    const dateStr = params.date || now.toISOString().split('T')[0];
    const timeStr = params.time || now.toTimeString().slice(0, 5);

    const originLocation = ext.locationDetails;
    let newLocationArea = ext.locationArea;
    let newCondition = ext.operationalCondition;
    let newLocationDetails = params.destinationLocation.trim() || originLocation;
    let newLastRechargeDate = ext.lastRechargeDate;
    let newNextMaintenanceDate = ext.nextMaintenanceDate;

    switch (params.movementType) {
      case 'ENTRADA_ESTOQUE':
      case 'RETORNO_ESTOQUE':
        newLocationArea = 'ESTOQUE';
        if (!params.destinationLocation.trim()) {
          newLocationDetails = 'Almoxarifado Central - Prateleira Reserva';
        }
        break;

      case 'SAIDA_CAMPO':
        newLocationArea = 'CAMPO';
        newCondition = 'OPERACIONAL';
        break;

      case 'ENVIO_RECARGA':
        newCondition = 'EM_RECARGA';
        newLocationArea = 'CAMPO';
        if (!params.destinationLocation.trim()) {
          newLocationDetails = 'Empresa Prestadora de Serviços de Recarga';
        }
        break;

      case 'RETORNO_RECARGA':
        newCondition = 'OPERACIONAL';
        newLocationArea = 'ESTOQUE';
        newLastRechargeDate = dateStr;
        if (params.rechargeNextMaintenanceDate) {
          newNextMaintenanceDate = params.rechargeNextMaintenanceDate;
        } else {
          const next = new Date(dateStr + 'T00:00:00');
          next.setFullYear(next.getFullYear() + 1);
          newNextMaintenanceDate = next.toISOString().split('T')[0];
        }
        if (!params.destinationLocation.trim()) {
          newLocationDetails = 'Almoxarifado Central - Prateleira Aprovados';
        }
        break;

      case 'UTILIZACAO':
        newCondition = 'VAZIO';
        break;

      case 'INTERDICAO':
        newCondition = 'INTERDITADO';
        break;
    }

    const movement: Movement = {
      id: `MOV-${Date.now()}`,
      date: dateStr,
      time: timeStr,
      timestamp: now.getTime(),
      extinguisherId: ext.id,
      extinguisherPatrimony: ext.patrimonyNumber,
      extinguisherType: ext.type,
      movementType: params.movementType,
      originLocation,
      destinationLocation: newLocationDetails,
      responsibleUserId: params.responsibleUser.id,
      responsibleUserName: params.responsibleUser.name,
      incidentDescription: params.incidentDescription,
      notes: params.notes,
    };

    const updatedExtinguisher: Extinguisher = {
      ...ext,
      locationArea: newLocationArea,
      locationDetails: newLocationDetails,
      operationalCondition: newCondition,
      lastRechargeDate: newLastRechargeDate,
      nextMaintenanceDate: newNextMaintenanceDate,
      hasPressureGaugeNormal: newCondition === 'OPERACIONAL',
      updatedAt: now.toISOString(),
    };

    if (this.firestoreActive) {
      const db = getFirestoreDb();
      if (!db) return { success: false, error: 'Firestore não inicializado.' };
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS, ext.id),
          stripUndefinedFields(updatedExtinguisher as unknown as Record<string, unknown>)
        );
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.MOVEMENTS, movement.id),
          stripUndefinedFields(movement as unknown as Record<string, unknown>)
        );
        await batch.commit();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: this.formatFirestoreErrorMessage(
            err,
            'Erro ao registrar movimentação no Firestore.'
          ),
        };
      }
    }

    extinguishers[extIndex] = updatedExtinguisher;
    const movements = this.getMovements();
    const updatedMovements = [movement, ...movements];

    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(extinguishers));
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(updatedMovements));
    this.notifyExtinguishers(extinguishers);
    this.notifyMovements(updatedMovements);
    return { success: true };
  }

  // ---------- Backup Export & Deduplicated Migration / Import ----------

  public exportData(): string {
    const safeUsers = this.getUsers().map(({ passwordHash: _ignored, ...rest }) => rest);
    return JSON.stringify(
      {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        source: this.firestoreActive ? 'firestore' : 'localStorage',
        extinguishers: this.getExtinguishers(),
        movements: this.getMovements(),
        units: this.getUnits(),
        users: safeUsers,
        settings: this.getSettings(),
      },
      null,
      2
    );
  }

  /**
   * Analyzes localStorage vs current Firestore state (dry-run) without modifying anything.
   */
  public async analyzeLocalToFirestoreMigration(): Promise<{
    success: boolean;
    plan?: MigrationPlan;
    error?: string;
  }> {
    const db = getFirestoreDb();
    if (!this.firestoreActive || !db) {
      return {
        success: false,
        error: 'Conecte-se e autentique-se no Firebase antes de analisar a migração para a nuvem.',
      };
    }

    try {
      const [extSnap, movSnap, unitSnap, userSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.MOVEMENTS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.UNITS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.USERS)),
        getDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global')),
      ]);

      const remoteSnapshot: DataSnapshot = {
        extinguishers: extSnap.docs.map((d) => d.data() as Extinguisher),
        movements: movSnap.docs.map((d) => d.data() as Movement),
        units: unitSnap.docs.map((d) => d.data() as Unit),
        users: userSnap.docs.map((d) => d.data() as User),
        settings: settingsSnap.exists() ? (settingsSnap.data() as SystemSettings) : null,
      };

      const localSnapshot = this.getLocalSnapshot();
      const plan = buildIdempotentMigrationPlan(localSnapshot, remoteSnapshot);
      return { success: true, plan };
    } catch (err) {
      return {
        success: false,
        error: this.formatFirestoreErrorMessage(
          err,
          'Erro ao consultar dados existentes no Firestore.'
        ),
      };
    }
  }

  /**
   * Executes an idempotent migration from a DataSnapshot (localStorage or JSON backup)
   * into Cloud Firestore. NEVER deletes localStorage data and NEVER duplicates records.
   */
  public async migrateSnapshotToFirestore(source: DataSnapshot): Promise<MigrationResult> {
    const db = getFirestoreDb();
    if (!this.firestoreActive || !db) {
      return {
        success: false,
        createdExtinguishers: 0,
        createdMovements: 0,
        createdUnits: 0,
        createdUsers: 0,
        createdSettings: false,
        skippedDuplicates: 0,
        error: 'Conecte-se e autentique-se no Firebase para migrar os dados para o Firestore.',
      };
    }

    try {
      const [extSnap, movSnap, unitSnap, userSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, FIRESTORE_COLLECTIONS.EXTINGUISHERS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.MOVEMENTS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.UNITS)),
        getDocs(collection(db, FIRESTORE_COLLECTIONS.USERS)),
        getDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'global')),
      ]);

      const remoteSnapshot: DataSnapshot = {
        extinguishers: extSnap.docs.map((d) => d.data() as Extinguisher),
        movements: movSnap.docs.map((d) => d.data() as Movement),
        units: unitSnap.docs.map((d) => d.data() as Unit),
        users: userSnap.docs.map((d) => d.data() as User),
        settings: settingsSnap.exists() ? (settingsSnap.data() as SystemSettings) : null,
      };

      const plan = buildIdempotentMigrationPlan(source, remoteSnapshot);

      interface PendingWrite {
        collectionName: string;
        docId: string;
        data: Record<string, unknown>;
      }

      const writes: PendingWrite[] = [];

      for (const ext of plan.extinguishers.toCreate) {
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.EXTINGUISHERS,
          docId: ext.id,
          data: stripUndefinedFields(ext as unknown as Record<string, unknown>),
        });
      }

      for (const mov of plan.movements.toCreate) {
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.MOVEMENTS,
          docId: mov.id,
          data: stripUndefinedFields(mov as unknown as Record<string, unknown>),
        });
      }

      for (const unit of plan.units.toCreate) {
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.UNITS,
          docId: unit.id,
          data: stripUndefinedFields(unit as unknown as Record<string, unknown>),
        });
      }

      for (const user of plan.users.toCreate) {
        const cleanUser = stripUndefinedFields(user as unknown as Record<string, unknown>);
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.USERS,
          docId: user.id,
          data: cleanUser,
        });
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.USER_INVITES,
          docId: user.email.trim().toLowerCase(),
          data: cleanUser,
        });
      }

      if (plan.shouldWriteSettings && source.settings) {
        writes.push({
          collectionName: FIRESTORE_COLLECTIONS.SETTINGS,
          docId: 'global',
          data: stripUndefinedFields(source.settings as unknown as Record<string, unknown>),
        });
      }

      const chunks = chunkItems(writes, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(doc(db, item.collectionName, item.docId), item.data);
        }
        await batch.commit();
      }

      return {
        success: true,
        createdExtinguishers: plan.extinguishers.toCreate.length,
        createdMovements: plan.movements.toCreate.length,
        createdUnits: plan.units.toCreate.length,
        createdUsers: plan.users.toCreate.length,
        createdSettings: plan.shouldWriteSettings,
        skippedDuplicates: plan.totalSkipped,
      };
    } catch (err) {
      return {
        success: false,
        createdExtinguishers: 0,
        createdMovements: 0,
        createdUnits: 0,
        createdUsers: 0,
        createdSettings: false,
        skippedDuplicates: 0,
        error: this.formatFirestoreErrorMessage(
          err,
          'Falha ao gravar lote de migração no Firestore.'
        ),
      };
    }
  }

  /**
   * Imports a JSON backup safely without duplicating existing records.
   * When Firestore is active, migrates directly into Firestore.
   * When local, merges into localStorage without overwriting or duplicating existing IDs.
   */
  public async importData(jsonString: string): Promise<{
    success: boolean;
    count?: number;
    skipped?: number;
    target?: 'firestore' | 'local';
    error?: string;
  }> {
    const parsed = parseBackupJson(jsonString);
    if (!parsed.valid || !parsed.payload) {
      return { success: false, error: parsed.error || 'Arquivo JSON inválido.' };
    }

    const sourceSnapshot: DataSnapshot = {
      extinguishers: parsed.payload.extinguishers,
      movements: parsed.payload.movements,
      units: parsed.payload.units || [],
      users: parsed.payload.users || [],
      settings: parsed.payload.settings || null,
    };

    if (this.firestoreActive) {
      const res = await this.migrateSnapshotToFirestore(sourceSnapshot);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      return {
        success: true,
        count: res.createdExtinguishers,
        skipped: res.skippedDuplicates,
        target: 'firestore',
      };
    }

    // Local merge without duplicating existing records
    const currentLocal = this.getLocalSnapshot();
    const plan = buildIdempotentMigrationPlan(sourceSnapshot, currentLocal);

    const mergedExt = [...plan.extinguishers.toCreate, ...currentLocal.extinguishers];
    const mergedMov = [...plan.movements.toCreate, ...currentLocal.movements];
    const mergedUnits = [...currentLocal.units, ...plan.units.toCreate];
    const mergedUsers = [...currentLocal.users, ...plan.users.toCreate];

    localStorage.setItem(EXTINGUISHERS_STORAGE_KEY, JSON.stringify(mergedExt));
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(mergedMov));
    if (plan.units.toCreate.length > 0) {
      localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(mergedUnits));
      this.unitListeners.forEach((l) => l(mergedUnits));
    }
    if (plan.users.toCreate.length > 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mergedUsers));
      this.notifyUsers(mergedUsers);
    }
    if (plan.shouldWriteSettings && sourceSnapshot.settings) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sourceSnapshot.settings));
      this.settingsListeners.forEach((l) => l(sourceSnapshot.settings!));
    }

    this.notifyExtinguishers(mergedExt);
    this.notifyMovements(mergedMov);

    return {
      success: true,
      count: plan.extinguishers.toCreate.length,
      skipped: plan.totalSkipped,
      target: 'local',
    };
  }

  private formatFirestoreErrorMessage(err: unknown, fallback: string): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
      return 'Permissão negada pelo Firestore (verifique o perfil RBAC do usuário e as regras em firestore.rules).';
    }
    if (raw.includes('unavailable') || raw.includes('offline')) {
      return 'Sem comunicação com o servidor Firestore no momento.';
    }
    return `${fallback} (${raw})`;
  }
}

export const storageService = new StorageService();
