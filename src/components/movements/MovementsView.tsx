import React, { useState } from 'react';
import {
  ArrowLeftRight,
  PlusCircle,
  Search,
  Filter,
  Calendar,
  Clock,
  UserCheck,
  MapPin,
  AlertOctagon,
  Flame,
  CheckCircle2,
  RefreshCw,
  Boxes,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import {
  Extinguisher,
  Movement,
  MovementType,
} from '../../types/extinguisher';
import {
  MOVEMENT_TYPE_LABELS,
  TYPE_SHORT_LABELS,
} from '../../utils/extinguisherLogic';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';

interface MovementsViewProps {
  movements: Movement[];
  extinguishers: Extinguisher[];
  isNewMovementModalOpen: boolean;
  setIsNewMovementModalOpen: (open: boolean) => void;
  preSelectedExtinguisher?: Extinguisher | null;
  onRefresh: () => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  movements,
  extinguishers,
  isNewMovementModalOpen,
  setIsNewMovementModalOpen,
  preSelectedExtinguisher,
  onRefresh,
}) => {
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // New Movement Form state
  const [selectedExtId, setSelectedExtId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('SAIDA_CAMPO');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [rechargeNextMaintenanceDate, setRechargeNextMaintenanceDate] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync pre-selected extinguisher when modal opens
  React.useEffect(() => {
    if (isNewMovementModalOpen) {
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setTime(now.toTimeString().slice(0, 5));

      if (preSelectedExtinguisher) {
        setSelectedExtId(preSelectedExtinguisher.id);
        if (preSelectedExtinguisher.locationArea === 'ESTOQUE') {
          setMovementType('SAIDA_CAMPO');
          setDestinationLocation('Bloco A - Posto de Combate');
        } else {
          setMovementType('ENVIO_RECARGA');
          setDestinationLocation('Prestador de Serviços HidroPress');
        }
      } else if (extinguishers.length > 0 && !selectedExtId) {
        setSelectedExtId(extinguishers[0].id);
        setDestinationLocation('Almoxarifado Central');
      }
      setNotes('');
      setIncidentDescription('');
      setFormError('');
    }
  }, [isNewMovementModalOpen, preSelectedExtinguisher, extinguishers]);

  // Set smart destination recommendation when movementType changes
  const handleMovementTypeChange = (newType: MovementType) => {
    setMovementType(newType);
    switch (newType) {
      case 'ENTRADA_ESTOQUE':
      case 'RETORNO_ESTOQUE':
        setDestinationLocation('Almoxarifado Central - Prateleira Reserva');
        break;
      case 'SAIDA_CAMPO':
        setDestinationLocation('Galpão Industrial - Setor Operacional');
        break;
      case 'ENVIO_RECARGA':
        setDestinationLocation('Empresa Credenciada de Recarga & Testes');
        break;
      case 'RETORNO_RECARGA':
        setDestinationLocation('Almoxarifado Central - Prateleira Aprovados');
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setRechargeNextMaintenanceDate(nextYear.toISOString().split('T')[0]);
        break;
      case 'UTILIZACAO':
        setDestinationLocation('Oficina de Manutenção (Descarregado)');
        break;
      case 'INTERDICAO':
        setDestinationLocation('Área de Quarentena / Descarte');
        break;
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!currentUser) {
      setFormError('Sessão de usuário não encontrada. Faça login para registrar movimentações.');
      return;
    }
    if (!selectedExtId) {
      setFormError('Selecione o extintor para movimentar.');
      return;
    }
    if (!destinationLocation.trim()) {
      setFormError('Informe o local de destino do equipamento.');
      return;
    }
    if (!notes.trim()) {
      setFormError('Informe a observação ou justificativa da movimentação.');
      return;
    }

    setIsSubmitting(true);

    const res = await storageService.registerMovement({
      extinguisherId: selectedExtId,
      movementType,
      destinationLocation: destinationLocation.trim(),
      responsibleUser: currentUser,
      notes: notes.trim(),
      incidentDescription: movementType === 'UTILIZACAO' ? incidentDescription.trim() : undefined,
      date,
      time,
      rechargeNextMaintenanceDate:
        movementType === 'RETORNO_RECARGA' && rechargeNextMaintenanceDate
          ? rechargeNextMaintenanceDate
          : undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || 'Erro ao registrar movimentação.');
      return;
    }

    setIsNewMovementModalOpen(false);
    onRefresh();
  };

  // Filter movements
  const filteredMovements = movements.filter((m) => {
    if (typeFilter !== 'ALL' && m.movementType !== typeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchExt = m.extinguisherId.toLowerCase().includes(term);
      const matchPat = m.extinguisherPatrimony.toLowerCase().includes(term);
      const matchDest = m.destinationLocation.toLowerCase().includes(term);
      const matchUser = m.responsibleUserName.toLowerCase().includes(term);
      const matchNote = m.notes.toLowerCase().includes(term);
      if (!matchExt && !matchPat && !matchDest && !matchUser && !matchNote) return false;
    }
    return true;
  });

  // Calculate quick metrics
  const totalCount = movements.length;
  const incidentCount = movements.filter((m) => m.movementType === 'UTILIZACAO').length;
  const rechargeCount = movements.filter((m) => m.movementType === 'ENVIO_RECARGA').length;
  const fieldCount = movements.filter((m) => m.movementType === 'SAIDA_CAMPO').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-red-500" />
            <span>Registro e Rastreamento de Movimentações</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Histórico auditado de entradas, saídas para campo, recargas e ocorrências de uso.
          </p>
        </div>

        <button
          onClick={() => setIsNewMovementModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Nova Movimentação</span>
        </button>
      </div>

      {/* Metric Mini-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Total de Movimentos</span>
          <span className="text-2xl font-bold text-white font-mono">{totalCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Saídas para Campo</span>
          <span className="text-2xl font-bold text-sky-400 font-mono">{fieldCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Envios para Recarga</span>
          <span className="text-2xl font-bold text-amber-400 font-mono">{rechargeCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-xs text-gray-400 block mb-1">Uso em Ocorrências</span>
          <span className="text-2xl font-bold text-red-400 font-mono">{incidentCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por extintor, patrimônio, destino, responsável ou observação..."
            className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] py-2 pl-9 pr-3 text-xs text-white placeholder-gray-400 focus:border-red-600 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
          >
            <option value="ALL">Todos os Tipos de Movimento</option>
            <option value="ENTRADA_ESTOQUE">Entrada no Estoque</option>
            <option value="SAIDA_CAMPO">Saída para Campo</option>
            <option value="RETORNO_ESTOQUE">Retorno ao Estoque</option>
            <option value="ENVIO_RECARGA">Envio para Recarga</option>
            <option value="RETORNO_RECARGA">Retorno da Recarga</option>
            <option value="UTILIZACAO">Utilização em Ocorrência</option>
            <option value="INTERDICAO">Interdição</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
              <tr>
                <th className="px-4 py-3.5 font-bold">Data & Hora</th>
                <th className="px-4 py-3.5 font-bold">Equipamento</th>
                <th className="px-4 py-3.5 font-bold">Tipo de Movimentação</th>
                <th className="px-4 py-3.5 font-bold">Origem → Destino</th>
                <th className="px-4 py-3.5 font-bold">Responsável</th>
                <th className="px-4 py-3.5 font-bold">Observações / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202535]">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma movimentação encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  return (
                    <tr key={m.id} className="hover:bg-[#1a1e29] transition-colors">
                      {/* Date & Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-white font-medium">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>{m.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono ml-5">
                          <Clock className="h-3 w-3" />
                          <span>{m.time}</span>
                        </div>
                      </td>

                      {/* Equipment */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-950/80 text-red-400 font-bold shrink-0">
                            <Flame className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">{m.extinguisherId}</span>
                            <span className="text-[10px] font-mono text-gray-400">
                              {m.extinguisherPatrimony} • {TYPE_SHORT_LABELS[m.extinguisherType]}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            m.movementType === 'UTILIZACAO'
                              ? 'bg-red-950/90 text-red-300 border-red-700'
                              : m.movementType === 'ENVIO_RECARGA'
                              ? 'bg-amber-950/90 text-amber-300 border-amber-700'
                              : m.movementType === 'SAIDA_CAMPO'
                              ? 'bg-sky-950/90 text-sky-300 border-sky-700'
                              : m.movementType === 'INTERDICAO'
                              ? 'bg-rose-950/90 text-rose-300 border-rose-700'
                              : 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                          }`}
                        >
                          {MOVEMENT_TYPE_LABELS[m.movementType] || m.movementType}
                        </span>
                      </td>

                      {/* Origin and Destination */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-[11px] text-gray-400 truncate" title={m.originLocation}>
                          De: {m.originLocation}
                        </div>
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1" title={m.destinationLocation}>
                          <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                          <span>{m.destinationLocation}</span>
                        </div>
                      </td>

                      {/* Responsible */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium text-gray-200">{m.responsibleUserName}</span>
                        </div>
                      </td>

                      {/* Notes / Incident Description */}
                      <td className="px-4 py-3 max-w-xs">
                        {m.incidentDescription && (
                          <div className="text-[11px] font-semibold text-red-400 mb-0.5">
                            Ocorrência: {m.incidentDescription}
                          </div>
                        )}
                        <p className="text-xs text-gray-300 truncate" title={m.notes}>
                          {m.notes}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Movement Modal */}
      {isNewMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#13161f] border border-[#272e3f] shadow-2xl text-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#242b3b] bg-[#0d0f15]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800/60">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Registrar Movimentação de Extintor</h2>
                  <p className="text-xs text-gray-400">
                    Atualiza localização física e condição operacional automaticamente
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsNewMovementModalOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f2533]"
              >
                ✕
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs">
                {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveMovement} className="p-6 space-y-4">
              {/* Select Extinguisher */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Selecione o Extintor *
                </label>
                <select
                  value={selectedExtId}
                  onChange={(e) => setSelectedExtId(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2.5 text-xs text-white focus:border-red-600 focus:outline-none"
                  required
                >
                  <option value="">Selecione um equipamento...</option>
                  {extinguishers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id} - Patr: {e.patrimonyNumber} | {TYPE_SHORT_LABELS[e.type]} ({e.capacity}) - Atual: {e.locationDetails} [{e.operationalCondition}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Tipo de Movimentação *
                  </label>
                  <select
                    value={movementType}
                    onChange={(e) => handleMovementTypeChange(e.target.value as MovementType)}
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
                  >
                    <option value="ENTRADA_ESTOQUE">Entrada no Estoque</option>
                    <option value="SAIDA_CAMPO">Saída para Campo</option>
                    <option value="RETORNO_ESTOQUE">Retorno ao Estoque</option>
                    <option value="ENVIO_RECARGA">Envio para Recarga</option>
                    <option value="RETORNO_RECARGA">Retorno da Recarga</option>
                    <option value="UTILIZACAO">Utilização em Ocorrência</option>
                    <option value="INTERDICAO">Interdição</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Localização de Destino *
                  </label>
                  <input
                    type="text"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                    placeholder="Ex: Bloco B - 2º Andar ou Almoxarifado Central"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Data da Movimentação *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Hora da Movimentação *
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* If Retorno da Recarga, allow setting next maintenance */}
              {movementType === 'RETORNO_RECARGA' && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60">
                  <label className="block text-xs font-semibold text-amber-200 mb-1">
                    Nova Data de Próxima Manutenção (Garantia da Recarga)
                  </label>
                  <input
                    type="date"
                    value={rechargeNextMaintenanceDate}
                    onChange={(e) => setRechargeNextMaintenanceDate(e.target.value)}
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    O extintor será reativado como "Operacional" no estoque com a recarga renovada.
                  </p>
                </div>
              )}

              {/* If Utilização em Ocorrência */}
              {movementType === 'UTILIZACAO' && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60">
                  <label className="block text-xs font-semibold text-red-200 mb-1">
                    Descrição Detalhada do Princípio de Incêndio / Ocorrência *
                  </label>
                  <textarea
                    rows={2}
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    placeholder="Descreva o local da ocorrência, classe do fogo, agente combatido e se a carga foi total ou parcialmente expelida..."
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2 text-xs text-white focus:border-red-600 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-red-300/80 mt-1">
                    O extintor será automaticamente marcado como "Vazio / Descarregado" no sistema.
                  </p>
                </div>
              )}

              {/* Responsible User Info & Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Observações Técnicas & Motivo *
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais, número de guia de remessa, OS ou ordem de serviço..."
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-[#171b26] border border-[#272f42] text-xs flex items-center justify-between text-gray-300">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-red-400" />
                  <span>Responsável pelo registro: <strong>{currentUser?.name || 'Usuário'}</strong> ({currentUser?.role || '-'})</span>
                </div>
              </div>

              {/* Submit buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242b3b]">
                <button
                  type="button"
                  onClick={() => setIsNewMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>{isSubmitting ? 'Gravando...' : 'Confirmar e Registrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
