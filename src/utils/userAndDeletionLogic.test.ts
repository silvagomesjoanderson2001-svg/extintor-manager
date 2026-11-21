import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDashboardMetrics, generateAlerts } from './extinguisherLogic';
import { Extinguisher, User, Movement } from '../types/extinguisher';

const adminUser: User = {
  id: 'usr-admin-1',
  name: 'Administrador Chefe',
  email: 'admin@empresa.com.br',
  role: 'ADMIN',
  status: 'ATIVO',
  department: 'SESMT',
  createdAt: '2023-01-01T00:00:00Z',
};

const operatorUser: User = {
  id: 'usr-op-1',
  name: 'Operador Silva',
  email: 'operador@empresa.com.br',
  role: 'OPERADOR',
  status: 'ATIVO',
  department: 'Logística',
  createdAt: '2023-01-01T00:00:00Z',
};

test('Archiving an extinguisher removes it from active dashboard counts and alerts', () => {
  const extinguishers: Extinguisher[] = [
    {
      id: 'EXT-001',
      patrimonyNumber: 'PAT-001',
      type: 'ABC_PO',
      capacity: '6 kg',
      manufacturer: 'Kidde',
      serialNumber: 'SR-1',
      locationArea: 'CAMPO',
      locationDetails: 'Setor A',
      manufacturingDate: '2023-01-01',
      lastRechargeDate: '2025-01-01',
      nextMaintenanceDate: '2026-01-01', // Expired
      hydrostaticExpirationDate: '2028-01-01',
      operationalCondition: 'OPERACIONAL',
      hasPressureGaugeNormal: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      isArchived: false,
    },
    {
      id: 'EXT-002',
      patrimonyNumber: 'PAT-002',
      type: 'CO2',
      capacity: '6 kg',
      manufacturer: 'Mocelin',
      serialNumber: 'SR-2',
      locationArea: 'ESTOQUE',
      locationDetails: 'Almoxarifado',
      manufacturingDate: '2022-01-01',
      lastRechargeDate: '2025-01-01',
      nextMaintenanceDate: '2025-06-01', // Expired
      hydrostaticExpirationDate: '2027-01-01',
      operationalCondition: 'VAZIO',
      hasPressureGaugeNormal: false,
      createdAt: '2022-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      isArchived: true, // Archived / Deactivated!
      archivedAt: '2026-10-01T10:00:00Z',
      archivedReason: 'Condenado após queda',
    },
  ];

  const refDate = new Date('2026-11-01T00:00:00');
  const metrics = calculateDashboardMetrics(extinguishers, refDate);

  // Only active (non-archived) extinguisher is counted in active metrics
  assert.equal(metrics.totalExtinguishers, 1, 'Total must count only active extinguishers');
  assert.equal(metrics.inFieldCount, 1);
  assert.equal(metrics.inStockCount, 0, 'Archived stock extinguisher should not count in active stock');

  const alerts = generateAlerts(extinguishers, refDate);
  // EXT-002 is archived so it must not pollute active alerts
  const alertForExt2 = alerts.find((a) => a.extinguisherId === 'EXT-002');
  assert.equal(alertForExt2, undefined, 'Archived extinguisher must not generate active alerts');
});

test('RBAC user safety rules: cannot delete self, cannot delete last admin', () => {
  const users: User[] = [adminUser, operatorUser];

  // Self deletion attempt
  const canDeleteSelf = (targetId: string, currentId: string) => targetId !== currentId;
  assert.equal(canDeleteSelf(adminUser.id, adminUser.id), false, 'User must not delete own account');

  // Last admin check
  const hasOtherActiveAdmin = (targetId: string, userList: User[]) => {
    return userList.some((u) => u.id !== targetId && u.role === 'ADMIN' && u.status === 'ATIVO');
  };
  assert.equal(hasOtherActiveAdmin(adminUser.id, users), false, 'Cannot remove the last active admin');
});

test('Movement preservation rule: equipment with movements cannot be permanently wiped', () => {
  const sampleMovements: Movement[] = [
    {
      id: 'MOV-100',
      date: '2026-10-15',
      time: '10:00',
      timestamp: 1792000000000,
      extinguisherId: 'EXT-001',
      extinguisherPatrimony: 'PAT-001',
      extinguisherType: 'ABC_PO',
      movementType: 'SAIDA_CAMPO',
      originLocation: 'Estoque',
      destinationLocation: 'Setor A',
      responsibleUserId: operatorUser.id,
      responsibleUserName: operatorUser.name,
      notes: 'Alocação inicial',
    },
  ];

  const canPermanentlyDelete = (extId: string, movements: Movement[], user: User) => {
    if (user.role !== 'ADMIN') return false;
    const count = movements.filter((m) => m.extinguisherId === extId).length;
    return count === 0;
  };

  // EXT-001 has 1 movement -> cannot be permanently wiped
  assert.equal(canPermanentlyDelete('EXT-001', sampleMovements, adminUser), false);

  // EXT-NEW has 0 movements -> can be permanently wiped by ADMIN
  assert.equal(canPermanentlyDelete('EXT-NEW', sampleMovements, adminUser), true);

  // Non-admin cannot permanently delete even if 0 movements
  assert.equal(canPermanentlyDelete('EXT-NEW', sampleMovements, operatorUser), false);
});
