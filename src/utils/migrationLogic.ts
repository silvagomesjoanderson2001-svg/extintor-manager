import {
  Extinguisher,
  Movement,
  Unit,
  User,
  UserRole,
  SystemSettings,
} from '../types/extinguisher';

export interface DataSnapshot {
  extinguishers: Extinguisher[];
  movements: Movement[];
  units: Unit[];
  users: User[];
  settings?: SystemSettings | null;
}

export interface CollectionMigrationPlan<T> {
  toCreate: T[];
  skippedDuplicates: T[];
}

export interface MigrationPlan {
  extinguishers: CollectionMigrationPlan<Extinguisher>;
  movements: CollectionMigrationPlan<Movement>;
  units: CollectionMigrationPlan<Unit>;
  users: CollectionMigrationPlan<User>;
  shouldWriteSettings: boolean;
  totalToCreate: number;
  totalSkipped: number;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  extinguishers: Extinguisher[];
  movements: Movement[];
  units?: Unit[];
  users?: User[];
  settings?: SystemSettings;
}

export interface RolePermissions {
  isReadOnly: boolean;
  canManageUsers: boolean;
  canCreateExtinguisher: boolean;
  canEditExtinguisher: boolean;
  canDeleteExtinguisher: boolean;
  canRegisterMovement: boolean;
  canInterdict: boolean;
  canManageUnits: boolean;
  canManageSettings: boolean;
}

/**
 * Resolves exact RBAC permissions for a given role and account status.
 * Blocked users lose all mutation and admin capabilities.
 */
export function resolveRolePermissions(role: UserRole, status: string): RolePermissions {
  const isBlocked = status === 'BLOQUEADO';
  if (isBlocked) {
    return {
      isReadOnly: true,
      canManageUsers: false,
      canCreateExtinguisher: false,
      canEditExtinguisher: false,
      canDeleteExtinguisher: false,
      canRegisterMovement: false,
      canInterdict: false,
      canManageUnits: false,
      canManageSettings: false,
    };
  }

  const isReadOnly = role === 'CONSULTA' || role === 'INSPETOR';
  return {
    isReadOnly,
    canManageUsers: role === 'ADMIN',
    canCreateExtinguisher:
      role === 'ADMIN' || role === 'SUPERVISOR' || role === 'OPERADOR' || role === 'TST' || role === 'ALMOXARIFE',
    canEditExtinguisher: role === 'ADMIN' || role === 'SUPERVISOR' || role === 'TST',
    canDeleteExtinguisher: role === 'ADMIN',
    canRegisterMovement:
      role === 'ADMIN' || role === 'SUPERVISOR' || role === 'OPERADOR' || role === 'TST' || role === 'ALMOXARIFE',
    canInterdict: role === 'ADMIN' || role === 'SUPERVISOR' || role === 'TST',
    canManageUnits: role === 'ADMIN' || role === 'SUPERVISOR',
    canManageSettings: role === 'ADMIN',
  };
}

/**
 * Builds an idempotent migration plan comparing source data against target (e.g. Firestore) records.
 * Prevents duplicate records by matching IDs as well as natural unique keys (patrimonyNumber, unit code, user email).
 */
