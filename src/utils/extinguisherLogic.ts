import {
  Extinguisher,
  Movement,
  DashboardMetrics,
  AlertItem,
  ExtinguisherType,
  OperationalCondition,
  UserRole,
  UserStatus,
} from '../types/extinguisher';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador (Controle Total)',
  SUPERVISOR: 'Supervisor Operacional',
  OPERADOR: 'Operador (Movimentações)',
  CONSULTA: 'Consulta (Somente Leitura)',
  TST: 'Supervisor (Técnico de Seg. Trabalho)',
  ALMOXARIFE: 'Operador (Almoxarifado)',
  INSPETOR: 'Consulta (Inspetor de Brigada)',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ATIVO: 'Ativo',
  BLOQUEADO: 'Bloqueado / Suspenso',
  PENDENTE: 'Pendente de Ativação',
};

export const TYPE_LABELS: Record<ExtinguisherType, string> = {
  ABC_PO: 'Pó Químico ABC (Fosfato Monoamônico)',
  BC_PO: 'Pó Químico BC (Bicarbonato de Sódio)',
  CO2: 'Dióxido de Carbono (CO2)',
  AGUA: 'Água Pressurizada (AP)',
  ESPUMA: 'Espuma Mecânica',
};

export const TYPE_SHORT_LABELS: Record<ExtinguisherType, string> = {
  ABC_PO: 'Pó ABC',
  BC_PO: 'Pó BC',
  CO2: 'CO2',
  AGUA: 'Água (AP)',
  ESPUMA: 'Espuma',
};

export const CONDITION_LABELS: Record<OperationalCondition, string> = {
  OPERACIONAL: 'Operacional / Pronto',
  EM_RECARGA: 'Em Recarga / Manutenção',
  VAZIO: 'Vazio / Descarregado',
  INTERDITADO: 'Interditado / Condenado',
  EM_QUARENTENA: 'Em Quarentena / Avaliação',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ENTRADA_ESTOQUE: 'Entrada no Estoque',
  SAIDA_CAMPO: 'Saída para Campo',
  RETORNO_ESTOQUE: 'Retorno ao Estoque',
  ENVIO_RECARGA: 'Envio para Recarga',
  RETORNO_RECARGA: 'Retorno da Recarga',
  UTILIZACAO: 'Utilização em Ocorrência',
  INTERDICAO: 'Interdição do Equipamento',
};

/**
 * Calculates difference in calendar days between today and a target ISO date string (YYYY-MM-DD).
 * Positive: future. Negative: past (overdue).
 */
export function getDaysDifference(targetDateStr: string, referenceDate: Date = new Date()): number {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr + 'T00:00:00');
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffTime = target.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Computes dashboard counters strictly ensuring:
 * 1. Physical location is separated from operational condition.
 * 2. Every extinguisher is counted without double counting.
 */
export function calculateDashboardMetrics(
  extinguishers: Extinguisher[],
  referenceDate: Date = new Date()
): DashboardMetrics {
  let inStockCount = 0;
  let inFieldCount = 0;
  let inRechargeCount = 0;
  let inUseCount = 0;
  let emptyCount = 0;
  let interdictedCount = 0;
  let dueSoonCount = 0;
  let expiredCount = 0;

  const activeExtinguishers = extinguishers.filter((e) => !e.isArchived);

  for (const ext of activeExtinguishers) {
    // Physical location count (mutually exclusive)
    if (ext.locationArea === 'ESTOQUE') {
      inStockCount++;
    } else {
      inFieldCount++;
    }

    // Operational condition count
    if (ext.operationalCondition === 'EM_RECARGA') {
      inRechargeCount++;
    } else if (ext.operationalCondition === 'VAZIO') {
      emptyCount++;
    } else if (ext.operationalCondition === 'INTERDITADO') {
      interdictedCount++;
    } else if (ext.operationalCondition === 'OPERACIONAL' && ext.locationArea === 'CAMPO') {
      inUseCount++;
    }

    // Expiration check (maintenance or hydrostatic test)
    const daysToMaint = getDaysDifference(ext.nextMaintenanceDate, referenceDate);
    const daysToHydro = getDaysDifference(ext.hydrostaticExpirationDate, referenceDate);
    const minDays = Math.min(daysToMaint, daysToHydro);

    if (minDays < 0) {
      expiredCount++;
    } else if (minDays <= 30) {
      dueSoonCount++;
    }
  }

  const alertsCount = expiredCount + dueSoonCount + interdictedCount + emptyCount;

  return {
    totalExtinguishers: activeExtinguishers.length,
    inStockCount,
    inFieldCount,
    inRechargeCount,
    inUseCount,
    emptyCount,
    interdictedCount,
    alertsCount,
    dueSoonCount,
    expiredCount,
  };
}

/**
 * Builds automated smart alerts list based on extinguisher status.
 */
