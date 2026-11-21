import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdempotentMigrationPlan,
  parseBackupJson,
  chunkItems,
  resolveRolePermissions,
  stripUndefinedFields,
} from './migrationLogic';
import { Extinguisher, Movement, Unit, User } from '../types/extinguisher';

const baseExt: Extinguisher = {
  id: 'EXT-001',
  patrimonyNumber: 'PAT-2024-001',
  type: 'ABC_PO',
  capacity: '6 kg',
  manufacturer: 'Kidde',
  serialNumber: 'SR-001',
  locationArea: 'CAMPO',
  locationDetails: 'Bloco A',
  manufacturingDate: '2024-01-01',
  lastRechargeDate: '2025-01-01',
  nextMaintenanceDate: '2026-01-01',
  hydrostaticExpirationDate: '2029-01-01',
  operationalCondition: 'OPERACIONAL',
  hasPressureGaugeNormal: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const baseMov: Movement = {
  id: 'MOV-001',
  date: '2026-10-20',
  time: '09:00',
  timestamp: 1792486800000,
  extinguisherId: 'EXT-001',
  extinguisherPatrimony: 'PAT-2024-001',
  extinguisherType: 'ABC_PO',
  movementType: 'SAIDA_CAMPO',
  originLocation: 'Estoque',
  destinationLocation: 'Bloco A',
  responsibleUserId: 'usr-1',
  responsibleUserName: 'Admin',
  notes: 'Alocação inicial',
};

const baseUnit: Unit = {
  id: 'unit-1',
  name: 'Matriz',
  code: 'UN-MTZ',
  city: 'São Paulo',
  state: 'SP',
  address: 'Av. Paulista, 1000',
  responsibleTst: 'Ana',
  phone: '11999999999',
  createdAt: '2024-01-01T00:00:00Z',
};

const baseUser: User = {
  id: 'usr-1',
  name: 'Gestor',
  email: 'gestor@empresa.com.br',
  role: 'ADMIN',
  status: 'ATIVO',
  department: 'SESMT',
  createdAt: '2024-01-01T00:00:00Z',
};

test('buildIdempotentMigrationPlan skips duplicates by ID and natural keys', () => {
  const localExts: Extinguisher[] = [
    baseExt,
    { ...baseExt, id: 'EXT-999', patrimonyNumber: 'PAT-2024-001' }, // same patrimony -> duplicate!
    { ...baseExt, id: 'EXT-002', patrimonyNumber: 'PAT-2024-002' }, // unique -> migrate
  ];
  const localMovs: Movement[] = [
    baseMov,
    { ...baseMov, id: 'MOV-002' },
  ];
  const localUnits: Unit[] = [
    baseUnit,
    { ...baseUnit, id: 'unit-new', code: 'un-mtz' }, // same code case-insensitive -> skip
    { ...baseUnit, id: 'unit-2', code: 'UN-FAB' },
  ];
  const localUsers: User[] = [
    baseUser,
    { ...baseUser, id: 'usr-dup-email', email: 'GESTOR@empresa.com.br' }, // same email -> skip
    { ...baseUser, id: 'usr-2', email: 'op@empresa.com.br', role: 'OPERADOR', passwordHash: 'abc' },
  ];

  const plan = buildIdempotentMigrationPlan(
    {
      extinguishers: localExts,
      movements: localMovs,
      units: localUnits,
      users: localUsers,
      settings: null,
    },
    {
      extinguishers: [baseExt],
      movements: [baseMov],
      units: [baseUnit],
      users: [baseUser],
      settings: null,
    }
  );

  assert.equal(plan.extinguishers.toCreate.length, 1);
  assert.equal(plan.extinguishers.toCreate[0].id, 'EXT-002');
  assert.equal(plan.extinguishers.skippedDuplicates.length, 2);

  assert.equal(plan.movements.toCreate.length, 1);
  assert.equal(plan.movements.skippedDuplicates.length, 1);

  assert.equal(plan.units.toCreate.length, 1);
  assert.equal(plan.units.toCreate[0].code, 'UN-FAB');
  assert.equal(plan.units.skippedDuplicates.length, 2);

  assert.equal(plan.users.toCreate.length, 1);
  assert.equal(plan.users.toCreate[0].email, 'op@empresa.com.br');
  assert.equal(plan.users.toCreate[0].passwordHash, undefined, 'passwordHash must be stripped on migration');
  assert.equal(plan.users.skippedDuplicates.length, 2);
});

test('parseBackupJson validates v1 and v2 backup formats cleanly', () => {
  const invalid = parseBackupJson('{not json');
  assert.equal(invalid.valid, false);

  const missingArrays = parseBackupJson(JSON.stringify({ version: '2.0' }));
  assert.equal(missingArrays.valid, false);

  const valid = parseBackupJson(
    JSON.stringify({
      version: '2.0',
      exportedAt: '2026-11-12T00:00:00Z',
      extinguishers: [baseExt],
      movements: [baseMov],
      units: [baseUnit],
    })
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.payload?.extinguishers.length, 1);
  assert.equal(valid.payload?.units?.length, 1);
});

test('chunkItems splits batches safely under Firestore 500-write limit', () => {
  const items = Array.from({ length: 950 }, (_, idx) => idx);
  const chunks = chunkItems(items, 400);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 400);
  assert.equal(chunks[1].length, 400);
  assert.equal(chunks[2].length, 150);
});

test('resolveRolePermissions enforces RBAC and blocks suspended accounts', () => {
  const admin = resolveRolePermissions('ADMIN', 'ATIVO');
  assert.equal(admin.canManageUsers, true);
  assert.equal(admin.canDeleteExtinguisher, true);

  const supervisor = resolveRolePermissions('SUPERVISOR', 'ATIVO');
  assert.equal(supervisor.canManageUsers, false);
  assert.equal(supervisor.canEditExtinguisher, true);
  assert.equal(supervisor.canInterdict, true);
  assert.equal(supervisor.canDeleteExtinguisher, false);

  const operador = resolveRolePermissions('OPERADOR', 'ATIVO');
  assert.equal(operador.canCreateExtinguisher, true);
  assert.equal(operador.canRegisterMovement, true);
  assert.equal(operador.canEditExtinguisher, false);

  const consulta = resolveRolePermissions('CONSULTA', 'ATIVO');
  assert.equal(consulta.isReadOnly, true);
  assert.equal(consulta.canRegisterMovement, false);

  const blockedAdmin = resolveRolePermissions('ADMIN', 'BLOQUEADO');
  assert.equal(blockedAdmin.isReadOnly, true);
  assert.equal(blockedAdmin.canManageUsers, false);
  assert.equal(blockedAdmin.canDeleteExtinguisher, false);
});

test('stripUndefinedFields removes undefined keys for Firestore safety', () => {
  const cleaned = stripUndefinedFields({ a: 'ok', b: undefined, c: false, d: 0 });
  assert.deepEqual(cleaned, { a: 'ok', c: false, d: 0 });
});
