import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Save,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cloud,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  HardDrive,
  ClipboardPaste,
} from 'lucide-react';
import { SystemSettings } from '../../types/extinguisher';
import { storageService, MigrationResult } from '../../services/storageService';
import {
  getFirebaseConnectionStatus,
  getSavedManualConfig,
  saveManualConfig,
  removeManualConfig,
  testFirestoreConnection,
  verifyFirebaseWebApiKey,
  subscribeFirebaseStatus,
  FirebaseClientConfig,
  FirebaseConnectionStatus,
} from '../../services/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { MigrationPlan } from '../../utils/migrationLogic';
import {
  parseFirebaseConfigSnippet,
  sanitizeFirebaseClientConfig,
} from '../../utils/firebaseConfigParser';

interface SettingsViewProps {
  onRefreshAll: () => void;
  onOpenFirebaseModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefreshAll,
  onOpenFirebaseModal,
}) => {
  const { refreshFirebaseAuthBinding, canManageSettings } = useAuth();

  const [settings, setSettings] = useState<SystemSettings>(() => storageService.getSettings());
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [cnpj, setCnpj] = useState(settings.cnpj);
  const [sesmtDepartment, setSesmtDepartment] = useState(settings.sesmtDepartment);
  const [minReserve, setMinReserve] = useState(settings.minTechnicalReservePercent);
  const [alertDays, setAlertDays] = useState(settings.maintenanceAlertWindowDays);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const [fbStatus, setFbStatus] = useState<FirebaseConnectionStatus>(() =>
    getFirebaseConnectionStatus()
  );
  const [savedFirebaseConfig, setSavedFirebaseConfig] = useState<FirebaseClientConfig | null>(() =>
    getSavedManualConfig()
  );
  const [quickProjectId, setQuickProjectId] = useState(savedFirebaseConfig?.projectId || '');
  const [quickApiKey, setQuickApiKey] = useState(savedFirebaseConfig?.apiKey || '');
  const [quickAuthDomain, setQuickAuthDomain] = useState(savedFirebaseConfig?.authDomain || '');
  const [quickAppId, setQuickAppId] = useState(savedFirebaseConfig?.appId || '');
  const [showQuickSnippet, setShowQuickSnippet] = useState(false);
  const [quickSnippet, setQuickSnippet] = useState('');
  const [isTestingQuick, setIsTestingQuick] = useState(false);
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [quickResult, setQuickResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // Migration & Backup feedback states
  const [localCounts, setLocalCounts] = useState(() => {
    const snap = storageService.getLocalSnapshot();
    return {
      extinguishers: snap.extinguishers.length,
      movements: snap.movements.length,
      units: snap.units.length,
      users: snap.users.length,
    };
  });
  const [remoteCounts, setRemoteCounts] = useState(() => {
    const snap = storageService.getFirestoreSnapshot();
    return {
      extinguishers: snap.extinguishers.length,
      movements: snap.movements.length,
      units: snap.units.length,
      users: snap.users.length,
    };
  });
  const [isAnalyzingMigration, setIsAnalyzingMigration] = useState(false);
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationError, setMigrationError] = useState('');
  const [backupMessage, setBackupMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsubFb = subscribeFirebaseStatus((status) => setFbStatus(status));
    const unsubSettings = storageService.subscribeSettings((s) => {
      setSettings(s);
      setCompanyName(s.companyName);
      setCnpj(s.cnpj);
      setSesmtDepartment(s.sesmtDepartment);
      setMinReserve(s.minTechnicalReservePercent);
      setAlertDays(s.maintenanceAlertWindowDays);
    });

    const refreshCounts = () => {
      const local = storageService.getLocalSnapshot();
      setLocalCounts({
        extinguishers: local.extinguishers.length,
        movements: local.movements.length,
        units: local.units.length,
        users: local.users.length,
      });
      const remote = storageService.getFirestoreSnapshot();
      setRemoteCounts({
        extinguishers: remote.extinguishers.length,
        movements: remote.movements.length,
        units: remote.units.length,
        users: remote.users.length,
      });
    };

    const unsubExt = storageService.subscribeExtinguishers(refreshCounts);
    const unsubMov = storageService.subscribeMovements(refreshCounts);
    const unsubUnits = storageService.subscribeUnits(refreshCounts);
    const unsubUsers = storageService.subscribeUsers(refreshCounts);

    return () => {
      unsubFb();
      unsubSettings();
      unsubExt();
      unsubMov();
      unsubUnits();
      unsubUsers();
    };
  }, []);

  const handleApplyQuickSnippet = (raw: string) => {
    const parsed = parseFirebaseConfigSnippet(raw);
    if (!parsed.success || !parsed.config) {
      setQuickResult({
        success: false,
        message: parsed.error || 'Não foi possível ler o código firebaseConfig.',
      });
      return;
    }
    if (parsed.config.projectId) setQuickProjectId(parsed.config.projectId);
    if (parsed.config.apiKey) setQuickApiKey(parsed.config.apiKey);
    if (parsed.config.authDomain) setQuickAuthDomain(parsed.config.authDomain);
    if (parsed.config.appId) setQuickAppId(parsed.config.appId);
    setShowQuickSnippet(false);
    setQuickResult({
      success: true,
      message: 'Campos preenchidos automaticamente! Clique em "Testar Conexão" ou "Salvar & Ativar Conexão".',
    });
  };

  const handleQuickTest = async () => {
    const cleaned = sanitizeFirebaseClientConfig({
      projectId: quickProjectId,
      apiKey: quickApiKey,
      authDomain: quickAuthDomain,
      appId: quickAppId,
    });
    if (cleaned.projectId) setQuickProjectId(cleaned.projectId);
    if (cleaned.apiKey) setQuickApiKey(cleaned.apiKey);

    setIsTestingQuick(true);
    setQuickResult(null);
    const res = await testFirestoreConnection(cleaned);
    setQuickResult(res);
    setIsTestingQuick(false);
  };

  const handleQuickSave = async () => {
    const cleaned = sanitizeFirebaseClientConfig({
      projectId: quickProjectId,
      apiKey: quickApiKey,
      authDomain:
        quickAuthDomain.trim() ||
        (quickProjectId.trim() ? `${quickProjectId.trim()}.firebaseapp.com` : ''),
      appId: quickAppId,
    });

    if (!cleaned.projectId || !cleaned.apiKey) {
      setQuickResult({
        success: false,
        message: 'Informe o ID do Projeto e a API Key Web do Firebase.',
        details: 'Ambas as chaves públicas do aplicativo Web são necessárias.',
      });
      return;
    }

    setQuickProjectId(cleaned.projectId);
    setQuickApiKey(cleaned.apiKey);
    setIsSavingQuick(true);
    const keyCheck = await verifyFirebaseWebApiKey(cleaned.apiKey);
    setIsSavingQuick(false);

    if (!keyCheck.valid) {
      setQuickResult({
        success: false,
        message: keyCheck.message || 'API Key inválida.',
        details: keyCheck.details,
      });
      return;
    }

    saveManualConfig(cleaned);
    setSavedFirebaseConfig(getSavedManualConfig());
    setQuickResult({
      success: true,
      message: 'API Key verificada e configuração salva! Prossiga para a autenticação no Firebase.',
    });
    refreshFirebaseAuthBinding();
    onRefreshAll();
  };

  const handleQuickDisconnect = () => {
    removeManualConfig();
    refreshFirebaseAuthBinding();
    setQuickProjectId('');
    setQuickApiKey('');
    setQuickAuthDomain('');
    setQuickAppId('');
    setSavedFirebaseConfig(null);
    setConfirmingDisconnect(false);
    setQuickResult({
      success: true,
      message: 'Firebase desconectado. Armazenamento local ativo (dados preservados).',
    });
    onRefreshAll();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setIsSavingSettings(true);
    try {
      const updated = await storageService.updateSettings({
        companyName: companyName.trim(),
        cnpj: cnpj.trim(),
        sesmtDepartment: sesmtDepartment.trim(),
        minTechnicalReservePercent: Number(minReserve),
        maintenanceAlertWindowDays: Number(alertDays),
      });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSettingsError(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar parâmetros do sistema. Verifique suas permissões.'
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAnalyzeMigration = async () => {
    setMigrationError('');
    setMigrationResult(null);
    setIsAnalyzingMigration(true);
    const res = await storageService.analyzeLocalToFirestoreMigration();
    setIsAnalyzingMigration(false);
    if (!res.success || !res.plan) {
      setMigrationError(res.error || 'Não foi possível analisar os dados locais.');
      return;
    }
    setMigrationPlan(res.plan);
  };

  const handleExecuteMigration = async () => {
    setMigrationError('');
    setMigrationResult(null);
    setIsMigrating(true);
    const localSnap = storageService.getLocalSnapshot();
    const res = await storageService.migrateSnapshotToFirestore(localSnap);
    setIsMigrating(false);
    if (!res.success) {
      setMigrationError(res.error || 'Falha ao migrar dados para o Firestore.');
      return;
    }
    setMigrationResult(res);
    setMigrationPlan(null);
    onRefreshAll();
  };

  const handleExport = () => {
    const json = storageService.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_extintores_manager_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage({
      type: 'success',
      text: 'Backup JSON gerado e baixado com sucesso (sem senhas em texto puro).',
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await storageService.importData(content);
      if (res.success) {
        setBackupMessage({
          type: 'success',
          text: `Backup importado para ${
            res.target === 'firestore' ? 'o Cloud Firestore' : 'o armazenamento local'
          }! ${res.count ?? 0} novo(s) extintor(es) adicionado(s), ${
            res.skipped ?? 0
          } duplicado(s) ignorado(s).`,
        });
        onRefreshAll();
      } else {
        setBackupMessage({
          type: 'error',
          text: res.error || 'Erro ao importar backup JSON.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totalLocalRecords =
    localCounts.extinguishers + localCounts.movements + localCounts.units + localCounts.users;

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-red-500" />
            <span>Configurações do Sistema</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Parâmetros corporativos, regras da NBR 12962, conexão Firebase e migração segura para a nuvem.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Configurações salvas e aplicadas em tempo real com sucesso!</span>
        </div>
      )}

      {settingsError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{settingsError}</span>
        </div>
      )}

      {/* Form: Company & Normative Rules */}
      <form
        onSubmit={handleSave}
        className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm space-y-4"
      >
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#222838]">
          <Building className="h-4 w-4 text-red-400" />
          <span>Dados da Empresa & SESMT</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-300 mb-1">
              Razão Social / Empresa *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!canManageSettings}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-white focus:border-red-600 focus:outline-none disabled:opacity-60"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1">CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              disabled={!canManageSettings}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-white focus:border-red-600 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-gray-300 mb-1">
              Departamento / Área de Segurança
            </label>
            <input
              type="text"
              value={sesmtDepartment}
              onChange={(e) => setSesmtDepartment(e.target.value)}
              disabled={!canManageSettings}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-white focus:border-red-600 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <h3 className="text-sm font-bold text-white flex items-center gap-2 pt-4 pb-2 border-b border-[#222838]">
          <ShieldCheck className="h-4 w-4 text-red-400" />
          <span>Regras de Negócio & Prazos de Vencimento</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-300 mb-1">
              Reserva Técnica Mínima Recomendada (% do campo)
            </label>
            <input
              type="number"
              min={5}
              max={50}
              value={minReserve}
              onChange={(e) => setMinReserve(Number(e.target.value))}
              disabled={!canManageSettings}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-white focus:border-red-600 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1">
              Janela de Antecedência para Alertas de Vencimento (Dias)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={alertDays}
              onChange={(e) => setAlertDays(Number(e.target.value))}
              disabled={!canManageSettings}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3.5 py-2 text-white focus:border-red-600 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {canManageSettings && (
          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingSettings ? 'Salvando...' : 'Salvar Parâmetros'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Firebase Connection Card */}
      <div className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222838]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-600/30 to-amber-600/20 text-red-400 border border-red-700/50">
              <Cloud className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                <span>Integração com Firebase Firestore & Authentication</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    fbStatus.isConnected
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : fbStatus.isConfigured
                      ? 'bg-sky-950 text-sky-300 border border-sky-700'
                      : 'bg-amber-950/90 text-amber-300 border border-amber-700'
                  }`}
                >
                  {fbStatus.isConnected
                    ? `● Conectado (${fbStatus.projectId})`
                    : fbStatus.isConfigured
                    ? `○ Configurado (${fbStatus.projectId})`
                    : '○ Não Conectado (Modo Local)'}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{fbStatus.statusMessage}</p>
            </div>
          </div>

          {onOpenFirebaseModal && (
            <button
              type="button"
              onClick={onOpenFirebaseModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/60 transition-all shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir Assistente Completo</span>
            </button>
          )}
        </div>

        {/* Quick Connection Fields */}
        <div className="p-4 rounded-xl bg-[#171b26] border border-[#273042] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-300">
              Credenciais do Aplicativo Web (Firebase Console)
            </span>
            <button
              type="button"
              onClick={() => setShowQuickSnippet((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>{showQuickSnippet ? 'Ocultar importação rápida' : 'Colar firebaseConfig completo'}</span>
            </button>
          </div>

          {showQuickSnippet && (
            <div className="p-3 rounded-xl bg-[#11141d] border border-[#28334a] space-y-2">
              <textarea
                rows={3}
                value={quickSnippet}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuickSnippet(val);
                  if (val.includes('apiKey') && val.includes('projectId')) {
                    handleApplyQuickSnippet(val);
                  }
                }}
                placeholder={'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "seu-projeto.firebaseapp.com",\n  projectId: "seu-projeto"\n};'}
                className="w-full rounded-lg bg-[#0b0d14] border border-[#242c3f] px-3 py-2 font-mono text-[11px] text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleApplyQuickSnippet(quickSnippet)}
                  disabled={!quickSnippet.trim()}
                  className="px-3 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold text-[11px] disabled:opacity-40"
                >
                  Auto-Preencher
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                ID do Projeto (Project ID) *
              </label>
              <input
                type="text"
                placeholder="ex: extintores-manager-12345"
                value={quickProjectId}
                onChange={(e) => setQuickProjectId(e.target.value)}
                className="w-full rounded-xl bg-[#12151e] border border-[#2a3449] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                API Key (Chave Web Pública) *
              </label>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={quickApiKey}
                onChange={(e) => setQuickApiKey(e.target.value)}
                className="w-full rounded-xl bg-[#12151e] border border-[#2a3449] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>

          {quickResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                quickResult.success
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-700 text-rose-200'
              }`}
            >
              {quickResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold">{quickResult.message}</p>
                {quickResult.details && <p className="text-[11px] opacity-90">{quickResult.details}</p>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickTest}
                disabled={isTestingQuick || !quickProjectId.trim() || !quickApiKey.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#212737] hover:bg-[#2b3348] text-gray-200 border border-[#38435e] disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-sky-400 ${isTestingQuick ? 'animate-spin' : ''}`}
                />
                <span>{isTestingQuick ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                type="button"
                onClick={handleQuickSave}
                disabled={isSavingQuick || isTestingQuick || !quickProjectId.trim() || !quickApiKey.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-xs disabled:opacity-50 transition-all"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSavingQuick ? 'Validando API Key...' : 'Salvar & Ativar Conexão'}</span>
              </button>
            </div>

            {savedFirebaseConfig?.projectId && (
              <div className="flex items-center gap-2">
                {confirmingDisconnect ? (
                  <>
                    <button
                      type="button"
                      onClick={handleQuickDisconnect}
                      className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-bold"
                    >
                      Confirmar Desconexão
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDisconnect(false)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDisconnect(true)}
                    className="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                  >
                    Desconectar Firebase
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safe Migration Card: LocalStorage -> Cloud Firestore */}
      <div className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#222838]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Migração Segura para o Cloud Firestore (Sem Duplicar)</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Transfira registros salvos localmente neste dispositivo para o Firestore com verificação idempotente por ID e patrimônio.
            </p>
          </div>
        </div>

        {/* Local vs Firestore Inventory Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#171b26] border border-[#273042] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <HardDrive className="h-4 w-4" />
              <span>Armazenamento Local (Preservado)</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-300 pt-1">
              <span>Extintores: <strong className="text-white">{localCounts.extinguishers}</strong></span>
              <span>Movimentações: <strong className="text-white">{localCounts.movements}</strong></span>
              <span>Unidades: <strong className="text-white">{localCounts.units}</strong></span>
              <span>Usuários: <strong className="text-white">{localCounts.users}</strong></span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171b26] border border-[#273042] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <Cloud className="h-4 w-4" />
              <span>Cloud Firestore (Tempo Real)</span>
            </div>
            {fbStatus.isConnected ? (
              <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-300 pt-1">
                <span>Extintores: <strong className="text-white">{remoteCounts.extinguishers}</strong></span>
                <span>Movimentações: <strong className="text-white">{remoteCounts.movements}</strong></span>
                <span>Unidades: <strong className="text-white">{remoteCounts.units}</strong></span>
                <span>Usuários: <strong className="text-white">{remoteCounts.users}</strong></span>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 pt-1">
                Conecte e autentique no Firebase para visualizar e sincronizar os registros na nuvem.
              </p>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Proteção contra perda de dados:</strong> Os dados locais (localStorage) nunca são apagados automaticamente após a migração. Registros já existentes no Firestore são ignorados sem duplicação.
          </span>
        </div>

        {migrationError && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{migrationError}</span>
          </div>
        )}

        {migrationPlan && (
          <div className="p-3.5 rounded-xl bg-sky-950/50 border border-sky-700/70 text-xs space-y-1.5 text-sky-100">
            <p className="font-bold text-sky-300">Prévia da Análise (Dry-Run):</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <span>Novos Extintores: <strong>{migrationPlan.extinguishers.toCreate.length}</strong></span>
              <span>Novos Movimentos: <strong>{migrationPlan.movements.toCreate.length}</strong></span>
              <span>Novas Unidades: <strong>{migrationPlan.units.toCreate.length}</strong></span>
              <span>Novos Usuários: <strong>{migrationPlan.users.toCreate.length}</strong></span>
            </div>
            <p className="text-[11px] text-sky-300">
              Registros já existentes que serão ignorados sem duplicação: <strong>{migrationPlan.totalSkipped}</strong>
            </p>
          </div>
        )}

        {migrationResult && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Migração concluída com sucesso!</span>
            </div>
            <p className="text-[11px]">
              Enviados para o Firestore: {migrationResult.createdExtinguishers} extintor(es),{' '}
              {migrationResult.createdMovements} movimentação(ões), {migrationResult.createdUnits}{' '}
              unidade(s), {migrationResult.createdUsers} usuário(s). Duplicados ignorados:{' '}
              {migrationResult.skippedDuplicates}.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyzeMigration}
            disabled={!fbStatus.isConnected || isAnalyzingMigration || totalLocalRecords === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1e2330] hover:bg-[#282f42] text-white border border-[#353f56] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-sky-400 ${isAnalyzingMigration ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingMigration ? 'Analisando...' : 'Analisar Dados Locais'}</span>
          </button>

          <button
            type="button"
            onClick={handleExecuteMigration}
            disabled={!fbStatus.isConnected || isMigrating || totalLocalRecords === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white shadow-md shadow-emerald-950/60 disabled:opacity-50 transition-all"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>{isMigrating ? 'Migrando...' : 'Migrar para Firestore (Sem Duplicar)'}</span>
          </button>
        </div>
      </div>

      {/* Backup & JSON Import */}
      <div className="p-5 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#222838]">
          <Download className="h-4 w-4 text-sky-400" />
          <span>Backup & Importação JSON (Sem Duplicar Registros)</span>
        </h3>

        <p className="text-xs text-gray-400">
          Exporte um arquivo JSON completo com todos os dados atuais ou importe um backup anterior com deduplicação automática para {fbStatus.isConnected ? 'o Cloud Firestore' : 'o armazenamento local'}.
        </p>

        {backupMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              backupMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/80 border-rose-700 text-rose-200'
            }`}
          >
            {backupMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{backupMessage.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1e2330] hover:bg-[#282f42] text-white border border-[#353f56] transition-colors"
          >
            <Download className="h-4 w-4 text-sky-400" />
            <span>Exportar Backup Completo (JSON)</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1e2330] hover:bg-[#282f42] text-white border border-[#353f56] cursor-pointer transition-colors">
            <Upload className="h-4 w-4 text-amber-400" />
            <span>Importar Backup JSON (Sem Duplicar)</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