export function generateAlerts(
  extinguishers: Extinguisher[],
  referenceDate: Date = new Date()
): AlertItem[] {
  const alerts: AlertItem[] = [];

  for (const ext of extinguishers) {
    if (ext.isArchived) continue;

    const daysToMaint = getDaysDifference(ext.nextMaintenanceDate, referenceDate);
    const daysToHydro = getDaysDifference(ext.hydrostaticExpirationDate, referenceDate);

    if (ext.operationalCondition === 'INTERDITADO') {
      alerts.push({
        id: `alert-interdicted-${ext.id}`,
        severity: 'CRITICAL',
        title: `Extintor Interditado / Condenado (${ext.id})`,
        description: `Patrimônio ${ext.patrimonyNumber} está interditado em "${ext.locationDetails}". Requer laudo ou descarte.`,
        extinguisherId: ext.id,
        extinguisherPatrimony: ext.patrimonyNumber,
        type: 'INTERDICTED',
      });
    }

    if (ext.operationalCondition === 'VAZIO') {
      alerts.push({
        id: `alert-empty-${ext.id}`,
        severity: 'CRITICAL',
        title: `Extintor Descarregado / Vazio (${ext.id})`,
        description: `Patrimônio ${ext.patrimonyNumber} está sem carga. Necessita envio imediato para recarga técnica.`,
        extinguisherId: ext.id,
        extinguisherPatrimony: ext.patrimonyNumber,
        type: 'EMPTY',
      });
    }

    if (daysToMaint < 0) {
      alerts.push({
        id: `alert-expired-maint-${ext.id}`,
        severity: 'CRITICAL',
        title: `Manutenção Periódica Vencida (${ext.id})`,
        description: `Venceu há ${Math.abs(daysToMaint)} dia(s) (${ext.nextMaintenanceDate}). Tipo: ${TYPE_SHORT_LABELS[ext.type]} no local "${ext.locationDetails}".`,
        extinguisherId: ext.id,
        extinguisherPatrimony: ext.patrimonyNumber,
        dueDate: ext.nextMaintenanceDate,
        daysRemaining: daysToMaint,
        type: 'EXPIRED',
      });
    } else if (daysToMaint <= 30) {
      alerts.push({
        id: `alert-due-soon-maint-${ext.id}`,
        severity: 'WARNING',
        title: `Manutenção Próxima do Vencimento (${ext.id})`,
        description: `Vence em ${daysToMaint} dia(s) (${ext.nextMaintenanceDate}). Programe a rota de inspeção/recarga.`,
        extinguisherId: ext.id,
        extinguisherPatrimony: ext.patrimonyNumber,
        dueDate: ext.nextMaintenanceDate,
        daysRemaining: daysToMaint,
        type: 'DUE_SOON',
      });
    }

    if (daysToHydro < 0 && daysToMaint >= 0) {
      alerts.push({
        id: `alert-expired-hydro-${ext.id}`,
        severity: 'CRITICAL',
        title: `Ensaio Hidrostático Vencido (${ext.id})`,
        description: `Teste quinquenal de pressão venceu em ${ext.hydrostaticExpirationDate}. Cilindro não pode permanecer em uso.`,
        extinguisherId: ext.id,
        extinguisherPatrimony: ext.patrimonyNumber,
        dueDate: ext.hydrostaticExpirationDate,
        daysRemaining: daysToHydro,
        type: 'EXPIRED',
      });
    }
  }

  // Sort critical first, then warning
  return alerts.sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
    return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
  });
}

/**
 * Aggregates stock by type and calculates technical reserve indicators.
 */
export interface StockTypeSummary {
  type: ExtinguisherType;
  typeName: string;
  total: number;
  inStock: number;
  inField: number;
  inRecharge: number;
  operationalStock: number;
  recommendedReserve: number; // 10% of field total, minimum 1
  reserveStatus: 'OK' | 'LOW' | 'CRITICAL';
}

export function computeStockSummary(extinguishers: Extinguisher[]): StockTypeSummary[] {
  const types: ExtinguisherType[] = ['ABC_PO', 'BC_PO', 'CO2', 'AGUA', 'ESPUMA'];

  return types.map((t) => {
    const list = extinguishers.filter((e) => e.type === t && !e.isArchived);
    const inStock = list.filter((e) => e.locationArea === 'ESTOQUE').length;
    const inField = list.filter((e) => e.locationArea === 'CAMPO').length;
    const inRecharge = list.filter((e) => e.operationalCondition === 'EM_RECARGA').length;
    const operationalStock = list.filter(
      (e) => e.locationArea === 'ESTOQUE' && e.operationalCondition === 'OPERACIONAL'
    ).length;

    const recommendedReserve = Math.max(1, Math.ceil(inField * 0.15));
    let reserveStatus: 'OK' | 'LOW' | 'CRITICAL' = 'OK';

    if (operationalStock === 0 && inField > 0) {
      reserveStatus = 'CRITICAL';
    } else if (operationalStock < recommendedReserve) {
      reserveStatus = 'LOW';
    }

    return {
      type: t,
      typeName: TYPE_SHORT_LABELS[t],
      total: list.length,
      inStock,
      inField,
      inRecharge,
      operationalStock,
      recommendedReserve,
      reserveStatus,
    };
  });
}

