import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Server,
  FileCode,
  ArrowRight,
  X,
  ClipboardPaste,
} from 'lucide-react';
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
import {
  parseFirebaseConfigSnippet,
  sanitizeFirebaseClientConfig,
} from '../../utils/firebaseConfigParser';
import { useAuth } from '../../context/AuthContext';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { refreshFirebaseAuthBinding } = useAuth();
  const [activeStep, setActiveStep] = useState<number>(() => {
    const existing = getSavedManualConfig();
    return existing?.projectId || existing?.apiKey ? 4 : 1;
  });
  const [savedConfig, setSavedConfig] = useState<FirebaseClientConfig | null>(() =>
    getSavedManualConfig()
  );
  const [projectId, setProjectId] = useState<string>(savedConfig?.projectId || '');
  const [apiKey, setApiKey] = useState<string>(savedConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState<string>(savedConfig?.authDomain || '');
  const [appId, setAppId] = useState<string>(savedConfig?.appId || '');
  const [snippetText, setSnippetText] = useState<string>('');
  const [snippetFeedback, setSnippetFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [formError, setFormError] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    verifiedRead: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [status, setStatus] = useState<FirebaseConnectionStatus>(() =>
    getFirebaseConnectionStatus()
  );

  useEffect(() => {
    return subscribeFirebaseStatus((s) => setStatus(s));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const latest = getSavedManualConfig();
    setSavedConfig(latest);
    setProjectId(latest?.projectId || '');
    setApiKey(latest?.apiKey || '');
    setAuthDomain(latest?.authDomain || '');
    setAppId(latest?.appId || '');
    setFormError('');
    setTestResult(null);
    setSnippetFeedback(null);
    setConfirmingDisconnect(false);
    if (latest?.projectId || latest?.apiKey) {
      setActiveStep(4);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const applySnippet = (raw: string) => {
    setSnippetFeedback(null);
    setFormError('');
    const parsed = parseFirebaseConfigSnippet(raw);
    if (!parsed.success || !parsed.config) {
      setSnippetFeedback({
        type: 'error',
        text: parsed.error || 'Não foi possível extrair as chaves do texto colado.',
      });
      return;
    }

    if (parsed.config.projectId) setProjectId(parsed.config.projectId);
    if (parsed.config.apiKey) setApiKey(parsed.config.apiKey);
    if (parsed.config.authDomain) {
      setAuthDomain(parsed.config.authDomain);
    } else if (parsed.config.projectId) {
      setAuthDomain(`${parsed.config.projectId}.firebaseapp.com`);
    }
    if (parsed.config.appId) setAppId(parsed.config.appId);

    setSnippetFeedback({
      type: 'success',
      text: 'Campos preenchidos automaticamente sem aspas ou vírgulas. Clique em "Testar Conexão Agora" ou "Salvar".',
    });
  };

  const handleTestConnection = async () => {
    setFormError('');
    const cleaned = sanitizeFirebaseClientConfig({
      projectId,
      apiKey,
      authDomain: authDomain.trim() || (projectId.trim() ? `${projectId.trim()}.firebaseapp.com` : ''),
      appId,
    });

    if (!cleaned.projectId || !cleaned.apiKey) {
      setFormError('Informe o Project ID e a API Key Web para executar o teste real de conexão.');
      return;
    }

    setProjectId(cleaned.projectId);
    setApiKey(cleaned.apiKey);
    if (cleaned.authDomain) setAuthDomain(cleaned.authDomain);
    if (cleaned.appId) setAppId(cleaned.appId);

    setIsTesting(true);
    setTestResult(null);

    const res = await testFirestoreConnection(cleaned);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSaveConfig = async () => {
    setFormError('');
    const cleaned = sanitizeFirebaseClientConfig({
      projectId,
      apiKey,
      authDomain: authDomain.trim() || (projectId.trim() ? `${projectId.trim()}.firebaseapp.com` : ''),
      appId,
    });

    if (!cleaned.projectId || !cleaned.apiKey) {
      setFormError('Project ID e API Key Web são obrigatórios para conectar o Firebase.');
      return;
    }

    setProjectId(cleaned.projectId);
    setApiKey(cleaned.apiKey);
    if (cleaned.authDomain) setAuthDomain(cleaned.authDomain);
    if (cleaned.appId) setAppId(cleaned.appId);

    setIsSaving(true);
    const keyCheck = await verifyFirebaseWebApiKey(cleaned.apiKey);
    setIsSaving(false);

    if (!keyCheck.valid) {
      setFormError(
        `${keyCheck.message || 'API Key inválida.'}${keyCheck.details ? ` ${keyCheck.details}` : ''}`
      );
      return;
    }

    saveManualConfig(cleaned);
    setSavedConfig(getSavedManualConfig());
    refreshFirebaseAuthBinding();
    if (onSuccess) onSuccess();
    onClose();
  };

  const handleDisconnect = () => {
    removeManualConfig();
    refreshFirebaseAuthBinding();
    setSavedConfig(null);
    setProjectId('');
    setApiKey('');
    setAuthDomain('');
    setAppId('');
    setSnippetText('');
    setSnippetFeedback(null);
    setFormError('');
    setTestResult(null);
    setConfirmingDisconnect(false);
    if (onSuccess) onSuccess();
  };

  const sampleRules = `// Utilize o arquivo completo /firestore.rules da raiz do projeto no Firebase Console > Firestore > Regras.
// Ele garante bloqueio de acesso anônimo, imutabilidade das movimentações (ABNT NBR 12962) e controle RBAC (ADMIN, SUPERVISOR, OPERADOR, CONSULTA).`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0f121a] border border-[#272e40] shadow-2xl text-gray-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#202636] bg-[#090b10]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-500/50">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Assistente de Conexão com Firebase & Google Cloud
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-950 text-red-300 border border-red-800/80">
                  Firestore & Auth
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Guia interativo para conectar Cloud Firestore e Firebase Authentication
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a1e2b] transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Connection Status Banner (Honest verified state) */}
        <div className="px-5 py-3 bg-[#141822] border-b border-[#202636] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400 font-medium">Status Real:</span>
            {status.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/80 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Conectado e Verificado: <strong className="font-mono">{status.projectId}</strong>
              </span>
            ) : status.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-sky-950 text-sky-300 border border-sky-700/80 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Configurado ({status.projectId}) — {status.phase === 'ERROR' ? 'Erro na conexão' : 'Aguardando login/verificação'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Não Conectado (Armazenamento Local Ativo)
              </span>
            )}
          </div>

          {status.isConfigured && (
            <div className="flex items-center gap-2">
              {confirmingDisconnect ? (
                <>
                  <span className="text-[11px] text-rose-300">Confirmar desconexão?</span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-bold"
                  >
                    Sim, Desconectar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDisconnect(false)}
                    className="px-2 py-1 text-[11px] text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(true)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium"
                >
                  Desconectar Projeto
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-[#202636] bg-[#0c0e15] text-xs font-semibold">
          {[
            { num: 1, label: '1. Firebase Console' },
            { num: 2, label: '2. Criar Firestore' },
            { num: 3, label: '3. Obter Chaves' },
            { num: 4, label: '4. Conectar & Testar' },
          ].map((step) => (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`py-3 px-2 text-center transition-all border-b-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeStep === step.num
                  ? 'border-red-500 text-white bg-[#141824]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#11141e]'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  activeStep === step.num
                    ? 'bg-red-600 text-white'
                    : 'bg-[#222736] text-gray-400'
                }`}
              >
                {step.num}
              </span>
              <span className="text-[11px] sm:text-xs truncate">{step.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[60vh] overflow-y-auto text-xs">
          {/* STEP 1: Firebase Console Access */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#141722] border border-[#252b3d] space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-red-400" />
                    <span>Passo 1: Acessar o Console Oficial do Firebase</span>
                  </h3>
                  <a
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shadow transition-colors"
                  >
                    <span>Abrir Firebase Console</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  O Firebase é a plataforma da Google que hospeda seu banco de dados em tempo real e autenticação.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-gray-400">
                  O que fazer na página do Firebase:
                </h4>
                <ol className="space-y-3 pl-2">
                  <li className="flex gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-950 text-red-400 border border-red-800 flex items-center justify-center font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <strong className="text-white">Faça login com sua conta Google</strong>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        A mesma conta utilizada no Google AI Studio (ex: seu e-mail Google).
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-950 text-red-400 border border-red-800 flex items-center justify-center font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <strong className="text-white">Clique em "Adicionar projeto" (ou selecione um existente)</strong>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        Dê o nome de <strong className="text-gray-200">Extintores Manager</strong> ao projeto. O Firebase gerará um identificador único (ex: <code className="text-red-300 font-mono">extintores-manager-12345</code>).
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-950 text-red-400 border border-red-800 flex items-center justify-center font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <strong className="text-white">Google Analytics (Opcional)</strong>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        Você pode habilitar ou desmarcar o Google Analytics conforme sua preferência, e clicar em <strong className="text-gray-200">Criar projeto</strong>.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveStep(2)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d2230] hover:bg-[#282f42] text-white font-bold transition-colors"
                >
                  <span>Avançar para o Passo 2</span>
                  <ArrowRight className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Firestore Database Creation */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#141722] border border-[#252b3d] space-y-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>Passo 2: Ativar o Cloud Firestore (Banco de Dados)</span>
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  No menu lateral esquerdo do Firebase Console, acesse a seção de banco de dados.
                </p>
              </div>

              <ol className="space-y-3 pl-2">
                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <strong className="text-white">Clique em "Criação" (Build) &gt; "Firestore Database"</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      No centro da tela, clique no botão <strong className="text-white">"Criar banco de dados"</strong>.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <strong className="text-white">Localização do Servidor (Região)</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      Para o Brasil, selecione <code className="text-emerald-300 font-mono">southamerica-east1 (São Paulo)</code> ou mantenha o padrão <code className="text-emerald-300 font-mono">us-east1</code> para menor latência.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <strong className="text-white">Regras de Segurança Iniciais</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      Selecione <strong className="text-gray-200">"Iniciar no modo de teste"</strong> (para desenvolvimento imediato) ou utilize as regras seguras abaixo na aba <strong className="text-gray-200">Regras (Rules)</strong>.
                    </p>
                  </div>
                </li>
              </ol>

              {/* Sample Rules Box */}
              <div className="p-3.5 rounded-xl bg-[#090b10] border border-[#212737] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-gray-300 font-bold flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5 text-red-400" />
                    Regras de Segurança Prontas (ABNT NBR 12962):
                  </span>
                  <button
                    onClick={() => handleCopy(sampleRules, 'rules')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181d28] hover:bg-[#222838] text-gray-200 text-[10px] font-semibold border border-[#2e374b] transition-colors"
                  >
                    {copiedSection === 'rules' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-gray-400" />
                        <span>Copiar Regras</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-[10px] text-gray-300 overflow-x-auto p-2 bg-[#050608] rounded-lg">
                  {sampleRules}
                </pre>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white"
                >
                  Voltar
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d2230] hover:bg-[#282f42] text-white font-bold transition-colors"
                >
                  <span>Avançar para o Passo 3</span>
                  <ArrowRight className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Web App Registration & Keys */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#141722] border border-[#252b3d] space-y-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Server className="h-4 w-4 text-sky-400" />
                  <span>Passo 3: Registrar Aplicativo Web & Obter Chaves</span>
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Para que o Extintores Manager se comunique com seu banco, precisamos do identificador do seu app.
                </p>
              </div>

              <ol className="space-y-3 pl-2">
                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <strong className="text-white">Acesse as Configurações do Projeto</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      No menu lateral superior, clique no ícone de engrenagem ⚙️ &gt; <strong className="text-gray-200">Configurações do projeto</strong> (Project Settings).
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <strong className="text-white">Na aba "Geral", desça até "Seus aplicativos"</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      Clique no ícone Web (<code className="text-sky-300 font-mono font-bold">&lt;/&gt;</code>) para adicionar um aplicativo web.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <strong className="text-white">Copie as credenciais de configuração (firebaseConfig)</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      O Firebase exibirá um código com <code className="text-sky-300 font-mono">projectId</code>, <code className="text-sky-300 font-mono">apiKey</code> e <code className="text-sky-300 font-mono">authDomain</code>.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <strong className="text-white">Ative o Firebase Authentication (Obrigatório)</strong>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      No menu lateral, vá em <strong className="text-gray-200">Criação &gt; Authentication</strong>, clique em <strong className="text-gray-200">"Vamos começar"</strong> e ative os métodos <strong className="text-gray-200">E-mail/senha</strong> e <strong className="text-gray-200">Google</strong>. Em <strong className="text-gray-200">Settings &gt; Authorized domains</strong>, adicione também o domínio atual da aplicação.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white"
                >
                  Voltar
                </button>
                <button
                  onClick={() => setActiveStep(4)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold shadow-md shadow-red-950/60 transition-all"
                >
                  <span>Informar Credenciais & Conectar</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Interactive Connect & Test Form */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#141722] border border-[#252b3d] space-y-1">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-red-500" />
                  <span>Passo 4: Conectar & Testar a Conexão em Tempo Real</span>
                </h3>
                <p className="text-gray-300 text-[11px]">
                  Cole o código <code className="text-red-300 font-mono">firebaseConfig</code> do Firebase Console ou preencha os campos individualmente.
                </p>
              </div>

              {/* Paste entire firebaseConfig snippet helper */}
              <div className="p-3.5 rounded-xl bg-[#121622] border border-[#273147] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-bold text-gray-200 text-[11px] flex items-center gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5 text-sky-400" />
                    <span>Colar código firebaseConfig completo (Auto-Preencher)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => applySnippet(snippetText)}
                    disabled={!snippetText.trim()}
                    className="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold text-[10px] disabled:opacity-40 transition-colors"
                  >
                    Auto-Preencher Campos
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={snippetText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSnippetText(val);
                    if (val.includes('apiKey') && val.includes('projectId')) {
                      applySnippet(val);
                    }
                  }}
                  placeholder={'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "seu-projeto.firebaseapp.com",\n  projectId: "seu-projeto"\n};'}
                  className="w-full rounded-lg bg-[#0b0d14] border border-[#242c3f] px-3 py-2 font-mono text-[11px] text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none"
                />
                {snippetFeedback && (
                  <p
                    className={`text-[11px] font-medium ${
                      snippetFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {snippetFeedback.text}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-300 mb-1">
                    ID do Projeto (Project ID) *
                  </label>
                  <input
                    type="text"
                    placeholder="ex: extintores-manager-8721a"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-xl bg-[#161a25] border border-[#2b3346] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Encontrado no Firebase Console &gt; Configurações do Projeto &gt; ID do Projeto.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-gray-300 mb-1">
                    API Key (Chave da Web) *
                  </label>
                  <input
                    type="text"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-xl bg-[#161a25] border border-[#2b3346] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-300 mb-1">
                    Domínio de Autenticação (Auth Domain)
                  </label>
                  <input
                    type="text"
                    placeholder={`${projectId.trim() || 'meu-projeto'}.firebaseapp.com`}
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    className="w-full rounded-xl bg-[#161a25] border border-[#2b3346] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-300 mb-1">
                    App ID (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="1:1234567890:web:abcdef123456"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full rounded-xl bg-[#161a25] border border-[#2b3346] px-3.5 py-2 font-mono text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Real-time Test Result Alert */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    testResult.verifiedRead
                      ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
                      : testResult.success
                      ? 'bg-sky-950/80 border-sky-700/80 text-sky-200'
                      : 'bg-rose-950/80 border-rose-700/80 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold text-xs">{testResult.message}</p>
                    {testResult.details && (
                      <p className="text-[11px] opacity-90">{testResult.details}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#202636]">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !projectId.trim() || !apiKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1d2331] hover:bg-[#262f43] text-gray-200 border border-[#343e57] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 text-sky-400 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Agora'}</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={isSaving || isTesting || !projectId.trim() || !apiKey.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-950/60 disabled:opacity-50 transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isSaving ? 'Validando API Key...' : 'Salvar & Ir para Autenticação'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
