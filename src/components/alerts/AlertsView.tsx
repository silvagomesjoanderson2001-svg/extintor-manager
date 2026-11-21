import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  AlertOctagon,
  Clock,
  ArrowRight,
  Eye,
  ArrowLeftRight,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  AlertItem,
  Extinguisher,
} from '../../types/extinguisher';

interface AlertsViewProps {
  alerts: AlertItem[];
  extinguishers: Extinguisher[];
  onOpenNewMovement: (ext: Extinguisher) => void;
  onViewDetails: (ext: Extinguisher) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  extinguishers,
  onOpenNewMovement,
  onViewDetails,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    return true;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <span>Central Inteligente de Alertas e Vencimentos</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Diagnóstico preventivo automatizado com base na NBR 12962 e cronograma de inspeções.
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#141720] p-1 rounded-xl border border-[#272c3a]">
          <button
            onClick={() => setSeverityFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              severityFilter === 'ALL'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setSeverityFilter('CRITICAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              severityFilter === 'CRITICAL'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-gray-400 hover:text-red-400'
            }`}
          >
            Críticos ({criticalCount})
          </button>
          <button
            onClick={() => setSeverityFilter('WARNING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              severityFilter === 'WARNING'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-gray-400 hover:text-amber-400'
            }`}
          >
            Avisos ({warningCount})
          </button>
        </div>
      </div>

      {/* Primary Alerts Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/70 to-[#141720] border border-red-800/80 shadow-sm">
          <div className="flex items-center justify-between text-red-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Atenção Imediata</span>
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{criticalCount}</div>
          <p className="text-[11px] text-red-300/80 mt-1">
            Extintores vencidos, interditados ou vazios que não podem atender emergências.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/60 to-[#141720] border border-amber-800/70 shadow-sm">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vencimento Próximo</span>
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{warningCount}</div>
          <p className="text-[11px] text-amber-300/80 mt-1">
            Extintores que expiram nos próximos 30 dias. Programe a rota de recarga.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#272c3a] shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Conformidade Normativa</span>
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {extinguishers.length > 0
              ? `${(
                  ((extinguishers.length - criticalCount) / extinguishers.length) *
                  100
                ).toFixed(0)}%`
              : '100%'}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Índice de prontidão operacional da brigada contra incêndio.
          </p>
        </div>
      </div>

      {/* Alerts Cards List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#141720] border border-[#262c3c]">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Nenhum alerta pendente!</h3>
            <p className="text-xs text-gray-400 mt-1">
              Todos os extintores cadastrados estão regulares, com recarga e manutenção em dia.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const ext = extinguishers.find((e) => e.id === alert.extinguisherId);

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-gradient-to-r from-red-950/50 via-[#181a24] to-[#141720] border-red-800/80 shadow-sm'
                    : 'bg-gradient-to-r from-amber-950/40 via-[#181a24] to-[#141720] border-amber-800/70 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-red-900/60 text-red-300 border border-red-700/60'
                        : 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                    }`}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">{alert.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-950 text-red-300 border border-red-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}
                      >
                        {alert.severity === 'CRITICAL' ? 'CRÍTICO' : 'AVISO PREVENTIVO'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300">{alert.description}</p>

                    {ext && (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 pt-1 font-mono">
                        <span>Patrimônio: {ext.patrimonyNumber}</span>
                        <span>•</span>
                        <span>Local: {ext.locationDetails}</span>
                        <span>•</span>
                        <span>Condição: {ext.operationalCondition}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {ext && (
                    <>
                      <button
                        onClick={() => onViewDetails(ext)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[#202534] hover:bg-[#283042] text-gray-200 border border-[#343e57] transition-colors"
                        title="Ver prontuário do extintor"
                      >
                        <Eye className="h-3.5 w-3.5 text-gray-400" />
                        <span>Prontuário</span>
                      </button>

                      <button
                        onClick={() => onOpenNewMovement(ext)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        <span>Tratar Alerta</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
