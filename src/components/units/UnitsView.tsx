import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  MapPin,
  Phone,
  UserCheck,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Unit, Extinguisher } from '../../types/extinguisher';
import { storageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';

interface UnitsViewProps {
  units: Unit[];
  extinguishers: Extinguisher[];
  onRefresh: () => void;
}

export const UnitsView: React.FC<UnitsViewProps> = ({ units, onRefresh }) => {
  const { currentUser, canManageUnits } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [address, setAddress] = useState('');
  const [responsibleTst, setResponsibleTst] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenAdd = () => {
    setUnitToEdit(null);
    setName('');
    setCode(`UN-${Math.floor(100 + Math.random() * 900)}`);
    setCity('');
    setState('SP');
    setAddress('');
    setResponsibleTst(currentUser?.name || '');
    setPhone('');
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setUnitToEdit(unit);
    setName(unit.name);
    setCode(unit.code);
    setCity(unit.city);
    setState(unit.state);
    setAddress(unit.address);
    setResponsibleTst(unit.responsibleTst);
    setPhone(unit.phone);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !code.trim() || !city.trim() || !address.trim()) {
      setError('Por favor preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    if (unitToEdit) {
      const res = await storageService.updateUnit(unitToEdit.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        address: address.trim(),
        responsibleTst: responsibleTst.trim(),
        phone: phone.trim(),
      });
      setIsSaving(false);
      if (!res.success) {
        setError(res.error || 'Erro ao atualizar unidade.');
        return;
      }
    } else {
      const res = await storageService.addUnit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        address: address.trim(),
        responsibleTst: responsibleTst.trim(),
        phone: phone.trim(),
      });
      setIsSaving(false);
      if (!res.success) {
        setError(res.error || 'Erro ao cadastrar unidade.');
        return;
      }
    }

    setIsModalOpen(false);
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    setActionError('');
    const res = await storageService.deleteUnit(unitToDelete.id);
    setUnitToDelete(null);
    if (!res.success) {
      setActionError(res.error || 'Erro ao excluir unidade.');
      return;
    }
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-red-500" />
            <span>Unidades Operacionais & Filiais</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gerenciamento de plantas fabris, matriz administrativa, centros de distribuição e postos avançados.
          </p>
        </div>

        {canManageUnits && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Nova Unidade</span>
          </button>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-300 hover:text-white underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {/* Units Grid */}
      {units.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-[#141720] border border-[#262c3c]">
          <Building2 className="h-10 w-10 text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">Nenhuma unidade cadastrada</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Cadastre sua primeira unidade operacional ou importe seu backup na aba Configurações.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#222838] mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-900/60 text-red-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{unit.name}</h3>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-red-400 border border-red-900/50">
                        {unit.code}
                      </span>
                    </div>
                  </div>

                  {canManageUnits && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(unit)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2432] transition-colors"
                        title="Editar unidade"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setActionError('');
                          setUnitToDelete(unit);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-[#1f2432] transition-colors"
                        title="Excluir unidade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 text-xs text-gray-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">
                      {unit.address} - {unit.city}/{unit.state}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-400">
                      Responsável TST: <strong className="text-white">{unit.responsibleTst}</strong>
                    </span>
                  </div>

                  {unit.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-400 font-mono">{unit.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#222838] flex items-center justify-between text-xs">
                <span className="text-gray-400 text-[11px]">Unidade Operacional Ativa</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>SESMT Vinculado</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#141720] border border-[#272e3f] p-6 shadow-2xl text-gray-100">
            <h3 className="text-base font-bold text-white mb-1">
              {unitToEdit ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Informe a denominação, endereço e o responsável técnico pelo posto.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Nome da Unidade *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Fábrica 2 - Setor Metalúrgico"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Sigla / Código *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex: UN-FAB2"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Telefone de Contato</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: (11) 4000-0000"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-300 mb-1">Cidade *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Campinas"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Estado (UF) *</label>
                  <input
                    type="text"
                    value={state}
                    maxLength={2}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Endereço Completo *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. das Indústrias, 1000 - Bairro Industrial"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Responsável Técnico (TST / Brigada)</label>
                <input
                  type="text"
                  value={responsibleTst}
                  onChange={(e) => setResponsibleTst(e.target.value)}
                  placeholder="Ex: Engenheiro ou Técnico Responsável"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242b3b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/70 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : unitToEdit ? 'Salvar Unidade' : 'Cadastrar Unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Delete Unit Confirmation Modal */}
      {unitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#141720] border border-rose-800/80 p-6 shadow-2xl text-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Remover Unidade Operacional</h3>
            </div>
            <p className="text-xs text-gray-300">
              Deseja realmente remover a unidade <strong className="text-white">{unitToDelete.name}</strong> ({unitToDelete.code})?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#242b3b]">
              <button
                type="button"
                onClick={() => setUnitToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
