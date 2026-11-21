import React, { useState, useEffect } from 'react';
import {
  Flame,
  Search,
  PlusCircle,
  Eye,
  Edit,
  Trash2,
  ArrowLeftRight,
  Download,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  AlertCircle,
  Archive,
  Undo2,
  X,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  Extinguisher,
  ExtinguisherType,
  OperationalCondition,
  PhysicalLocationType,
} from '../../types/extinguisher';
import {
  filterExtinguishers,
  TYPE_SHORT_LABELS,
  TYPE_LABELS,
  CONDITION_LABELS,
  getDaysDifference,
} from '../../utils/extinguisherLogic';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';

interface ExtinguisherListViewProps {
  extinguishers: Extinguisher[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onOpenNewExtinguisher: () => void;
  onOpenEditExtinguisher: (ext: Extinguisher) => void;
  onOpenNewMovement: (ext: Extinguisher) => void;
  onViewDetails: (ext: Extinguisher) => void;
  onRefresh: () => void;
  extinguisherToDeleteRequested?: Extinguisher | null;
  onClearDeleteRequest?: () => void;
}

export const ExtinguisherListView: React.FC<ExtinguisherListViewProps> = ({
  extinguishers,
  searchTerm,
  setSearchTerm,
  onOpenNewExtinguisher,
  onOpenEditExtinguisher,
  onOpenNewMovement,
  onViewDetails,
  onRefresh,
  extinguisherToDeleteRequested,
  onClearDeleteRequest,
}) => {
  const { currentUser, canCreateExtinguisher, canEditExtinguisher, canDeleteExtinguisher, canRegisterMovement } =
    useAuth();

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Deletion / Archiving confirmation modal state
  const [extinguisherToDelete, setExtinguisherToDelete] = useState<Extinguisher | null>(null);
  const [deleteMode, setDeleteMode] = useState<'ARCHIVE' | 'PERMANENT'>('ARCHIVE');
  const [deleteReason, setDeleteReason] = useState('');
  const [permanentConfirmId, setPermanentConfirmId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Sync external delete request (e.g. from ExtinguisherDetailModal)
  useEffect(() => {
    if (extinguisherToDeleteRequested) {
      setExtinguisherToDelete(extinguisherToDeleteRequested);
      setDeleteReason('');
      setDeleteError('');
      setPermanentConfirmId('');
      setDeleteMode('ARCHIVE');
      onClearDeleteRequest?.();
    }
  }, [extinguisherToDeleteRequested, onClearDeleteRequest]);

  const filteredExtinguishers = filterExtinguishers(
    extinguishers,
    searchTerm,
    typeFilter,
    locationFilter,
    conditionFilter,
    archiveFilter
  );

  const activeCount = extinguishers.filter((e) => !e.isArchived).length;
  const archivedCount = extinguishers.filter((e) => e.isArchived).length;

  const movementCountForTarget = extinguisherToDelete
    ? storageService.getExtinguisherMovementsCount(extinguisherToDelete.id)
    : 0;

  const handleDeleteOrArchiveConfirm = async () => {
    if (!extinguisherToDelete) return;

    if (!currentUser || !canDeleteExtinguisher) {
      setDeleteError('Apenas Administradores possuem autorização para excluir ou arquivar extintores.');
      return;
    }

    if (!deleteReason.trim()) {
      setDeleteError('Por favor informe a justificativa da baixa patrimonial / desativação.');
      return;
    }

    if (deleteMode === 'PERMANENT') {
      if (movementCountForTarget > 0) {
        setDeleteError('Não é permitido excluir definitivamente um extintor que já possui histórico de movimentações. Conforme as normas técnicas, utilize a opção "Arquivar / Desativar".');
        return;
      }
      if (permanentConfirmId.trim().toUpperCase() !== extinguisherToDelete.id.toUpperCase()) {
        setDeleteError(`Para confirmar a exclusão definitiva, digite "${extinguisherToDelete.id}" no campo abaixo.`);
        return;
      }

      const res = await storageService.deleteExtinguisher(extinguisherToDelete.id, currentUser, deleteReason, true);
      if (!res.success) {
        setDeleteError(res.error || 'Erro ao excluir extintor.');
        return;
      }

      setFeedbackSuccess(`O extintor ${extinguisherToDelete.id} foi excluído definitivamente do sistema com sucesso.`);
    } else {
      // Procedure: Archive / Deactivate
      const res = await storageService.archiveExtinguisher(extinguisherToDelete.id, currentUser, deleteReason);
      if (!res.success) {
        setDeleteError(res.error || 'Erro ao arquivar extintor.');
        return;
      }

      setFeedbackSuccess(`O extintor ${extinguisherToDelete.id} foi retirado dos registros ativos e arquivado com sucesso, preservando 100% de seu histórico auditável.`);
    }

    setExtinguisherToDelete(null);
    setDeleteReason('');
    setPermanentConfirmId('');
    setDeleteError('');
    onRefresh();

    setTimeout(() => {
      setFeedbackSuccess(null);
    }, 6000);
  };

  const handleUnarchive = async (ext: Extinguisher) => {
    if (!currentUser || !canDeleteExtinguisher) return;
    const res = await storageService.unarchiveExtinguisher(ext.id, currentUser);
    if (res.success) {
      setFeedbackSuccess(`O extintor ${ext.id} foi reativado com sucesso nos registros ativos.`);
      onRefresh();
      setTimeout(() => setFeedbackSuccess(null), 6000);
    }
  };

  // Export filtered list to CSV
  const handleExportCSV = () => {
    if (filteredExtinguishers.length === 0) return;

    const headers = [
      'Identificacao',
      'Patrimonio',
      'Tipo',
      'Capacidade',
      'Fabricante',
      'Numero_Serie',
      'Area',
      'Localizacao_Detalhada',
      'Condicao_Operacional',
      'Situacao_Registro',
      'Proxima_Manutencao',
      'Vencimento_Hidrostatico',
    ];

    const rows = filteredExtinguishers.map((e) => [
      `"${e.id}"`,
      `"${e.patrimonyNumber}"`,
      `"${TYPE_SHORT_LABELS[e.type]}"`,
      `"${e.capacity}"`,
      `"${e.manufacturer}"`,
      `"${e.serialNumber}"`,
      `"${e.locationArea}"`,
      `"${e.locationDetails.replace(/"/g, '""')}"`,
      `"${e.operationalCondition}"`,
      `"${e.isArchived ? 'ARQUIVADO' : 'ATIVO'}"`,
      `"${e.nextMaintenanceDate}"`,
      `"${e.hydrostaticExpirationDate}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extintores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-16 md:pb-12">
      {/* Feedback Toast Banner */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-600/80 text-emerald-200 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{feedbackSuccess}</span>
          </div>
          <button
            onClick={() => setFeedbackSuccess(null)}
            className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/50"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-500" />
            <span>Lista de Extintores Cadastrados</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gerenciamento geral, pesquisa patrimonial, fichas técnicas, movimentações e exclusão/arquivamento.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle view mode */}
          <div className="flex items-center rounded-xl bg-[#171a22] p-1 border border-[#272c3a]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-red-800 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
              title="Visualização em tabela"
              aria-label="Visualização em tabela"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-red-800 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
              title="Visualização em cartões"
              aria-label="Visualização em cartões"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1e27] text-gray-200 border border-[#2c3345] hover:bg-[#232936] hover:text-white transition-colors"
            title="Exportar dados filtrados em CSV"
          >
            <Download className="h-3.5 w-3.5 text-red-400" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          {canCreateExtinguisher && (
            <button
              onClick={onOpenNewExtinguisher}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Novo Extintor</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-xs space-y-3">
        {/* Archive Status Toggle Tabs */}
        <div className="flex items-center gap-2 border-b border-[#222838] pb-3">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
            Status do Cadastro:
          </span>
          <button
            onClick={() => setArchiveFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              archiveFilter === 'ACTIVE'
                ? 'bg-red-950 text-red-300 border border-red-700 shadow-xs'
                : 'bg-[#181c26] text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <span>Ativos em Operação</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-900/60 text-red-200 font-mono">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setArchiveFilter('ARCHIVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              archiveFilter === 'ARCHIVED'
                ? 'bg-amber-950 text-amber-300 border border-amber-700 shadow-xs'
                : 'bg-[#181c26] text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Arquivados / Desativados</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/60 text-amber-200 font-mono">
              {archivedCount}
            </span>
          </button>

          <button
            onClick={() => setArchiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              archiveFilter === 'ALL'
                ? 'bg-[#252b38] text-white border border-[#3d465c] shadow-xs'
                : 'bg-[#181c26] text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <span>Todos ({extinguishers.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick Search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por ID, patrimônio, série..."
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] py-2 pl-9 pr-3 text-xs text-white placeholder-gray-400 focus:border-red-600 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Todos os Tipos de Agente</option>
              <option value="ABC_PO">Pó Químico ABC</option>
              <option value="BC_PO">Pó Químico BC</option>
              <option value="CO2">Dióxido de Carbono (CO2)</option>
              <option value="AGUA">Água Pressurizada (AP)</option>
              <option value="ESPUMA">Espuma Mecânica</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Todas as Localizações</option>
              <option value="CAMPO">Em Campo (Postos e Setores)</option>
              <option value="ESTOQUE">Em Estoque (Almoxarifado)</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div>
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Todas as Condições</option>
              <option value="OPERACIONAL">Operacional / Pronto</option>
              <option value="EM_RECARGA">Em Recarga Externa</option>
              <option value="VAZIO">Vazio / Descarregado</option>
              <option value="INTERDITADO">Interditado / Condenado</option>
              <option value="EM_QUARENTENA">Em Quarentena</option>
            </select>
          </div>
        </div>

        {/* Counter of results */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
          <span>
            Exibindo <strong>{filteredExtinguishers.length}</strong> de <strong>{extinguishers.length}</strong> extintor(es) cadastrados
          </span>

          {(searchTerm || typeFilter !== 'ALL' || locationFilter !== 'ALL' || conditionFilter !== 'ALL' || archiveFilter !== 'ACTIVE') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('ALL');
                setLocationFilter('ALL');
                setConditionFilter('ALL');
                setArchiveFilter('ACTIVE');
              }}
              className="text-red-400 hover:text-red-300 font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Table or Cards */}
      {filteredExtinguishers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#141720] border border-[#262c3c]">
          <Flame className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Nenhum extintor encontrado</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Nenhum equipamento corresponde aos filtros aplicados. Tente ajustar os termos de busca ou mudar a visualização de status.
          </p>
          {canCreateExtinguisher && (
            <button
              onClick={onOpenNewExtinguisher}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Cadastrar Novo Extintor</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
                <tr>
                  <th className="px-4 py-3.5 font-bold">Identificação / Patr.</th>
                  <th className="px-4 py-3.5 font-bold">Tipo & Capacidade</th>
                  <th className="px-4 py-3.5 font-bold">Localização Atual</th>
                  <th className="px-4 py-3.5 font-bold">Condição / Status</th>
                  <th className="px-4 py-3.5 font-bold">Próx. Manutenção</th>
                  <th className="px-4 py-3.5 font-bold">Ensaio Hidrostático</th>
                  <th className="px-4 py-3.5 font-bold text-right">Menu de Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202535]">
                {filteredExtinguishers.map((ext) => {
                  const daysToMaint = getDaysDifference(ext.nextMaintenanceDate);
                  const daysToHydro = getDaysDifference(ext.hydrostaticExpirationDate);

                  return (
                    <tr
                      key={ext.id}
                      className={`hover:bg-[#1a1e29] transition-colors group cursor-pointer ${
                        ext.isArchived ? 'opacity-60 bg-[#0d0f14]' : ''
                      }`}
                      onClick={() => onViewDetails(ext)}
                    >
                      {/* ID & Patrimony */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold shrink-0 border ${
                              ext.isArchived
                                ? 'bg-gray-800/80 border-gray-700 text-gray-400'
                                : 'bg-red-950/60 border-red-900/50 text-red-400'
                            }`}
                          >
                            {ext.isArchived ? <Archive className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{ext.id}</span>
                            <span className="text-[10px] font-mono text-gray-400">
                              {ext.patrimonyNumber}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type & Capacity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-gray-200 block">
                          {TYPE_SHORT_LABELS[ext.type]}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {ext.capacity} • {ext.manufacturer}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="flex items-center gap-1.5 text-gray-300 truncate" title={ext.locationDetails}>
                          <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          <span className="truncate">{ext.locationDetails}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 block ml-5">
                          {ext.locationArea === 'ESTOQUE' ? 'Almoxarifado' : 'Em Campo'}
                        </span>
                      </td>

                      {/* Condition Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ext.isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-800 text-gray-300 border border-gray-600">
                            <Archive className="h-3 w-3 text-gray-400" />
                            Arquivado
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              ext.operationalCondition === 'OPERACIONAL'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                                : ext.operationalCondition === 'EM_RECARGA'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                : ext.operationalCondition === 'INTERDITADO'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                                : 'bg-red-950/80 text-red-300 border-red-800/60'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                ext.operationalCondition === 'OPERACIONAL'
                                  ? 'bg-emerald-400'
                                  : ext.operationalCondition === 'EM_RECARGA'
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                              }`}
                            />
                            {CONDITION_LABELS[ext.operationalCondition].split('/')[0]}
                          </span>
                        )}
                      </td>

                      {/* Maintenance Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-gray-200">{ext.nextMaintenanceDate}</div>
                        <div className="text-[10px]">
                          {daysToMaint < 0 ? (
                            <span className="text-red-400 font-bold">Vencido há {Math.abs(daysToMaint)}d</span>
                          ) : daysToMaint <= 30 ? (
                            <span className="text-amber-400 font-semibold">Vence em {daysToMaint}d</span>
                          ) : (
                            <span className="text-gray-400">Em {daysToMaint}d</span>
                          )}
                        </div>
                      </td>

                      {/* Hydrostatic Test */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-gray-300">{ext.hydrostaticExpirationDate}</div>
                        <div className="text-[10px]">
                          {daysToHydro < 0 ? (
                            <span className="text-rose-400 font-bold">Cilindro Vencido!</span>
                          ) : (
                            <span className="text-gray-400">Teste 5 anos</span>
                          )}
                        </div>
                      </td>

                      {/* Explicit Action Menu (Visualizar, Editar, Excluir) */}
                      <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Visualizar */}
                          <button
                            onClick={() => onViewDetails(ext)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-[#1d222e] text-gray-300 hover:text-white hover:bg-[#272e3d] border border-[#2f374a] transition-colors"
                            title="Visualizar ficha técnica e prontuário"
                            aria-label={`Visualizar extintor ${ext.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 text-gray-400" />
                            <span>Visualizar</span>
                          </button>

                          {/* 2. Movimentar (se ativo) */}
                          {canRegisterMovement && !ext.isArchived && (
                            <button
                              onClick={() => onOpenNewMovement(ext)}
                              className="p-1 rounded-lg text-gray-400 hover:text-sky-400 hover:bg-[#222838] transition-colors"
                              title="Registrar movimentação deste extintor"
                              aria-label={`Movimentar extintor ${ext.id}`}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* 3. Editar */}
                          {canEditExtinguisher && (
                            <button
                              onClick={() => onOpenEditExtinguisher(ext)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-[#222634] text-amber-300 hover:text-amber-200 hover:bg-[#2e3447] border border-amber-900/40 transition-colors"
                              title="Editar dados cadastrais"
                              aria-label={`Editar cadastro do extintor ${ext.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>Editar</span>
                            </button>
                          )}

                          {/* 4. Excluir / Arquivar ou Reativar */}
                          {ext.isArchived ? (
                            canDeleteExtinguisher && (
                              <button
                                onClick={() => handleUnarchive(ext)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/80 transition-colors"
                                title="Reativar extintor nos registros ativos"
                                aria-label={`Reativar extintor ${ext.id}`}
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                <span>Reativar</span>
                              </button>
                            )
                          ) : (
                            canDeleteExtinguisher && (
                              <button
                                onClick={() => {
                                  setExtinguisherToDelete(ext);
                                  setDeleteReason('');
                                  setPermanentConfirmId('');
                                  setDeleteError('');
                                  setDeleteMode('ARCHIVE');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/80 text-rose-300 hover:bg-rose-900 hover:text-white border border-rose-800/80 transition-colors shadow-xs"
                                title="Excluir ou arquivar extintor"
                                aria-label={`Excluir ou arquivar extintor ${ext.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                <span>Excluir</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW (Responsive for Mobile Screens) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExtinguishers.map((ext) => {
            const daysToMaint = getDaysDifference(ext.nextMaintenanceDate);

            return (
              <div
                key={ext.id}
                onClick={() => onViewDetails(ext)}
                className={`p-4 rounded-2xl bg-[#141720] border transition-all cursor-pointer shadow-sm flex flex-col justify-between group ${
                  ext.isArchived ? 'opacity-70 border-gray-700 bg-[#0e1017]' : 'border-[#262c3c] hover:border-red-800/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold shrink-0 border ${
                          ext.isArchived
                            ? 'bg-gray-800 border-gray-700 text-gray-400'
                            : 'bg-red-950/80 border-red-900/60 text-red-400'
                        }`}
                      >
                        {ext.isArchived ? <Archive className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">
                          {ext.id}
                        </h4>
                        <span className="text-[11px] font-mono text-gray-400">
                          {ext.patrimonyNumber}
                        </span>
                      </div>
                    </div>

                    {ext.isArchived ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-300 border border-gray-600">
                        Arquivado
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          ext.operationalCondition === 'OPERACIONAL'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                            : ext.operationalCondition === 'EM_RECARGA'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                        }`}
                      >
                        {CONDITION_LABELS[ext.operationalCondition].split('/')[0]}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tipo:</span>
                      <span className="font-semibold text-white">{TYPE_SHORT_LABELS[ext.type]} ({ext.capacity})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fabricante:</span>
                      <span>{ext.manufacturer}</span>
                    </div>
                    <div className="pt-1">
                      <span className="text-gray-400 text-[11px] block">Localização:</span>
                      <p className="text-xs font-medium text-white truncate" title={ext.locationDetails}>
                        {ext.locationDetails}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Card Bottom Bar with Prominent Action Menu */}
                <div className="mt-4 pt-3 border-t border-[#222838] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Próx. Manut.:</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          daysToMaint < 0
                            ? 'text-red-400'
                            : daysToMaint <= 30
                            ? 'text-amber-400'
                            : 'text-gray-300'
                        }`}
                      >
                        {ext.nextMaintenanceDate}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">
                      Série: {ext.serialNumber}
                    </span>
                  </div>

                  {/* Accessible Mobile Actions Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onViewDetails(ext)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-semibold bg-[#1d222e] text-gray-200 border border-[#2f374a] hover:bg-[#272e3d]"
                    >
                      <Eye className="h-3.5 w-3.5 text-gray-400" />
                      <span>Ver</span>
                    </button>

                    {canEditExtinguisher && (
                      <button
                        onClick={() => onOpenEditExtinguisher(ext)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-semibold bg-[#222634] text-amber-300 border border-amber-900/40 hover:bg-[#2c3345]"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>
                    )}

                    {ext.isArchived ? (
                      canDeleteExtinguisher && (
                        <button
                          onClick={() => handleUnarchive(ext)}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          <span>Reativar</span>
                        </button>
                      )
                    ) : (
                      canDeleteExtinguisher && (
                        <button
                          onClick={() => {
                            setExtinguisherToDelete(ext);
                            setDeleteReason('');
                            setPermanentConfirmId('');
                            setDeleteError('');
                            setDeleteMode('ARCHIVE');
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80 hover:bg-rose-900 hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                          <span>Excluir</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Advanced Safe Deletion / Archiving Confirmation Modal */}
      {extinguisherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#141720] border border-red-800/80 p-6 shadow-2xl text-gray-100 my-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#242b3b]">
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-2 rounded-xl bg-red-950/90 border border-red-800">
                  <ShieldAlert className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Baixa Patrimonial & Exclusão</h3>
                  <span className="text-xs text-gray-400">Controle e rastreabilidade conforme ABNT NBR 12962</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setExtinguisherToDelete(null);
                  setDeleteReason('');
                  setDeleteError('');
                }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f2533]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target Equipment Data Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#1b1f2b] border border-[#2d3648] space-y-1.5 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-[#252c3c]">
                <span className="text-gray-400 font-semibold">Identificação:</span>
                <span className="font-mono text-sm font-bold text-red-400">{extinguisherToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Número Patrimonial:</span>
                <span className="font-bold text-white">{extinguisherToDelete.patrimonyNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tipo & Capacidade:</span>
                <span className="text-gray-200">
                  {TYPE_LABELS[extinguisherToDelete.type]} ({extinguisherToDelete.capacity})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fabricante / Série:</span>
                <span className="text-gray-200">{extinguisherToDelete.manufacturer} • {extinguisherToDelete.serialNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Localização Atual:</span>
                <span className="text-gray-200 truncate max-w-[240px]">{extinguisherToDelete.locationDetails}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Condição Operacional:</span>
                <span className="text-white font-medium">{CONDITION_LABELS[extinguisherToDelete.operationalCondition]}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#252c3c]">
                <span className="text-gray-400 font-semibold">Movimentações no Histórico:</span>
                <span className={`font-bold ${movementCountForTarget > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {movementCountForTarget} registro(s)
                </span>
              </div>
            </div>

            {/* History Preservation Notice & Procedure Selection */}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-white">
                Selecione o Procedimento Desejado:
              </label>

              {/* Procedure 1: Arquivar / Desativar */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  deleteMode === 'ARCHIVE'
                    ? 'bg-red-950/40 border-red-600 ring-1 ring-red-600'
                    : 'bg-[#181c26] border-[#293040] hover:bg-[#1e2330]'
                }`}
              >
                <input
                  type="radio"
                  name="deleteProcedure"
                  checked={deleteMode === 'ARCHIVE'}
                  onChange={() => setDeleteMode('ARCHIVE')}
                  className="mt-0.5 accent-red-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Archive className="h-4 w-4 text-amber-400" />
                    <span>Arquivar / Desativar Equipamento (Recomendado)</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-1">
                    Retira o extintor dos registros ativos, do saldo de estoque e do cálculo operacional, <strong>preservando integralmente seu histórico de movimentações</strong> e prontuário para auditoria.
                  </p>
                </div>
              </label>

              {/* Procedure 2: Excluir Definitivamente */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  movementCountForTarget > 0
                    ? 'opacity-60 bg-[#12141c] border-[#222838] cursor-not-allowed'
                    : deleteMode === 'PERMANENT'
                    ? 'bg-rose-950/60 border-rose-600 ring-1 ring-rose-600 cursor-pointer'
                    : 'bg-[#181c26] border-[#293040] hover:bg-[#1e2330] cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="deleteProcedure"
                  disabled={movementCountForTarget > 0}
                  checked={deleteMode === 'PERMANENT'}
                  onChange={() => setDeleteMode('PERMANENT')}
                  className="mt-0.5 accent-rose-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4 text-rose-400" />
                    <span>Excluir Definitivamente da Base</span>
                    {movementCountForTarget > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        Bloqueado (possui histórico)
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-[11px] mt-1">
                    {movementCountForTarget > 0
                      ? 'Não permitido: extintores com movimentações, recargas ou ocorrências não podem ser apagados definitivamente para manter a conformidade legal (ABNT NBR 12962). Utilize o Arquivamento acima.'
                      : 'Remove todos os registros deste extintor da base. Permitido exclusivamente quando não houver histórico associado.'}
                  </p>
                </div>
              </label>
            </div>

            {/* Error banner */}
            {deleteError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Permanent Confirmation Input (Only if PERMANENT chosen) */}
            {deleteMode === 'PERMANENT' && movementCountForTarget === 0 && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-1.5">
                <label className="block text-xs font-bold text-rose-300">
                  Confirmação de Segurança do Administrador *
                </label>
                <p className="text-[11px] text-gray-400">
                  Digite a identificação <strong className="text-white font-mono">{extinguisherToDelete.id}</strong> para autorizar a exclusão definitiva:
                </p>
                <input
                  type="text"
                  value={permanentConfirmId}
                  onChange={(e) => setPermanentConfirmId(e.target.value)}
                  placeholder={extinguisherToDelete.id}
                  className="w-full rounded-xl bg-[#171a24] border border-rose-700 p-2 text-xs text-white uppercase font-mono focus:outline-none"
                />
              </div>
            )}

            {/* Justification Textarea */}
            <div className="mt-3.5">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Justificativa Obrigatória da Operação *
              </label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder={
                  deleteMode === 'ARCHIVE'
                    ? 'Ex: Baixa por fim de vida útil de 20 anos, cilindro condenado em laudo técnico...'
                    : 'Ex: Cadastro duplicado efetuado por engano sem movimentações registradas...'
                }
                className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                required
              />
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-[#242b3b]">
              <button
                type="button"
                onClick={() => {
                  setExtinguisherToDelete(null);
                  setDeleteReason('');
                  setPermanentConfirmId('');
                  setDeleteError('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1f2533] transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteOrArchiveConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                  deleteMode === 'PERMANENT'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/70'
                    : 'bg-red-700 hover:bg-red-600 shadow-red-950/70'
                }`}
              >
                {deleteMode === 'PERMANENT' ? 'Confirmar Exclusão Definitiva' : 'Confirmar Arquivamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
