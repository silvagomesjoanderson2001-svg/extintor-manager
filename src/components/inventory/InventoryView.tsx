import React, { useState } from 'react';
import {
  Boxes,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  MapPin,
  Eye,
  ArrowLeftRight,
} from 'lucide-react';
import {
  Extinguisher,
  Movement,
} from '../../types/extinguisher';
import {
  computeStockSummary,
  TYPE_SHORT_LABELS,
  TYPE_LABELS,
  StockTypeSummary,
  CONDITION_LABELS,
} from '../../utils/extinguisherLogic';

interface InventoryViewProps {
  extinguishers: Extinguisher[];
  movements: Movement[];
  onOpenNewMovement: (ext?: Extinguisher) => void;
  onViewDetails: (ext: Extinguisher) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  extinguishers,
  movements,
  onOpenNewMovement,
  onViewDetails,
}) => {
  const stockSummaries: StockTypeSummary[] = computeStockSummary(extinguishers);

  // Extinguishers currently in physical stock
  const stockExtinguishers = extinguishers.filter((e) => e.locationArea === 'ESTOQUE');

  // Stock movements (Entradas e Saídas de estoque)
  const stockMovements = movements.filter(
    (m) =>
      m.movementType === 'ENTRADA_ESTOQUE' ||
      m.movementType === 'RETORNO_ESTOQUE' ||
      m.movementType === 'RETORNO_RECARGA' ||
      m.movementType === 'SAIDA_CAMPO' ||
      m.movementType === 'ENVIO_RECARGA'
  );

  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'extinguishers' | 'history'>('summary');

  const totalInStock = stockExtinguishers.length;
  const operationalInStock = stockExtinguishers.filter((e) => e.operationalCondition === 'OPERACIONAL').length;
  const emptyInStock = stockExtinguishers.filter((e) => e.operationalCondition === 'VAZIO').length;
  const interdictedInStock = stockExtinguishers.filter((e) => e.operationalCondition === 'INTERDITADO').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Boxes className="h-6 w-6 text-red-500" />
            <span>Controle de Estoque & Reserva Técnica</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gestão do almoxarifado central, balanço de cargas e disponibilidade para substituição imediata.
          </p>
        </div>

        <button
          onClick={() => onOpenNewMovement()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all self-start sm:self-auto"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Movimentar Estoque</span>
        </button>
      </div>

      {/* Primary Stock Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Total no Almoxarifado</span>
          <span className="text-3xl font-extrabold text-white font-mono">{totalInStock}</span>
          <span className="text-[11px] text-gray-400 block mt-1">Todas as condições</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-emerald-400 font-semibold block mb-1">Prontos p/ Distribuição</span>
          <span className="text-3xl font-extrabold text-emerald-400 font-mono">{operationalInStock}</span>
          <span className="text-[11px] text-emerald-300/80 block mt-1">Reserva técnica ativa</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-rose-400 font-semibold block mb-1">Vazios no Almoxarifado</span>
          <span className="text-3xl font-extrabold text-rose-400 font-mono">{emptyInStock}</span>
          <span className="text-[11px] text-rose-300/80 block mt-1">Aguardando envio à recarga</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-amber-400 font-semibold block mb-1">Interditados / Quarentena</span>
          <span className="text-3xl font-extrabold text-amber-400 font-mono">{interdictedInStock}</span>
          <span className="text-[11px] text-amber-300/80 block mt-1">Aguardando laudo/descarte</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#242938] pb-1">
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeSubTab === 'summary'
              ? 'bg-red-900/80 text-white border border-red-700/60'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Balanço por Tipo & Reserva
        </button>
        <button
          onClick={() => setActiveSubTab('extinguishers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeSubTab === 'extinguishers'
              ? 'bg-red-900/80 text-white border border-red-700/60'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Extintores Estocados ({stockExtinguishers.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeSubTab === 'history'
              ? 'bg-red-900/80 text-white border border-red-700/60'
              : 'text-gray-400 hover:text-white hover:bg-[#1a1e27]'
          }`}
        >
          Histórico de Entradas e Saídas ({stockMovements.length})
        </button>
      </div>

      {/* Tab 1: Summary by Type */}
      {activeSubTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockSummaries.map((summary) => {
            const hasStock = summary.operationalStock > 0;
            const isCritical = summary.reserveStatus === 'CRITICAL';
            const isLow = summary.reserveStatus === 'LOW';

            return (
              <div
                key={summary.type}
                className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#222838] mb-3">
                    <span className="font-bold text-white text-sm">{summary.typeName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isCritical
                          ? 'bg-red-950 text-red-300 border-red-700'
                          : isLow
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      {isCritical ? 'Reserva Crítica' : isLow ? 'Estoque Baixo' : 'Reserva Adequada'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total do Tipo na Empresa:</span>
                      <span className="font-mono font-bold text-white">{summary.total} un</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Alocados em Campo:</span>
                      <span className="font-mono text-sky-400">{summary.inField} un</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Em Manutenção/Recarga:</span>
                      <span className="font-mono text-amber-400">{summary.inRecharge} un</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-[#222838]">
                      <span className="text-emerald-400">Disponíveis no Estoque:</span>
                      <span className="font-mono text-base font-bold text-emerald-400">
                        {summary.operationalStock} un
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Reserva Mínima Sugerida:</span>
                      <span className="font-mono">{summary.recommendedReserve} un</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#222838]">
                  <button
                    onClick={() => onOpenNewMovement()}
                    className="w-full py-2 px-3 rounded-xl bg-[#1b202c] hover:bg-[#232938] text-xs font-semibold text-gray-200 border border-[#2c3447] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-red-400" />
                    <span>Movimentar este Tipo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Stock Extinguishers Table */}
      {activeSubTab === 'extinguishers' && (
        <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
                <tr>
                  <th className="px-4 py-3.5 font-bold">Identificação</th>
                  <th className="px-4 py-3.5 font-bold">Patrimônio</th>
                  <th className="px-4 py-3.5 font-bold">Tipo & Capacidade</th>
                  <th className="px-4 py-3.5 font-bold">Prateleira / Localização</th>
                  <th className="px-4 py-3.5 font-bold">Condição</th>
                  <th className="px-4 py-3.5 font-bold">Próx. Manutenção</th>
                  <th className="px-4 py-3.5 font-bold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202535]">
                {stockExtinguishers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Nenhum extintor atualmente no estoque central.
                    </td>
                  </tr>
                ) : (
                  stockExtinguishers.map((ext) => (
                    <tr key={ext.id} className="hover:bg-[#1a1e29] transition-colors">
                      <td className="px-4 py-3 font-bold text-white font-mono">{ext.id}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{ext.patrimonyNumber}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{TYPE_SHORT_LABELS[ext.type]}</span>
                        <span className="text-[11px] text-gray-400">{ext.capacity}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{ext.locationDetails}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            ext.operationalCondition === 'OPERACIONAL'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-red-950 text-red-300 border-red-700'
                          }`}
                        >
                          {CONDITION_LABELS[ext.operationalCondition].split('/')[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">{ext.nextMaintenanceDate}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onViewDetails(ext)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202535]"
                            title="Ver ficha"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onOpenNewMovement(ext)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-sky-400 hover:bg-[#202535]"
                            title="Saída para campo / Envio"
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Movements History */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
                <tr>
                  <th className="px-4 py-3.5 font-bold">Data & Hora</th>
                  <th className="px-4 py-3.5 font-bold">Sentido</th>
                  <th className="px-4 py-3.5 font-bold">Extintor</th>
                  <th className="px-4 py-3.5 font-bold">Origem → Destino</th>
                  <th className="px-4 py-3.5 font-bold">Responsável</th>
                  <th className="px-4 py-3.5 font-bold">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202535]">
                {stockMovements.map((m) => {
                  const isEntrada =
                    m.movementType === 'ENTRADA_ESTOQUE' ||
                    m.movementType === 'RETORNO_ESTOQUE' ||
                    m.movementType === 'RETORNO_RECARGA';

                  return (
                    <tr key={m.id} className="hover:bg-[#1a1e29] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-300">
                        {m.date} {m.time}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isEntrada
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : 'bg-amber-950/80 text-amber-300 border-amber-700'
                          }`}
                        >
                          {isEntrada ? (
                            <>
                              <ArrowDownLeft className="h-3 w-3" />
                              <span>Entrada Estoque</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3 w-3" />
                              <span>Saída Estoque</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-white font-mono">
                        {m.extinguisherId} ({m.extinguisherPatrimony})
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                        {m.originLocation} → {m.destinationLocation}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                        {m.responsibleUserName}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate" title={m.notes}>
                        {m.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
