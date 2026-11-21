import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardMetrics,
  getDaysDifference,
  generateAlerts,
  computeStockSummary,
  computeWeeklyMovementStats,
  filterExtinguishers,
} from './extinguisherLogic';
import { Extinguisher, Movement } from '../types/extinguisher';

const sampleExtinguishers: Extinguisher[] = [
  {
    id: 'EXT-001',
    patrimonyNumber: 'PAT-1001',
    type: 'ABC_PO',
    capacity: '6 kg',
    manufacturer: 'Kidde',
    serialNumber: 'SR-111',
    locationArea: 'CAMPO',
    locationDetails: 'Bloco A - Recepção',
    manufacturingDate: '2023-01-10',
    lastRechargeDate: '2026-01-15',
    nextMaintenanceDate: '2026-11-15', // Due in 15 days from 2026-10-31
    hydrostaticExpirationDate: '2028-01-10',
    operationalCondition: 'OPERACIONAL',
    hasPressureGaugeNormal: true,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'EXT-002',
    patrimonyNumber: 'PAT-1002',
    type: 'CO2',
    capacity: '6 kg',
    manufacturer: 'Mocelin',
    serialNumber: 'SR-222',
    locationArea: 'ESTOQUE',
    locationDetails: 'Almoxarifado Central - Prateleira 1',
    manufacturingDate: '2021-05-20',
    lastRechargeDate: '2025-05-10',
    nextMaintenanceDate: '2026-05-10', // Expired on 2026-10-31
    hydrostaticExpirationDate: '2026-05-20',
    operationalCondition: 'VAZIO',
    hasPressureGaugeNormal: false,
    createdAt: '2025-05-10T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'EXT-003',
    patrimonyNumber: 'PAT-1003',
    type: 'AGUA',
    capacity: '10 L',
    manufacturer: 'Resil',
    serialNumber: 'SR-333',
    locationArea: 'CAMPO',
    locationDetails: 'Galpão 2 - Portaria',
    manufacturingDate: '2024-03-01',
    lastRechargeDate: '2026-03-01',
    nextMaintenanceDate: '2027-03-01', // Normal
    hydrostaticExpirationDate: '2029-03-01',
    operationalCondition: 'INTERDITADO',
    hasPressureGaugeNormal: false,
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'EXT-004',
    patrimonyNumber: 'PAT-1004',
    type: 'ABC_PO',
    capacity: '4 kg',
    manufacturer: 'Bucka',
    serialNumber: 'SR-444',
    locationArea: 'ESTOQUE',
    locationDetails: 'Almoxarifado - Reserva',
    manufacturingDate: '2025-02-15',
    lastRechargeDate: '2026-02-15',
    nextMaintenanceDate: '2027-02-15',
    hydrostaticExpirationDate: '2030-02-15',
    operationalCondition: 'OPERACIONAL',
    hasPressureGaugeNormal: true,
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
  },
];

test('calculateDashboardMetrics computes accurate non-double counted metrics', () => {
  const refDate = new Date('2026-10-31T00:00:00');
  const metrics = calculateDashboardMetrics(sampleExtinguishers, refDate);

  assert.equal(metrics.totalExtinguishers, 4);
  assert.equal(metrics.inStockCount, 2); // EXT-002, EXT-004
  assert.equal(metrics.inFieldCount, 2); // EXT-001, EXT-003
  assert.equal(metrics.inStockCount + metrics.inFieldCount, metrics.totalExtinguishers);

  assert.equal(metrics.inUseCount, 1); // EXT-001 (Operacional & Campo)
  assert.equal(metrics.emptyCount, 1); // EXT-002
  assert.equal(metrics.interdictedCount, 1); // EXT-003
  assert.equal(metrics.expiredCount, 1); // EXT-002 (maintenance 2026-05-10 is expired)
  assert.equal(metrics.dueSoonCount, 1); // EXT-001 (maintenance 2026-11-15 is in 15 days)
});

