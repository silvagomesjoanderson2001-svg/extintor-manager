import React from 'react';
import {
  ShieldAlert,
  Boxes,
  MapPin,
  RefreshCw,
  Flame,
  AlertOctagon,
  Clock,
  TrendingUp,
  ArrowRight,
  PlusCircle,
  ArrowLeftRight,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  DashboardMetrics,
  Extinguisher,
  Movement,
  AlertItem,
} from '../../types/extinguisher';
import {
  computeWeeklyMovementStats,
  TYPE_SHORT_LABELS,
  DailyMovementStat,
} from '../../utils/extinguisherLogic';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  extinguishers: Extinguisher[];
  movements: Movement[];
  alerts: AlertItem[];
  onNavigateToTab: (tab: any) => void;
  onOpenNewExtinguisher: () => void;
  onOpenNewMovement: () => void;
  onViewExtinguisherDetails: (extinguisher: Extinguisher) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  extinguishers,
  movements,
  alerts,
  onNavigateToTab,
  onOpenNewExtinguisher,
  onOpenNewMovement,
  onViewExtinguisherDetails,
}) => {
  const weeklyStats: DailyMovementStat[] = computeWeeklyMovementStats(movements);

  const maxMovements = Math.max(
    ...weeklyStats.map((s) => Math.max(s.totalMovements, s.utilizationCount, 2)),
    4
  );

  // Type distribution
  const typeCounts = {
    ABC_PO: extinguishers.filter((e) => e.type === 'ABC_PO').length,
    BC_PO: extinguishers.filter((e) => e.type === 'BC_PO').length,
    CO2: extinguishers.filter((e) => e.type === 'CO2').length,
    AGUA: extinguishers.filter((e) => e.type === 'AGUA').length,
    ESPUMA: extinguishers.filter((e) => e.type === 'ESPUMA').length,
  };

  const recentMovements = movements.slice(0, 5);

  const urgentItems = extinguishers
    .filter(
      (e) =>
        e.operationalCondition === 'INTERDITADO' ||
        e.operationalCondition === 'VAZIO' ||
        alerts.some((a) => a.extinguisherId === e.id && (a.type === 'EXPIRED' || a.type === 'DUE_SOON'))
    )
    .slice(0, 4);

  return (
    <div className="space-y-6 pb-20 md:pb-12">
      {/* Top Welcome Banner with 3 Required Main Shortcuts */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#1a0505] via-[#14161f] to-[#0c0d12] border border-[#3b1212] shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-800/80">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                Extintores Manager
              </span>
              <span className="text-xs text-gray-400">
                Gestão Patrimonial e Segurança Operacional
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Painel Principal
            </h1>
            <p className="text-xs sm:text-sm text-gray-300">
              Visão centralizada de conformidade, estoque de segurança e histórico de movimentações.
            </p>
          </div>

          {/* 3 Explicit Shortcuts: Cadastrar Extintores, Registrar Movimentações e Consultar Estoque */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto pt-2 lg:pt-0">
            {/* Shortcut 1: Cadastrar Extintor */}
            <button
              onClick={onOpenNewExtinguisher}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-xs font-bold shadow-md shadow-red-950/70 transition-all min-h-[42px]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Cadastrar Extintor</span>
            </button>

            {/* Shortcut 2: Registrar Movimentação */}
            <button
              onClick={onOpenNewMovement}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1e2330] hover:bg-[#282f42] text-white border border-[#353f56] text-xs font-bold transition-all shadow-sm min-h-[42px]"
            >
              <ArrowLeftRight className="h-4 w-4 text-sky-400" />
              <span>Registrar Movimentação</span>
            </button>

            {/* Shortcut 3: Consultar Estoque */}
            <button
              onClick={() => onNavigateToTab('estoque')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1e2330] hover:bg-[#282f42] text-white border border-[#353f56] text-xs font-bold transition-all shadow-sm min-h-[42px]"
            >
              <Boxes className="h-4 w-4 text-emerald-400" />
              <span>Consultar Estoque</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7 Requested Primary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Card 1: Total de Extintores */}
        <div
          onClick={() => onNavigateToTab('extintores')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-red-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Total Extintores</span>
            <ShieldAlert className="h-4 w-4 text-gray-300 group-hover:text-red-400 transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            {metrics.totalExtinguishers}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
            <span>Patrimônio ativo</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 2: Em Campo */}
        <div
          onClick={() => onNavigateToTab('extintores')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-sky-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Em Campo</span>
            <MapPin className="h-4 w-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-sky-400 tracking-tight font-mono">
            {metrics.inFieldCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-sky-300/80">
            <span>Nos postos</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 3: Em Estoque */}
        <div
          onClick={() => onNavigateToTab('estoque')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-emerald-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Em Estoque</span>
            <Boxes className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
            {metrics.inStockCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-300/80">
            <span>Almoxarifado</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 4: Em Recarga */}
        <div
          onClick={() => onNavigateToTab('recargas')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-amber-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Em Recarga</span>
            <RefreshCw className="h-4 w-4 text-amber-400 group-hover:rotate-180 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight font-mono">
            {metrics.inRechargeCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-amber-300/80">
            <span>Oficina externa</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 5: Em Uso */}
        <div
          onClick={() => onNavigateToTab('extintores')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-blue-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Em Uso</span>
            <Flame className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 tracking-tight font-mono">
            {metrics.inUseCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-blue-300/80">
            <span>Prontos no campo</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 6: Vazios */}
        <div
          onClick={() => onNavigateToTab('recargas')}
          className="col-span-1 p-3.5 sm:p-4 rounded-2xl bg-[#131620] border border-[#242b3b] hover:border-rose-800/60 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold">Vazios</span>
            <AlertOctagon className="h-4 w-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 tracking-tight font-mono">
            {metrics.emptyCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-rose-300/80">
            <span>Aguardam recarga</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Card 7: Próximos do Vencimento */}
        <div
          onClick={() => onNavigateToTab('alertas')}
          className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-red-950/60 to-[#131620] border border-red-800/70 hover:border-red-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-red-300 mb-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Próx. Vencimento</span>
            <Clock className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-red-400 tracking-tight font-mono">
            {metrics.dueSoonCount + metrics.expiredCount}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-red-300">
            <span>{metrics.expiredCount} vencido(s)</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Main Analysis: Weekly Movements Real Chart & Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Weekly Movement Chart (Col span 2) */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#141720] border border-[#242b3b] shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#222736]">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Gráfico Semanal de Utilização e Movimentação
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                Movimentações reais registradas nos últimos 7 dias.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-red-600"></span>
                <span className="text-gray-300 text-[11px]">Ocorrência</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500"></span>
                <span className="text-gray-300 text-[11px]">Recarga</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-sky-500"></span>
                <span className="text-gray-300 text-[11px]">Campo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500"></span>
                <span className="text-gray-300 text-[11px]">Estoque</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-purple-500"></span>
                <span className="text-gray-300 text-[11px]">Interdição</span>
              </div>
            </div>
          </div>

          {/* SVG Bar Chart with Responsive Scale */}
          <div className="pt-6 pb-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-56 px-2">
              {weeklyStats.map((stat, idx) => {
                const totalHeightPct =
                  stat.totalMovements > 0
                    ? Math.min(100, Math.max(22, (stat.totalMovements / maxMovements) * 100))
                    : 8;
                const utilHeightPct = stat.totalMovements > 0 ? (stat.utilizationCount / stat.totalMovements) * 100 : 0;
                const rechargeHeightPct = stat.totalMovements > 0 ? (stat.rechargeSentCount / stat.totalMovements) * 100 : 0;
                const fieldHeightPct = stat.totalMovements > 0 ? (stat.fieldDispatches / stat.totalMovements) * 100 : 0;
                const returnsHeightPct = stat.totalMovements > 0 ? (stat.stockReturns / stat.totalMovements) * 100 : 0;
                const interdictHeightPct = stat.totalMovements > 0 ? (stat.interdictions / stat.totalMovements) * 100 : 0;

                const isToday = idx === 6;

                return (
                  <div key={stat.dateStr} className="flex flex-col items-center h-full justify-end group">
                    <div className="mb-1 text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors">
                      {stat.totalMovements > 0 ? stat.totalMovements : '-'}
                    </div>

                    <div
                      className={`w-full max-w-[42px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all ${
                        isToday ? 'ring-2 ring-red-500/80 ring-offset-2 ring-offset-[#141720]' : 'bg-[#1b202c]'
                      }`}
                      style={{ height: `${totalHeightPct}%` }}
                    >
                      {stat.totalMovements === 0 ? (
                        <div className="w-full h-full bg-[#171b26] rounded-t-lg opacity-40"></div>
                      ) : (
                        <div className="w-full flex flex-col-reverse h-full">
                          {stat.utilizationCount > 0 && (
                            <div
                              style={{ height: `${utilHeightPct}%` }}
                              className="bg-red-600 w-full hover:bg-red-500 transition-colors"
                              title={`${stat.utilizationCount} extintor(es) em ocorrência`}
                            />
                          )}
                          {stat.rechargeSentCount > 0 && (
                            <div
                              style={{ height: `${rechargeHeightPct}%` }}
                              className="bg-amber-500 w-full hover:bg-amber-400 transition-colors"
                              title={`${stat.rechargeSentCount} enviado(s) para recarga`}
                            />
                          )}
                          {stat.fieldDispatches > 0 && (
                            <div
                              style={{ height: `${fieldHeightPct}%` }}
                              className="bg-sky-500 w-full hover:bg-sky-400 transition-colors"
                              title={`${stat.fieldDispatches} saída(s) para campo`}
                            />
                          )}
                          {stat.stockReturns > 0 && (
                            <div
                              style={{ height: `${returnsHeightPct}%` }}
                              className="bg-emerald-500 w-full hover:bg-emerald-400 transition-colors"
                              title={`${stat.stockReturns} entrada/retorno ao estoque`}
                            />
                          )}
                          {stat.interdictions > 0 && (
                            <div
                              style={{ height: `${interdictHeightPct}%` }}
                              className="bg-purple-500 w-full hover:bg-purple-400 transition-colors"
                              title={`${stat.interdictions} interdição(ões)`}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-center">
                      <span
                        className={`text-[10px] sm:text-[11px] font-semibold block ${
                          isToday ? 'text-red-400 font-bold' : 'text-gray-400'
                        }`}
                      >
                        {stat.dayLabel.split(' ')[0]}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-gray-500 block">
                        {stat.dayLabel.split(' ')[1]?.replace('(', '')?.replace(')', '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#222736] flex items-center justify-between text-xs text-gray-400">
            <span>Total de registros nos 7 dias: <strong>{weeklyStats.reduce((acc, s) => acc + s.totalMovements, 0)}</strong></span>
            <button
              onClick={() => onNavigateToTab('movimentacoes')}
              className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
            >
              <span>Ver histórico</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Types Breakdown (Col span 1) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141720] border border-[#242b3b] shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white mb-1">Distribuição por Carga Extintora</h2>
            <p className="text-xs text-gray-400 mb-4">
              Agente extintor e classes de combate (A, B, C, D).
            </p>

            <div className="space-y-3">
              {(
                [
                  { key: 'ABC_PO', label: 'Pó Químico ABC', count: typeCounts.ABC_PO, color: 'bg-red-500' },
                  { key: 'CO2', label: 'Dióxido de Carbono (CO2)', count: typeCounts.CO2, color: 'bg-emerald-500' },
                  { key: 'AGUA', label: 'Água Pressurizada (AP)', count: typeCounts.AGUA, color: 'bg-sky-500' },
                  { key: 'BC_PO', label: 'Pó Químico BC', count: typeCounts.BC_PO, color: 'bg-amber-500' },
                  { key: 'ESPUMA', label: 'Espuma Mecânica', count: typeCounts.ESPUMA, color: 'bg-purple-500' },
                ] as const
              ).map((item) => {
                const pct = metrics.totalExtinguishers > 0 ? (item.count / metrics.totalExtinguishers) * 100 : 0;
                return (
                  <div key={item.key}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-medium text-gray-200">{item.label}</span>
                      <span className="text-gray-400 font-mono text-[11px]">
                        {item.count} un ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#1f2432] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#222736]">
            <button
              onClick={() => onNavigateToTab('estoque')}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1b202c] hover:bg-[#232938] text-xs font-semibold text-gray-200 flex items-center justify-center gap-1.5 border border-[#2b3346] transition-colors"
            >
              <Boxes className="h-3.5 w-3.5 text-red-400" />
              <span>Ver Balanço e Reserva Técnica</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Urgent Items & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Extinguishers Attention Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141720] border border-[#242b3b] shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#222736]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <h2 className="text-sm sm:text-base font-bold text-white">Extintores que Demandam Atenção</h2>
            </div>
            <button
              onClick={() => onNavigateToTab('alertas')}
              className="text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              Ver todos ({alerts.length})
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {urgentItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                Nenhum extintor com pendência crítica no momento.
              </div>
            ) : (
              urgentItems.map((ext) => (
                <div
                  key={ext.id}
                  onClick={() => onViewExtinguisherDetails(ext)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#191c28] border border-[#262d3e] hover:border-red-700/60 transition-all cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{ext.id}</span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        ({ext.patrimonyNumber})
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-gray-300 border border-[#333b4e]">
                        {TYPE_SHORT_LABELS[ext.type]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-300 mt-0.5">
                      {ext.locationDetails}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] mt-1 text-gray-400">
                      <span>Próx. Manut.: <span className="font-mono text-gray-200">{ext.nextMaintenanceDate}</span></span>
                      <span>Condição: <span className="text-red-400 font-medium">{ext.operationalCondition}</span></span>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-red-400 transition-colors ml-2" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Movements Feed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141720] border border-[#242b3b] shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#222736]">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm sm:text-base font-bold text-white">Últimas Movimentações Registradas</h2>
            </div>
            <button
              onClick={() => onNavigateToTab('movimentacoes')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              Ver histórico
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {recentMovements.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">
                Nenhuma movimentação registrada até o momento.
              </p>
            ) : (
              recentMovements.map((mov) => (
                <div
                  key={mov.id}
                  className="p-3 rounded-xl bg-[#191c28] border border-[#262d3e] text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{mov.extinguisherId}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-300 border border-red-800/60">
                        {mov.movementType.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      {mov.date} {mov.time}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-300 truncate">
                    <span className="text-gray-400">Destino:</span> {mov.destinationLocation}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#222736]">
                    <span>Resp: {mov.responsibleUserName}</span>
                    <span className="italic truncate max-w-[200px]">{mov.notes}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