/**
 * Aggregates real movement history into weekly statistics (last 7 days).
 */
export interface DailyMovementStat {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Seg", "Ter", etc.
  utilizationCount: number; // Incidents / fire usage
  rechargeSentCount: number; // Sent to recharge
  fieldDispatches: number; // Saída para campo
  stockReturns: number; // Retornos e entradas no estoque
  interdictions: number; // Interdições
  totalMovements: number;
}

export function computeWeeklyMovementStats(
  movements: Movement[],
  referenceDate: Date = new Date()
): DailyMovementStat[] {
  const result: DailyMovementStat[] = [];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;

    const dayMovements = movements.filter((m) => m.date === dateStr);
    const utilizationCount = dayMovements.filter((m) => m.movementType === 'UTILIZACAO').length;
    const rechargeSentCount = dayMovements.filter((m) => m.movementType === 'ENVIO_RECARGA').length;
    const fieldDispatches = dayMovements.filter((m) => m.movementType === 'SAIDA_CAMPO').length;
    const stockReturns = dayMovements.filter(
      (m) =>
        m.movementType === 'ENTRADA_ESTOQUE' ||
        m.movementType === 'RETORNO_ESTOQUE' ||
        m.movementType === 'RETORNO_RECARGA'
    ).length;
    const interdictions = dayMovements.filter((m) => m.movementType === 'INTERDICAO').length;

    result.push({
      dateStr,
      dayLabel,
      utilizationCount,
      rechargeSentCount,
      fieldDispatches,
      stockReturns,
      interdictions,
      totalMovements: dayMovements.length,
    });
  }

  return result;
}

/**
 * Aggregates movements into monthly statistics for reporting.
 */
export interface MonthlyReportStat {
  monthKey: string; // "2026-10"
  monthLabel: string; // "Out/2026"
  utilizations: number;
  sentToRecharge: number;
  returnedFromRecharge: number;
  dispatchesToField: number;
  interdictions: number;
  totalMovements: number;
}

export function computeMonthlyReportStats(movements: Movement[]): MonthlyReportStat[] {
  const map = new Map<string, MonthlyReportStat>();
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Process movements sorted by date
  for (const m of movements) {
    if (!m.date) continue;
    const [year, month] = m.date.split('-');
    const monthKey = `${year}-${month}`;
    const monthIndex = parseInt(month, 10) - 1;
    const monthLabel = `${monthNames[monthIndex]}/${year}`;

    if (!map.has(monthKey)) {
      map.set(monthKey, {
        monthKey,
        monthLabel,
        utilizations: 0,
        sentToRecharge: 0,
        returnedFromRecharge: 0,
        dispatchesToField: 0,
        interdictions: 0,
        totalMovements: 0,
      });
    }

    const stat = map.get(monthKey)!;
    stat.totalMovements++;
    if (m.movementType === 'UTILIZACAO') stat.utilizations++;
    if (m.movementType === 'ENVIO_RECARGA') stat.sentToRecharge++;
    if (m.movementType === 'RETORNO_RECARGA') stat.returnedFromRecharge++;
    if (m.movementType === 'SAIDA_CAMPO') stat.dispatchesToField++;
    if (m.movementType === 'INTERDICAO') stat.interdictions++;
  }

  return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * Filter extinguishers by multi-field search term (ID, Patrimony, Series, Location, Manufacturer).
 */
export function filterExtinguishers(
  extinguishers: Extinguisher[],
  searchTerm: string,
  typeFilter: string,
  locationFilter: string,
  conditionFilter: string,
  archiveFilter: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE'
): Extinguisher[] {
  const term = searchTerm.trim().toLowerCase();

  return extinguishers.filter((ext) => {
    // Archive status filter
    if (archiveFilter === 'ACTIVE' && ext.isArchived) {
      return false;
    }
    if (archiveFilter === 'ARCHIVED' && !ext.isArchived) {
      return false;
    }

    if (term) {
      const matchId = ext.id.toLowerCase().includes(term);
      const matchPat = ext.patrimonyNumber.toLowerCase().includes(term);
      const matchSer = ext.serialNumber.toLowerCase().includes(term);
      const matchLoc = ext.locationDetails.toLowerCase().includes(term);
      const matchMan = ext.manufacturer.toLowerCase().includes(term);
      if (!matchId && !matchPat && !matchSer && !matchLoc && !matchMan) {
        return false;
      }
    }

    if (typeFilter && typeFilter !== 'ALL' && ext.type !== typeFilter) {
      return false;
    }

    if (locationFilter && locationFilter !== 'ALL' && ext.locationArea !== locationFilter) {
      return false;
    }

    if (conditionFilter && conditionFilter !== 'ALL' && ext.operationalCondition !== conditionFilter) {
      return false;
    }

    return true;
  });
}
