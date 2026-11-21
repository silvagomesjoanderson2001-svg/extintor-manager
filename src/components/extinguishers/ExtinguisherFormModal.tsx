import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  Camera,
  Upload,
  AlertCircle,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {
  Extinguisher,
  ExtinguisherType,
  OperationalCondition,
  PhysicalLocationType,
} from '../../types/extinguisher';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { TYPE_LABELS, CONDITION_LABELS } from '../../utils/extinguisherLogic';

interface ExtinguisherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  extinguisherToEdit?: Extinguisher | null;
  onSaved: () => void;
}

// Preset realistic equipment photos if user doesn't upload a custom one
const DEFAULT_PHOTOS: Record<ExtinguisherType, string> = {
  ABC_PO: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
  BC_PO: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
  CO2: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
  AGUA: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
  ESPUMA: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
};

export const ExtinguisherFormModal: React.FC<ExtinguisherFormModalProps> = ({
  isOpen,
  onClose,
  extinguisherToEdit,
  onSaved,
}) => {
  const { currentUser } = useAuth();

  const [id, setId] = useState('');
  const [patrimonyNumber, setPatrimonyNumber] = useState('');
  const [type, setType] = useState<ExtinguisherType>('ABC_PO');
  const [capacity, setCapacity] = useState('6 kg');
  const [manufacturer, setManufacturer] = useState('Kidde Brasil');
  const [serialNumber, setSerialNumber] = useState('');
  const [locationArea, setLocationArea] = useState<PhysicalLocationType>('CAMPO');
  const [locationDetails, setLocationDetails] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [lastRechargeDate, setLastRechargeDate] = useState('');
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');
  const [hydrostaticExpirationDate, setHydrostaticExpirationDate] = useState('');
  const [operationalCondition, setOperationalCondition] = useState<OperationalCondition>('OPERACIONAL');
  const [photoUrl, setPhotoUrl] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [hasPressureGaugeNormal, setHasPressureGaugeNormal] = useState(true);
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(extinguisherToEdit);

  useEffect(() => {
    if (extinguisherToEdit) {
      setId(extinguisherToEdit.id);
      setPatrimonyNumber(extinguisherToEdit.patrimonyNumber);
      setType(extinguisherToEdit.type);
      setCapacity(extinguisherToEdit.capacity);
      setManufacturer(extinguisherToEdit.manufacturer);
      setSerialNumber(extinguisherToEdit.serialNumber);
      setLocationArea(extinguisherToEdit.locationArea);
      setLocationDetails(extinguisherToEdit.locationDetails);
      setManufacturingDate(extinguisherToEdit.manufacturingDate);
      setLastRechargeDate(extinguisherToEdit.lastRechargeDate);
      setNextMaintenanceDate(extinguisherToEdit.nextMaintenanceDate);
      setHydrostaticExpirationDate(extinguisherToEdit.hydrostaticExpirationDate);
      setOperationalCondition(extinguisherToEdit.operationalCondition);
      setPhotoUrl(extinguisherToEdit.photoUrl || '');
      setSealNumber(extinguisherToEdit.sealNumber || '');
      setHasPressureGaugeNormal(extinguisherToEdit.hasPressureGaugeNormal);
      setNotes(extinguisherToEdit.notes || '');
      setChangeReason('');
    } else {
      // Default new extinguisher values
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Next maintenance in 1 year
      const nextMaint = new Date(now);
      nextMaint.setFullYear(nextMaint.getFullYear() + 1);

      // Hydrostatic test 5 years
      const hydroTest = new Date(now);
      hydroTest.setFullYear(hydroTest.getFullYear() + 5);

      const nextIdNumber = Math.floor(100 + Math.random() * 900);
      setId(`EXT-${nextIdNumber}`);
      setPatrimonyNumber(`PAT-2026-${nextIdNumber}`);
      setType('ABC_PO');
      setCapacity('6 kg');
      setManufacturer('Kidde Brasil');
      setSerialNumber(`SN-${Math.floor(100000 + Math.random() * 900000)}`);
      setLocationArea('CAMPO');
      setLocationDetails('Bloco A - Corredor Administrativo');
      setManufacturingDate(todayStr);
      setLastRechargeDate(todayStr);
      setNextMaintenanceDate(nextMaint.toISOString().split('T')[0]);
      setHydrostaticExpirationDate(hydroTest.toISOString().split('T')[0]);
      setOperationalCondition('OPERACIONAL');
      setPhotoUrl(DEFAULT_PHOTOS.ABC_PO);
      setSealNumber(`LACRE-${Math.floor(10000 + Math.random() * 90000)}`);
      setHasPressureGaugeNormal(true);
      setNotes('');
      setChangeReason('');
    }
    setErrorMessage('');
  }, [extinguisherToEdit, isOpen]);

  // Handle custom photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage('A imagem deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentUser) {
      setErrorMessage('Usuário não autenticado. Faça login novamente para continuar.');
      return;
    }

    // Strict validation
    if (!id.trim()) {
      setErrorMessage('Identificação individual é obrigatória (ex: EXT-015).');
      return;
    }
    if (!patrimonyNumber.trim()) {
      setErrorMessage('Número patrimonial é obrigatório.');
      return;
    }
    if (!serialNumber.trim()) {
      setErrorMessage('Número de série do cilindro é obrigatório.');
      return;
    }
    if (!locationDetails.trim()) {
      setErrorMessage('Localização detalhada é obrigatória.');
      return;
    }
    if (!manufacturingDate) {
      setErrorMessage('Data de fabricação é obrigatória.');
      return;
    }
    if (!lastRechargeDate) {
      setErrorMessage('Data da última recarga é obrigatória.');
      return;
    }
    if (!nextMaintenanceDate) {
      setErrorMessage('Data da próxima manutenção é obrigatória.');
      return;
    }
    if (!hydrostaticExpirationDate) {
      setErrorMessage('Data do teste hidrostático (vencimento) é obrigatória.');
      return;
    }

    setIsSubmitting(true);

    if (isEditing && extinguisherToEdit) {
      const res = await storageService.updateExtinguisher(
        extinguisherToEdit.id,
        {
          patrimonyNumber: patrimonyNumber.trim(),
          type,
          capacity,
          manufacturer: manufacturer.trim(),
          serialNumber: serialNumber.trim(),
          locationArea,
          locationDetails: locationDetails.trim(),
          manufacturingDate,
          lastRechargeDate,
          nextMaintenanceDate,
          hydrostaticExpirationDate,
          operationalCondition,
          photoUrl: photoUrl || DEFAULT_PHOTOS[type],
          sealNumber: sealNumber.trim(),
          hasPressureGaugeNormal,
          notes: notes.trim(),
        },
        currentUser,
        changeReason || 'Edição cadastral dos dados técnicos e localização'
      );

      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.error || 'Erro ao atualizar extintor.');
        return;
      }
    } else {
      const res = await storageService.addExtinguisher(
        {
          id: id.trim(),
          patrimonyNumber: patrimonyNumber.trim(),
          type,
          capacity,
          manufacturer: manufacturer.trim(),
          serialNumber: serialNumber.trim(),
          locationArea,
          locationDetails: locationDetails.trim(),
          manufacturingDate,
          lastRechargeDate,
          nextMaintenanceDate,
          hydrostaticExpirationDate,
          operationalCondition,
          photoUrl: photoUrl || DEFAULT_PHOTOS[type],
          sealNumber: sealNumber.trim(),
          hasPressureGaugeNormal,
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        currentUser
      );

      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.error || 'Erro ao cadastrar extintor.');
        return;
      }
    }

    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#13161f] border border-[#272e3f] shadow-2xl text-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242b3b] bg-[#0d0f15]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950 text-red-400 border border-red-800/60">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `Editar Cadastro: ${extinguisherToEdit?.id}` : 'Cadastro de Novo Extintor'}
              </h2>
              <p className="text-xs text-gray-400">
                Preencha todos os parâmetros normativos e identificação patrimonial individual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f2533] transition-colors"
            aria-label="Fechar formulário"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Identificação & Patrimônio */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>1. Identificação Individual & Patrimônio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Identificação Individual (Única) *
                </label>
                <input
                  type="text"
                  disabled={isEditing}
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                  placeholder="Ex: EXT-012"
                  className={`w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none ${
                    isEditing ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  required
                />
                {isEditing && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    A identificação do prontuário é imutável após cadastro.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Número Patrimonial *
                </label>
                <input
                  type="text"
                  value={patrimonyNumber}
                  onChange={(e) => setPatrimonyNumber(e.target.value.toUpperCase())}
                  placeholder="Ex: PAT-2024-045"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Número de Série do Cilindro *
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Ex: SR-882319"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Especificações Técnicas */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider mb-3">
              <Layers className="h-4 w-4" />
              <span>2. Especificações Técnicas & Fabricante</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Tipo de Extintor *
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as ExtinguisherType;
                    setType(newType);
                    if (!photoUrl || Object.values(DEFAULT_PHOTOS).includes(photoUrl)) {
                      setPhotoUrl(DEFAULT_PHOTOS[newType]);
                    }
                  }}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                >
                  <option value="ABC_PO">{TYPE_LABELS.ABC_PO}</option>
                  <option value="BC_PO">{TYPE_LABELS.BC_PO}</option>
                  <option value="CO2">{TYPE_LABELS.CO2}</option>
                  <option value="AGUA">{TYPE_LABELS.AGUA}</option>
                  <option value="ESPUMA">{TYPE_LABELS.ESPUMA}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Capacidade Nominal *
                </label>
                <select
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                >
                  <option value="1 kg">1 kg (Automotivo)</option>
                  <option value="2 kg">2 kg</option>
                  <option value="4 kg">4 kg</option>
                  <option value="6 kg">6 kg (Padrão Industrial)</option>
                  <option value="8 kg">8 kg</option>
                  <option value="10 L">10 L (Água / Espuma)</option>
                  <option value="12 kg">12 kg</option>
                  <option value="20 kg">20 kg Sobre Rodas (Carreta)</option>
                  <option value="50 L">50 L Sobre Rodas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Fabricante / Marca *
                </label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Ex: Kidde, Mocelin, Resil, Bucka"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Localização Física & Condição Operacional (Regra: separados) */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider mb-3">
              <MapPin className="h-4 w-4" />
              <span>3. Localização Física & Condição Operacional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Área de Alocação *
                </label>
                <select
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value as PhysicalLocationType)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                >
                  <option value="CAMPO">Em Campo (Setores, Prédios, Postos)</option>
                  <option value="ESTOQUE">Em Estoque (Almoxarifado / Reserva Técnica)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Localização Detalhada do Posto / Prateleira *
                </label>
                <input
                  type="text"
                  value={locationDetails}
                  onChange={(e) => setLocationDetails(e.target.value)}
                  placeholder="Ex: Bloco B - Próximo ao Elevador de Carga 2º Andar"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Condição Operacional *
                </label>
                <select
                  value={operationalCondition}
                  onChange={(e) => setOperationalCondition(e.target.value as OperationalCondition)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                >
                  {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Número do Lacre Plástico
                </label>
                <input
                  type="text"
                  value={sealNumber}
                  onChange={(e) => setSealNumber(e.target.value)}
                  placeholder="Ex: LACRE-55912"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="pressureNormal"
                  checked={hasPressureGaugeNormal}
                  onChange={(e) => setHasPressureGaugeNormal(e.target.checked)}
                  className="h-4 w-4 rounded bg-[#1b1f2b] border-gray-600 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="pressureNormal" className="text-xs text-gray-200 cursor-pointer">
                  Manômetro na faixa verde (Pressurizado)
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Cronograma e Validades Normativas */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider mb-3">
              <Calendar className="h-4 w-4" />
              <span>4. Cronograma de Manutenções & Vencimentos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Data de Fabricação *
                </label>
                <input
                  type="date"
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Última Recarga Realizada *
                </label>
                <input
                  type="date"
                  value={lastRechargeDate}
                  onChange={(e) => setLastRechargeDate(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Próxima Manutenção Periódica *
                </label>
                <input
                  type="date"
                  value={nextMaintenanceDate}
                  onChange={(e) => setNextMaintenanceDate(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Vencimento Ensaio Hidrostático *
                </label>
                <input
                  type="date"
                  value={hydrostaticExpirationDate}
                  onChange={(e) => setHydrostaticExpirationDate(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 5: Fotografia & Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Fotografia do Equipamento
              </label>
              <div className="relative group rounded-xl overflow-hidden border border-[#2d3648] bg-[#181c26] aspect-video sm:aspect-square flex flex-col items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Foto do extintor"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="h-8 w-8 text-gray-500 mx-auto mb-1" />
                    <span className="text-xs text-gray-400">Nenhuma imagem</span>
                  </div>
                )}

                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                  <Upload className="h-6 w-6 text-white mb-1" />
                  <span className="text-xs text-white font-medium">Carregar Imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Observações Técnicas / Ficha de Inspeção
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre sinalização, suporte de fixação, testes realizados ou observações da vistoria..."
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-3 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                />
              </div>

              {isEditing && (
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    Justificativa da Alteração (Registro no Histórico)
                  </label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Ex: Atualização do prazo de inspeção após vistoria de Nível 1"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-amber-800/60 p-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#242b3b] bg-[#0d0f15]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1d222e] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Extintor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
