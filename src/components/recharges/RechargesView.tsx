import React, { useState } from 'react';
import {
  RefreshCw,
  AlertOctagon,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeftRight,
  Calendar,
  Building,
  ShieldCheck,
  Eye,
  FileCheck,
} from 'lucide-react';
import { Extinguisher, Movement } from '../../types/extinguisher';
import { TYPE_SHORT_LABELS, CONDITION_LABELS } from '../../utils/extinguisherLogic';

interface RechargesViewProps {
  extinguishers: Extinguisher[];
  movements: Movement[];
  onOpenNewMovement: (ext?: Extinguisher) => void;
  onViewDetails: (ext: Extinguisher) => void;
}

export const RechargesView: React.FC<RechargesViewProps> = ({
  extinguishers,
  movements,
  onOpenNewMovement,
  onViewDetails,
}) => {
  // Extinguishers currently in recharge
  const inRechargeList = extinguishers.filter((e) => e.operationalCondition === 'EM_RECARGA');

  // Extinguishers empty / discharged needing recharge
  const emptyList = extinguishers.filter((e) => e.operationalCondition === 'VAZIO');

  // Historical recharge movements
  const rechargeHistory = movements.filter(
    (m) => m.movementType === 'ENVIO_RECARGA' || m.movementType === 'RETORNO_RECARGA'
  );

  const [activeTab, setActiveTab] = useState<'current' | 'empty' | 'history'>('current');

  return (
    <div className="space-y-6 pb-20 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-amber-500" />
            <span>Gestão de Recargas & Manutenção Externa</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Controle de lotes enviados para oficinas credenciadas Inmetro, prazos de retorno e laudos de ensaio.
          </p>
        </div>

        <button
          onClick={() => onOpenNewMovement()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all self-start sm:self-auto"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Nova Movimentação de Recarga</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-amber-400 font-semibold block mb-1">Em Recarga Externa</span>
          <span className="text-3xl font-extrabold text-amber-400 font-mono">{inRechargeList.length}</span>
          <span className="text-[11px] text-gray-400 block mt-1">Na oficina credenciada</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-rose-400 font-semibold block mb-1">Vazios / Descarregados</span>
          <span className="text-3xl font-extrabold text-rose-400 font-mono">{emptyList.length}</span>
          <span className="text-[11px] text-rose-300/80 block mt-1">Requerem envio urgente</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-emerald-400 font-semibold block mb-1">Histórico de Recargas</span>
          <span className="text-3xl font-extrabold text-emerald-400 font-mono">{rechargeHistory.length}</span>
          <span className="text-[11px] text-emerald-300/80 block mt-1">Registros totais no sistema</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Prestadores Ativos</span>
          <span className="text-3xl font-extrabold text-white font-mono">2</span>
          <span className="text-[11px] text-gray-400 block mt-1">HidroPress & Credenciadas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#242938] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'current'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Equipamentos em Recarga ({inRechargeList.length})
        </button>
        <button
          onClick={() => setActiveTab('empty')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'empty'
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Vazios Aguardando Despacho ({emptyList.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'history'
              ? 'bg-red-950/80 text-red-300 border border-red-700/80'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Histórico de Envios e Retornos ({rechargeHistory.length})
        </button>
      </div>

      {/* Tab 1: In Recharge List */}
      {activeTab === 'current' && (
        <div className="space-y-3">
          {inRechargeList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#141720] border border-[#262c3c]">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-base font-bold text-white">Nenhum extintor em recarga no momento</h3>
              <p className="text-xs text-gray-400 mt-1">Todos os equipamentos estão alocados em campo ou na reserva técnica do estoque.</p>
            </div>
          ) : (
            inRechargeList.map((ext) => (
              <div
                key={ext.id}
                className="p-4 rounded-2xl bg-[#141720] border border-amber-900/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ext.id}</span>
                    <span className="text-xs font-mono text-gray-400">({ext.patrimonyNumber})</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                      EM RECARGA
                    </span>
                    <span className="text-[11px] text-gray-400">{TYPE_SHORT_LABELS[ext.type]} ({ext.capacity})</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    <span className="text-gray-400">Local Atual / Prestador:</span> {ext.locationDetails}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
                    <span>Série: {ext.serialNumber}</span>
                    <span>•</span>
                    <span>Fabricante: {ext.manufacturer}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onViewDetails(ext)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1e2330] hover:bg-[#282f42] text-gray-200 border border-[#353f56] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Ficha</span>
                  </button>
                  <button
                    onClick={() => onOpenNewMovement(ext)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white shadow-md shadow-emerald-950/70 transition-all"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Registrar Retorno da Recarga</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Empty List */}
      {activeTab === 'empty' && (
        <div className="space-y-3">
          {emptyList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#141720] border border-[#262c3c]">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-base font-bold text-white">Nenhum extintor vazio / descarregado</h3>
              <p className="text-xs text-gray-400 mt-1">Todos os equipamentos estão carregados e pressurizados.</p>
            </div>
          ) : (
            emptyList.map((ext) => (
              <div
                key={ext.id}
                className="p-4 rounded-2xl bg-[#141720] border border-rose-900/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ext.id}</span>
                    <span className="text-xs font-mono text-gray-400">({ext.patrimonyNumber})</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700">
                      VAZIO / DESPRESSURIZADO
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">
                    <span className="text-gray-400">Localização atual:</span> {ext.locationDetails}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {ext.notes || 'Equipamento descarregado aguardando envio para empresa de recarga.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onViewDetails(ext)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1e2330] hover:bg-[#282f42] text-gray-200 border border-[#353f56] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Ficha</span>
                  </button>
                  <button
                    onClick={() => onOpenNewMovement(ext)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white shadow-md shadow-amber-950/70 transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Enviar para Recarga</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
                <tr>
                  <th className="px-4 py-3.5 font-bold">Data & Hora</th>
                  <th className="px-4 py-3.5 font-bold">Tipo</th>
                  <th className="px-4 py-3.5 font-bold">Extintor</th>
                  <th className="px-4 py-3.5 font-bold">Destino / Prestador</th>
                  <th className="px-4 py-3.5 font-bold">Responsável</th>
                  <th className="px-4 py-3.5 font-bold">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202535]">
                {rechargeHistory.map((m) => (
                  <tr key={m.id} className="hover:bg-[#1a1e29] transition-colors">
                    <td className="px-4 py-3 font-mono">{m.date} {m.time}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.movementType === 'ENVIO_RECARGA'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}
                      >
                        {m.movementType === 'ENVIO_RECARGA' ? 'Envio para Recarga' : 'Retorno da Recarga'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-white font-mono">{m.extinguisherId} ({m.extinguisherPatrimony})</td>
                    <td className="px-4 py-3 text-gray-200">{m.destinationLocation}</td>
                    <td className="px-4 py-3 text-gray-400">{m.responsibleUserName}</td>
                    <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{m.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