test('generateAlerts flags expired, due soon, empty, and interdicted extinguishers', () => {
  const refDate = new Date('2026-10-31T00:00:00');
  const alerts = generateAlerts(sampleExtinguishers, refDate);

  assert.ok(alerts.length >= 4);
  const interdictedAlert = alerts.find((a) => a.type === 'INTERDICTED');
  assert.ok(interdictedAlert, 'Must flag interdicted');
  assert.equal(interdictedAlert?.extinguisherId, 'EXT-003');

  const emptyAlert = alerts.find((a) => a.type === 'EMPTY');
  assert.ok(emptyAlert, 'Must flag empty');
  assert.equal(emptyAlert?.extinguisherId, 'EXT-002');

  const expiredAlert = alerts.find((a) => a.type === 'EXPIRED');
  assert.ok(expiredAlert, 'Must flag expired maintenance');
  assert.equal(expiredAlert?.extinguisherId, 'EXT-002');

  const dueSoonAlert = alerts.find((a) => a.type === 'DUE_SOON');
  assert.ok(dueSoonAlert, 'Must flag due soon');
  assert.equal(dueSoonAlert?.extinguisherId, 'EXT-001');
});

test('computeStockSummary properly calculates technical reserve and status', () => {
  const summary = computeStockSummary(sampleExtinguishers);
  assert.equal(summary.length, 5); // 5 types

  const abcSummary = summary.find((s) => s.type === 'ABC_PO');
  assert.ok(abcSummary);
  assert.equal(abcSummary?.total, 2);
  assert.equal(abcSummary?.inStock, 1);
  assert.equal(abcSummary?.inField, 1);
  assert.equal(abcSummary?.operationalStock, 1);
});

test('computeWeeklyMovementStats aggregates actual daily movements over 7 days', () => {
  const refDate = new Date('2026-10-31T00:00:00');
  const sampleMovements: Movement[] = [
    {
      id: 'MOV-1',
      date: '2026-10-31',
      time: '09:30',
      timestamp: 1793439000000,
      extinguisherId: 'EXT-001',
      extinguisherPatrimony: 'PAT-1001',
      extinguisherType: 'ABC_PO',
      movementType: 'UTILIZACAO',
      originLocation: 'Bloco A',
      destinationLocation: 'Bloco A',
      responsibleUserId: 'u1',
      responsibleUserName: 'Carlos Silva',
      notes: 'Princípio de incêndio em nobreak controlado',
    },
    {
      id: 'MOV-2',
      date: '2026-10-31',
      time: '14:00',
      timestamp: 1793455200000,
      extinguisherId: 'EXT-002',
      extinguisherPatrimony: 'PAT-1002',
      extinguisherType: 'CO2',
      movementType: 'ENVIO_RECARGA',
      originLocation: 'Almoxarifado',
      destinationLocation: 'Empresa Prestadora ABC',
      responsibleUserId: 'u2',
      responsibleUserName: 'Mariana Lima',
      notes: 'Envio para recarga periódica',
    },
  ];

  const weeklyStats = computeWeeklyMovementStats(sampleMovements, refDate);
  assert.equal(weeklyStats.length, 7);

  const todayStat = weeklyStats[6]; // last day is 2026-10-31
  assert.equal(todayStat.dateStr, '2026-10-31');
  assert.equal(todayStat.utilizationCount, 1);
  assert.equal(todayStat.rechargeSentCount, 1);
  assert.equal(todayStat.totalMovements, 2);
});

test('filterExtinguishers filters correctly by text and attributes', () => {
  // Search by patrimony
  const patSearch = filterExtinguishers(sampleExtinguishers, 'PAT-1001', 'ALL', 'ALL', 'ALL');
  assert.equal(patSearch.length, 1);
  assert.equal(patSearch[0].id, 'EXT-001');

  // Filter by location
  const stockSearch = filterExtinguishers(sampleExtinguishers, '', 'ALL', 'ESTOQUE', 'ALL');
  assert.equal(stockSearch.length, 2);

  // Filter by condition
  const interdictedSearch = filterExtinguishers(sampleExtinguishers, '', 'ALL', 'ALL', 'INTERDITADO');
  assert.equal(interdictedSearch.length, 1);
  assert.equal(interdictedSearch[0].id, 'EXT-003');

  // Search by manufacturer
  const manufacturerSearch = filterExtinguishers(sampleExtinguishers, 'Kidde', 'ALL', 'ALL', 'ALL');
  assert.equal(manufacturerSearch.length, 1);
  assert.equal(manufacturerSearch[0].id, 'EXT-001');
});