export function buildIdempotentMigrationPlan(
  source: DataSnapshot,
  existingTarget: DataSnapshot
): MigrationPlan {
  const existingExtIds = new Set(existingTarget.extinguishers.map((e) => e.id.trim().toUpperCase()));
  const existingPatrimonies = new Set(
    existingTarget.extinguishers.map((e) => e.patrimonyNumber.trim().toUpperCase())
  );

  const extToCreate: Extinguisher[] = [];
  const extSkipped: Extinguisher[] = [];
  const seenSourceExtIds = new Set<string>();
  const seenSourcePatrimonies = new Set<string>();

  for (const ext of source.extinguishers) {
    const idKey = ext.id.trim().toUpperCase();
    const patKey = ext.patrimonyNumber.trim().toUpperCase();
    if (
      existingExtIds.has(idKey) ||
      existingPatrimonies.has(patKey) ||
      seenSourceExtIds.has(idKey) ||
      seenSourcePatrimonies.has(patKey)
    ) {
      extSkipped.push(ext);
    } else {
      seenSourceExtIds.add(idKey);
      seenSourcePatrimonies.add(patKey);
      extToCreate.push(ext);
    }
  }

  const existingMovIds = new Set(existingTarget.movements.map((m) => m.id.trim()));
  const movToCreate: Movement[] = [];
  const movSkipped: Movement[] = [];
  const seenSourceMovIds = new Set<string>();

  for (const mov of source.movements) {
    const idKey = mov.id.trim();
    if (existingMovIds.has(idKey) || seenSourceMovIds.has(idKey)) {
      movSkipped.push(mov);
    } else {
      seenSourceMovIds.add(idKey);
      movToCreate.push(mov);
    }
  }

  const existingUnitIds = new Set(existingTarget.units.map((u) => u.id.trim()));
  const existingUnitCodes = new Set(existingTarget.units.map((u) => u.code.trim().toUpperCase()));
  const unitToCreate: Unit[] = [];
  const unitSkipped: Unit[] = [];
  const seenSourceUnitIds = new Set<string>();
  const seenSourceUnitCodes = new Set<string>();

  for (const unit of source.units) {
    const idKey = unit.id.trim();
    const codeKey = unit.code.trim().toUpperCase();
    if (
      existingUnitIds.has(idKey) ||
      existingUnitCodes.has(codeKey) ||
      seenSourceUnitIds.has(idKey) ||
      seenSourceUnitCodes.has(codeKey)
    ) {
      unitSkipped.push(unit);
    } else {
      seenSourceUnitIds.add(idKey);
      seenSourceUnitCodes.add(codeKey);
      unitToCreate.push(unit);
    }
  }

  const existingUserIds = new Set(existingTarget.users.map((u) => u.id.trim()));
  const existingUserEmails = new Set(existingTarget.users.map((u) => u.email.trim().toLowerCase()));
  const userToCreate: User[] = [];
  const userSkipped: User[] = [];
  const seenSourceUserIds = new Set<string>();
  const seenSourceEmails = new Set<string>();

  for (const user of source.users) {
    const idKey = user.id.trim();
    const emailKey = user.email.trim().toLowerCase();
    if (
      existingUserIds.has(idKey) ||
      existingUserEmails.has(emailKey) ||
      seenSourceUserIds.has(idKey) ||
      seenSourceEmails.has(emailKey)
    ) {
      userSkipped.push(user);
    } else {
      seenSourceUserIds.add(idKey);
      seenSourceEmails.add(emailKey);
      // Never leak plaintext password or unsafe fields
      const { passwordHash: _ignoredHash, ...rest } = user;
      userToCreate.push(rest as User);
    }
  }

  const shouldWriteSettings = Boolean(source.settings && !existingTarget.settings);

  const totalToCreate =
    extToCreate.length +
    movToCreate.length +
    unitToCreate.length +
    userToCreate.length +
    (shouldWriteSettings ? 1 : 0);

  const totalSkipped =
    extSkipped.length + movSkipped.length + unitSkipped.length + userSkipped.length;

  return {
    extinguishers: { toCreate: extToCreate, skippedDuplicates: extSkipped },
    movements: { toCreate: movToCreate, skippedDuplicates: movSkipped },
    units: { toCreate: unitToCreate, skippedDuplicates: unitSkipped },
    users: { toCreate: userToCreate, skippedDuplicates: userSkipped },
    shouldWriteSettings,
    totalToCreate,
    totalSkipped,
  };
}

/**
 * Validates and parses a JSON backup file (supports v1.0 and v2.0 formats).
 */
export function parseBackupJson(jsonString: string): {
  valid: boolean;
  payload?: BackupPayload;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'O arquivo selecionado não contém um objeto JSON válido.' };
    }
    if (!Array.isArray(parsed.extinguishers) || !Array.isArray(parsed.movements)) {
      return {
        valid: false,
        error: 'Estrutura de backup inválida: listas "extinguishers" e "movements" são obrigatórias.',
      };
    }

    const validExtinguishers = parsed.extinguishers.filter(
      (e: unknown): e is Extinguisher =>
        Boolean(
          e &&
            typeof e === 'object' &&
            typeof (e as Extinguisher).id === 'string' &&
            typeof (e as Extinguisher).patrimonyNumber === 'string'
        )
    );

    const validMovements = parsed.movements.filter(
      (m: unknown): m is Movement =>
        Boolean(
          m &&
            typeof m === 'object' &&
            typeof (m as Movement).id === 'string' &&
            typeof (m as Movement).extinguisherId === 'string'
        )
    );

    const validUnits = Array.isArray(parsed.units)
      ? parsed.units.filter(
          (u: unknown): u is Unit =>
            Boolean(u && typeof u === 'object' && typeof (u as Unit).id === 'string' && typeof (u as Unit).code === 'string')
        )
      : undefined;

    const validUsers = Array.isArray(parsed.users)
      ? parsed.users.filter(
          (u: unknown): u is User =>
            Boolean(u && typeof u === 'object' && typeof (u as User).id === 'string' && typeof (u as User).email === 'string')
        )
      : undefined;

    return {
      valid: true,
      payload: {
        version: typeof parsed.version === 'string' ? parsed.version : '1.0',
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
        extinguishers: validExtinguishers,
        movements: validMovements,
        units: validUnits,
        users: validUsers,
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : undefined,
      },
    };
  } catch {
    return { valid: false, error: 'Não foi possível ler o arquivo JSON. Verifique se o conteúdo é válido.' };
  }
}

/**
 * Splits a list of items into chunks to respect Firestore's 500-write batch limit.
 */
export function chunkItems<T>(items: T[], chunkSize = 400): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Removes undefined properties recursively so Firestore setDoc/updateDoc never rejects undefined values.
 */
export function stripUndefinedFields<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
