import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  RefreshCw,
  Flame,
  CheckCircle2,
  Boxes,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Extinguisher,
  Movement,
} from '../../types/extinguisher';
import {
  computeWeeklyMovementStats,
  computeMonthlyReportStats,
  DailyMovementStat,
  MonthlyReportStat,
  TYPE_SHORT_LABELS,
} from '../../utils/extinguisherLogic';

interface ReportsViewProps {
  extinguishers: Extinguisher[];
  movements: Movement[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ extinguishers, movements }) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  const weeklyStats: DailyMovementStat[] = computeWeeklyMovementStats(movements);
  const monthlyStats: MonthlyReportStat[] = computeMonthlyReportStats(movements);

  // Computed availability
  const totalExtinguishers = extinguishers.length;
  const readyInField = extinguishers.filter(
    (e) => e.locationArea === 'CAMPO' && e.operationalCondition === 'OPERACIONAL'
  ).length;
  const readyInStock = extinguishers.filter(
    (e) => e.locationArea === 'ESTOQUE' && e.operationalCondition === 'OPERACIONAL'
  ).length;
  const unavailable = extinguishers.filter(
    (e) =>
      e.operationalCondition === 'EM_RECARGA' ||
      e.operationalCondition === 'VAZIO' ||
      e.operationalCondition === 'INTERDITADO'
  ).length;

  const totalAvailable = readyInField + readyInStock;
  const availabilityRate = totalExtinguishers > 0 ? ((totalAvailable / totalExtinguishers) * 100).toFixed(1) : '100.0';

  // Utilizations list (real incident occurrences)
  const incidentMovements = movements.filter((m) => m.movementType === 'UTILIZACAO');
  const rechargeMovements = movements.filter((m) => m.movementType === 'ENVIO_RECARGA');

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Mes', 'Utilizacoes_Ocorrencia', 'Envio_Recarga', 'Retorno_Recarga', 'Saidas_Campo', 'Total_Movimentos'];
    const rows = monthlyStats.map((s) => [
      `"${s.monthLabel}"`,
      s.utilizations,
      s.sentToRecharge,
      s.returnedFromRecharge,
      s.dispatchesToField,
      s.totalMovements,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_gerencial_extintores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Printable Header */}
      <div className="hidden print:block pb-4 border-b border-gray-400">
        <h1 className="text-2xl font-black text-red-800">EXTINTORES MANAGER - RELATÓRIO EXECUTIVO</h1>
        <p className="text-xs text-gray-700">SESMT / Segurança do Trabalho • Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
      </div>

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938] print:hidden">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-red-500" />
            <span>Relatórios & Métricas Operacionais</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Estatísticas calculadas a partir de movimentações reais e disponibilidade do parque.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-xl bg-[#141720] p-1 border border-[#272c3a]">
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === 'weekly'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Semanal (7 Dias)
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === 'monthly'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Mensal (Histórico)
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1e27] text-gray-200 border border-[#2c3345] hover:bg-[#232936] hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-red-400" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1e27] text-gray-200 border border-[#2c3345] hover:bg-[#232936] hover:text-white transition-colors"
          >
            <Printer className="h-3.5 w-3.5 text-gray-400" />
            <span className="hidden sm:inline">Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Availability Metric Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <span className="text-xs text-gray-400 print:text-gray-600 block mb-1">Taxa de Disponibilidade</span>
          <div className="text-3xl font-black text-emerald-400 print:text-emerald-700 font-mono">
            {availabilityRate}%
          </div>
          <span className="text-[11px] text-emerald-300/80 print:text-emerald-800 block mt-1">
            {totalAvailable} de {totalExtinguishers} operacionais
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <span className="text-xs text-sky-400 print:text-sky-700 font-semibold block mb-1">Disponíveis em Campo</span>
          <div className="text-3xl font-black text-sky-400 print:text-sky-800 font-mono">
            {readyInField}
          </div>
          <span className="text-[11px] text-sky-300/80 print:text-sky-700 block mt-1">Nos postos de combate</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <span className="text-xs text-emerald-400 print:text-emerald-700 font-semibold block mb-1">Disponíveis em Estoque</span>
          <div className="text-3xl font-black text-emerald-400 print:text-emerald-800 font-mono">
            {readyInStock}
          </div>
          <span className="text-[11px] text-emerald-300/80 print:text-emerald-700 block mt-1">Reserva para substituição</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <span className="text-xs text-rose-400 print:text-rose-700 font-semibold block mb-1">Indisponíveis / Recarga</span>
          <div className="text-3xl font-black text-rose-400 print:text-rose-800 font-mono">
            {unavailable}
          </div>
          <span className="text-[11px] text-rose-300/80 print:text-rose-700 block mt-1">Recarga, vazios ou interd.</span>
        </div>
      </div>

      {/* Dynamic Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Utilização em Ocorrências */}
        <div className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <div className="flex items-center justify-between pb-3 border-b border-[#222838] print:border-gray-300 mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              <div>
                <h3 className="text-sm font-bold text-white print:text-black">
                  Extintores Utilizados em Ocorrências
                </h3>
                <p className="text-[11px] text-gray-400 print:text-gray-600">
                  {period === 'weekly' ? 'Últimos 7 dias de operações' : 'Consolidado mensal'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-red-400">
              Total: {incidentMovements.length}
            </span>
          </div>

          {/* Chart Display */}
          <div className="h-48 flex items-end gap-3 pt-6 px-2">
            {period === 'weekly' ? (
              weeklyStats.map((stat) => {
                const max = Math.max(...weeklyStats.map((s) => s.utilizationCount), 2);
                const heightPct = stat.utilizationCount > 0 ? (stat.utilizationCount / max) * 100 : 8;

                return (
                  <div key={stat.dateStr} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] font-bold text-gray-300 mb-1">
                      {stat.utilizationCount > 0 ? stat.utilizationCount : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        stat.utilizationCount > 0 ? 'bg-red-600' : 'bg-[#1e2330]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="mt-2 text-[10px] text-gray-400 block truncate">
                      {stat.dayLabel.split(' ')[0]}
                    </span>
                  </div>
                );
              })
            ) : (
              monthlyStats.map((stat) => {
                const max = Math.max(...monthlyStats.map((s) => s.utilizations), 2);
                const heightPct = stat.utilizations > 0 ? (stat.utilizations / max) * 100 : 8;

                return (
                  <div key={stat.monthKey} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] font-bold text-gray-300 mb-1">
                      {stat.utilizations > 0 ? stat.utilizations : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        stat.utilizations > 0 ? 'bg-red-600' : 'bg-[#1e2330]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="mt-2 text-[10px] text-gray-400 block truncate">
                      {stat.monthLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Extintores Enviados para Recarga */}
        <div className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] print:bg-white print:border-gray-300">
          <div className="flex items-center justify-between pb-3 border-b border-[#222838] print:border-gray-300 mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-white print:text-black">
                  Extintores Enviados para Recarga
                </h3>
                <p className="text-[11px] text-gray-400 print:text-gray-600">
                  {period === 'weekly' ? 'Rotas dos últimos 7 dias' : 'Consolidado mensal de recargas'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              Total: {rechargeMovements.length}
            </span>
          </div>

          {/* Chart Display */}
          <div className="h-48 flex items-end gap-3 pt-6 px-2">
            {period === 'weekly' ? (
              weeklyStats.map((stat) => {
                const max = Math.max(...weeklyStats.map((s) => s.rechargeSentCount), 2);
                const heightPct = stat.rechargeSentCount > 0 ? (stat.rechargeSentCount / max) * 100 : 8;

                return (
                  <div key={stat.dateStr} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] font-bold text-gray-300 mb-1">
                      {stat.rechargeSentCount > 0 ? stat.rechargeSentCount : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        stat.rechargeSentCount > 0 ? 'bg-amber-500' : 'bg-[#1e2330]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="mt-2 text-[10px] text-gray-400 block truncate">
                      {stat.dayLabel.split(' ')[0]}
                    </span>
                  </div>
                );
              })
            ) : (
              monthlyStats.map((stat) => {
                const max = Math.max(...monthlyStats.map((s) => s.sentToRecharge), 2);
                const heightPct = stat.sentToRecharge > 0 ? (stat.sentToRecharge / max) * 100 : 8;

                return (
                  <div key={stat.monthKey} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] font-bold text-gray-300 mb-1">
                      {stat.sentToRecharge > 0 ? stat.sentToRecharge : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        stat.sentToRecharge > 0 ? 'bg-amber-500' : 'bg-[#1e2330]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="mt-2 text-[10px] text-gray-400 block truncate">
                      {stat.monthLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Incident Details Log Table */}
      <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm print:bg-white print:border-gray-300">
        <div className="p-4 border-b border-[#242938] print:border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-white print:text-black">
              Registro Detalhado de Extintores Utilizados em Ocorrências
            </h3>
          </div>
          <span className="text-xs text-gray-400">NBR 12962 / SESMT</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300 print:text-black">
            <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938] print:bg-gray-100 print:text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Data / Hora</th>
                <th className="px-4 py-3 font-bold">Extintor</th>
                <th className="px-4 py-3 font-bold">Patrimônio</th>
                <th className="px-4 py-3 font-bold">Local da Ocorrência</th>
                <th className="px-4 py-3 font-bold">Descrição do Princípio de Incêndio</th>
                <th className="px-4 py-3 font-bold">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202535] print:divide-gray-300">
              {incidentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Nenhuma utilização em ocorrência registrada até o momento.
                  </td>
                </tr>
              ) : (
                incidentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-[#1a1e29] transition-colors">
                    <td className="px-4 py-3 font-mono">{m.date} {m.time}</td>
                    <td className="px-4 py-3 font-bold text-white print:text-black">{m.extinguisherId}</td>
                    <td className="px-4 py-3 font-mono">{m.extinguisherPatrimony}</td>
                    <td className="px-4 py-3">{m.originLocation}</td>
                    <td className="px-4 py-3 max-w-sm text-red-300 print:text-red-800 font-medium">
                      {m.incidentDescription || m.notes}
                    </td>
                    <td className="px-4 py-3">{m.responsibleUserName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
