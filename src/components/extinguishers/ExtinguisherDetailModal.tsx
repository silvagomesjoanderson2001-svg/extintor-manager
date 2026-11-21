import React from 'react';
import {
  X,
  Flame,
  Printer,
  Calendar,
  MapPin,
  ShieldAlert,
  ArrowLeftRight,
  Edit,
  Tag,
  CheckCircle2,
  AlertTriangle,
  History,
  QrCode,
  Trash2,
} from 'lucide-react';
import { Extinguisher, Movement } from '../../types/extinguisher';
import {
  TYPE_LABELS,
  CONDITION_LABELS,
  getDaysDifference,
  MOVEMENT_TYPE_LABELS,
} from '../../utils/extinguisherLogic';
import { useAuth } from '../../context/AuthContext';

interface ExtinguisherDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  extinguisher: Extinguisher | null;
  movements: Movement[];
  onEdit: (extinguisher: Extinguisher) => void;
  onNewMovement: (extinguisher: Extinguisher) => void;
  onDelete?: (extinguisher: Extinguisher) => void;
}

export const ExtinguisherDetailModal: React.FC<ExtinguisherDetailModalProps> = ({
  isOpen,
  onClose,
  extinguisher,
  movements,
  onEdit,
  onNewMovement,
  onDelete,
}) => {
  const { canEditExtinguisher, canRegisterMovement, canDeleteExtinguisher } = useAuth();

  if (!isOpen || !extinguisher) return null;

  // Filter movements for this specific extinguisher
  const extMovements = movements.filter((m) => m.extinguisherId === extinguisher.id);

  const daysToMaint = getDaysDifference(extinguisher.nextMaintenanceDate);
  const daysToHydro = getDaysDifference(extinguisher.hydrostaticExpirationDate);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#13161f] border border-[#272e3f] shadow-2xl text-gray-100 overflow-hidden print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242b3b] bg-[#0d0f15] print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800/60">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Prontuário Individual</h2>
                <span className="font-mono text-sm px-2 py-0.5 rounded bg-black/60 text-red-400 border border-red-900/60 font-bold">
                  {extinguisher.id}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Ficha técnica oficial e histórico de rastreabilidade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1d222e] text-gray-200 border border-[#2c3446] hover:bg-[#252b38] hover:text-white transition-colors"
              title="Imprimir prontuário técnico"
            >
              <Printer className="h-3.5 w-3.5 text-gray-400" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f2533] transition-colors"
              aria-label="Fechar ficha"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Header */}
        <div className="hidden print:block p-6 border-b border-gray-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-red-800 tracking-tight">EXTINTORES MANAGER</h1>
              <p className="text-xs text-gray-600 font-semibold uppercase">Ficha Técnica e Prontuário de Extintor de Incêndio</p>
              <p className="text-[10px] text-gray-500">Conformidade Normativa ABNT NBR 12962 / NBR 15808</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold font-mono">{extinguisher.id}</div>
              <div className="text-xs text-gray-600">Patrimônio: {extinguisher.patrimonyNumber}</div>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Photo & QR Code Card */}
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-[#272e3f] bg-[#1a1e29] aspect-square flex items-center justify-center relative print:border-gray-300">
                {extinguisher.photoUrl ? (
                  <img
                    src={extinguisher.photoUrl}
                    alt={extinguisher.id}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Flame className="h-16 w-16 text-red-500 opacity-60" />
                )}

                <div className="absolute bottom-2 left-2 right-2 p-2 rounded-xl bg-black/80 backdrop-blur-md text-[11px] text-white flex items-center justify-between border border-white/10 print:hidden">
                  <span className="font-mono">{extinguisher.patrimonyNumber}</span>
                  <span className="text-red-400 font-semibold">{extinguisher.capacity}</span>
                </div>
              </div>

              {/* QR Code Tag for Inspection */}
              <div className="p-3.5 rounded-xl bg-[#181c26] border border-[#272e3f] flex items-center gap-3 print:border-gray-300 print:bg-white">
                <div className="p-2 rounded-lg bg-white text-black">
                  <QrCode className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white print:text-black">Tag de Inspeção QR</p>
                  <p className="text-[10px] text-gray-400 print:text-gray-600 truncate">
                    ID: {extinguisher.id}
                  </p>
                  <p className="text-[10px] text-emerald-400 print:text-emerald-700 font-medium">
                    Pronto para leitura móvel
                  </p>
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="md:col-span-2 space-y-4">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800/60 print:bg-gray-100 print:text-black">
                  {TYPE_LABELS[extinguisher.type]}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    extinguisher.operationalCondition === 'OPERACIONAL'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                      : extinguisher.operationalCondition === 'EM_RECARGA'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                      : extinguisher.operationalCondition === 'INTERDITADO'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                      : 'bg-red-950/80 text-red-300 border-red-800/60'
                  } print:bg-gray-100 print:text-black`}
                >
                  {CONDITION_LABELS[extinguisher.operationalCondition]}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1a1f2c] text-gray-300 border border-[#2b3346] print:bg-gray-100 print:text-black">
                  {extinguisher.locationArea === 'ESTOQUE' ? 'Almoxarifado / Estoque' : 'Em Campo (Operacional)'}
                </span>
              </div>

              {/* Data Table */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#161922] border border-[#262c3a] text-xs print:bg-white print:border-gray-300">
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Capacidade:</span>
                  <span className="font-semibold text-white print:text-black text-sm">{extinguisher.capacity}</span>
                </div>
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Fabricante:</span>
                  <span className="font-semibold text-white print:text-black text-sm">{extinguisher.manufacturer}</span>
                </div>
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Nº de Série do Cilindro:</span>
                  <span className="font-mono text-gray-200 print:text-black">{extinguisher.serialNumber}</span>
                </div>
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Lacre de Segurança:</span>
                  <span className="font-mono text-gray-200 print:text-black">{extinguisher.sealNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Manômetro de Pressão:</span>
                  <span className={`font-semibold ${extinguisher.hasPressureGaugeNormal ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-red-700'}`}>
                    {extinguisher.hasPressureGaugeNormal ? 'Faixa Verde (Normal)' : 'Anormal / Despressurizado'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 print:text-gray-600 block">Data de Fabricação:</span>
                  <span className="font-mono text-gray-200 print:text-black">{extinguisher.manufacturingDate}</span>
                </div>
              </div>

              {/* Location Card */}
              <div className="p-4 rounded-2xl bg-[#161922] border border-[#262c3a] print:bg-white print:border-gray-300">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400 mb-1">
                  <MapPin className="h-4 w-4" />
                  <span>Localização Física do Posto de Combate</span>
                </div>
                <p className="text-sm font-semibold text-white print:text-black">
                  {extinguisher.locationDetails}
                </p>
              </div>

              {/* Expiration Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3.5 rounded-xl border text-xs ${
                  daysToMaint < 0
                    ? 'bg-red-950/50 border-red-700 text-red-200'
                    : daysToMaint <= 30
                    ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                    : 'bg-[#181c26] border-[#293040] text-gray-300'
                } print:bg-white print:border-gray-300 print:text-black`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Próxima Manutenção Periódica:</span>
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="text-base font-bold font-mono">{extinguisher.nextMaintenanceDate}</div>
                  <div className="mt-1 text-[11px]">
                    {daysToMaint < 0
                      ? `ATRASADO há ${Math.abs(daysToMaint)} dia(s)`
                      : daysToMaint <= 30
                      ? `Vence em ${daysToMaint} dia(s)`
                      : `Regular (${daysToMaint} dias restantes)`}
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border text-xs ${
                  daysToHydro < 0
                    ? 'bg-red-950/50 border-red-700 text-red-200'
                    : daysToHydro <= 60
                    ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                    : 'bg-[#181c26] border-[#293040] text-gray-300'
                } print:bg-white print:border-gray-300 print:text-black`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Ensaio Hidrostático (5 Anos):</span>
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="text-base font-bold font-mono">{extinguisher.hydrostaticExpirationDate}</div>
                  <div className="mt-1 text-[11px]">
                    {daysToHydro < 0
                      ? `CILINDRO VENCIDO há ${Math.abs(daysToHydro)} dia(s)`
                      : `Validade: ${daysToHydro} dias restantes`}
                  </div>
                </div>
              </div>

              {/* Technical notes */}
              {extinguisher.notes && (
                <div className="p-3 rounded-xl bg-[#161922] border border-[#272d3d] text-xs text-gray-300 print:bg-white print:border-gray-300 print:text-black">
                  <span className="font-semibold text-gray-400 print:text-gray-600 block mb-0.5">Observações:</span>
                  {extinguisher.notes}
                </div>
              )}
            </div>
          </div>

          {/* Historical Timeline of Movements */}
          <div className="pt-4 border-t border-[#242b3b] print:border-gray-300">
            <div className="flex items-center gap-2 text-sm font-bold text-white print:text-black mb-3">
              <History className="h-4 w-4 text-red-400" />
              <span>Histórico Completo de Movimentações deste Extintor</span>
              <span className="text-xs text-gray-400 font-normal">
                ({extMovements.length} registro(s))
              </span>
            </div>

            {extMovements.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                Nenhuma movimentação adicional registrada.
              </p>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#252c3c] print:before:bg-gray-300">
                {extMovements.map((m) => (
                  <div key={m.id} className="relative flex items-start gap-4 pl-8 text-xs">
                    <div className="absolute left-2 top-1.5 h-3.5 w-3.5 rounded-full bg-red-600 border-2 border-[#13161f] print:border-white shadow-xs"></div>
                    <div className="flex-1 p-3 rounded-xl bg-[#171b25] border border-[#252c3c] print:bg-white print:border-gray-300 print:text-black">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white print:text-black">
                          {MOVEMENT_TYPE_LABELS[m.movementType] || m.movementType}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400 print:text-gray-600">
                          {m.date} às {m.time}
                        </span>
                      </div>
                      <div className="mt-1 text-gray-300 print:text-gray-700">
                        <span className="text-gray-400 print:text-gray-500">De:</span> {m.originLocation}{' '}
                        <span className="text-gray-400 print:text-gray-500">→ Para:</span> {m.destinationLocation}
                      </div>
                      {m.incidentDescription && (
                        <div className="mt-1.5 p-2 rounded-lg bg-red-950/40 border border-red-800/40 text-red-200 text-[11px]">
                          <strong>Ocorrência:</strong> {m.incidentDescription}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-gray-400 print:text-gray-600 flex justify-between">
                        <span>Responsável: {m.responsibleUserName}</span>
                        {m.notes && <span className="italic truncate max-w-xs">{m.notes}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#242b3b] bg-[#0d0f15] print:hidden">
          <div className="text-xs text-gray-400">
            Cadastrado em: {new Date(extinguisher.createdAt).toLocaleDateString('pt-BR')}
          </div>

          <div className="flex items-center gap-2">
            {canRegisterMovement && (
              <button
                onClick={() => {
                  onClose();
                  onNewMovement(extinguisher);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#222838] text-white hover:bg-[#2c344a] border border-[#364057] transition-colors"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-red-400" />
                <span>Movimentar</span>
              </button>
            )}

            {canEditExtinguisher && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(extinguisher);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Editar Cadastro</span>
              </button>
            )}

            {/* Excluir extintor button (with trash icon and prominent red highlight) */}
            {canDeleteExtinguisher && (
              <button
                onClick={() => {
                  onClose();
                  onDelete?.(extinguisher);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-700/80 transition-all shadow-sm shadow-rose-950/50"
                title="Excluir ou arquivar este extintor"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Excluir extintor</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
