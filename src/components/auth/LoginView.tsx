import React, { useState } from 'react';
import {
  ShieldAlert,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  LogOut,
  KeyRound,
  Settings,
  Wrench,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getFirebaseConnectionStatus,
  removeManualConfig,
} from '../../services/firebaseConfig';

interface LoginViewProps {
  onOpenFirebaseModal: () => void;
}

type AuthTab = 'LOGIN' | 'FIRST_ACCESS' | 'RESET';

export const LoginView: React.FC<LoginViewProps> = ({ onOpenFirebaseModal }) => {
  const {
    firebaseUser,
    currentUser,
    isUnauthorizedAccount,
    isBlockedAccount,
    authError,
    loginWithEmail,
    registerFirstAccessWithEmail,
    loginWithGoogle,
    sendResetPassword,
    logout,
    refreshFirebaseAuthBinding,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fbStatus = getFirebaseConnectionStatus();

  // State 1: Signed into Firebase Auth, but blocked or awaiting Admin authorization
  if (firebaseUser && (isUnauthorizedAccount || isBlockedAccount)) {
    return (
      <div className="min-h-screen bg-[#0a0c11] text-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#11141d] border border-red-900/60 p-6 shadow-2xl space-y-5 text-center">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-red-950/90 border border-red-700/80 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-black text-white">
              {isBlockedAccount
                ? 'Acesso Suspenso pelo Administrador'
                : 'Conta Aguardando Autorização'}
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isBlockedAccount
                ? `A conta "${currentUser?.email}" está atualmente bloqueada no controle de acessos do Extintores Manager.`
                : `Você autenticou com "${firebaseUser.email}", mas este e-mail ainda não foi pré-autorizado por um Administrador no módulo de Usuários.`}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171b26] border border-[#262e40] text-left text-xs space-y-1">
            <div className="text-gray-400">Conta autenticada:</div>
            <div className="font-mono font-bold text-white break-all">{firebaseUser.email}</div>
            {fbStatus.projectId && (
              <div className="text-[11px] text-gray-400 pt-1">
                Projeto Firebase: <span className="font-mono text-gray-200">{fbStatus.projectId}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => logout()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/60 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair desta Conta e Trocar Usuário</span>
            </button>

            <button
              onClick={onOpenFirebaseModal}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#181d28] hover:bg-[#222938] text-gray-300 border border-[#2c3549] transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Verificar Configuração do Firebase</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setLocalError('Informe seu e-mail corporativo.');
      return;
    }

    setIsSubmitting(true);

    if (tab === 'RESET') {
      const res = await sendResetPassword(email);
      setIsSubmitting(false);
      if (!res.success) {
        setLocalError(res.error || 'Erro ao enviar e-mail de redefinição.');
        return;
      }
      setSuccessMsg(
        `Link oficial de redefinição de senha enviado para ${email.trim()}. Verifique sua caixa de entrada ou spam.`
      );
      return;
    }

    if (!password || password.length < 6) {
      setIsSubmitting(false);
      setLocalError('A senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (tab === 'FIRST_ACCESS') {
      if (!name.trim()) {
        setIsSubmitting(false);
        setLocalError('Informe seu nome completo para concluir o primeiro acesso.');
        return;
      }
      const res = await registerFirstAccessWithEmail(name, email, password);
      setIsSubmitting(false);
      if (!res.success) {
        setLocalError(res.error || 'Não foi possível concluir o primeiro acesso.');
      }
      return;
    }

    const res = await loginWithEmail(email, password);
    setIsSubmitting(false);
    if (!res.success) {
      setLocalError(res.error || 'Falha ao entrar.');
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError('');
    setSuccessMsg('');
    setIsSubmitting(true);
    const res = await loginWithGoogle();
    setIsSubmitting(false);
    if (!res.success) {
      setLocalError(res.error || 'Falha ao autenticar com Google.');
    }
  };

  const displayError =
    localError ||
    authError ||
    (fbStatus.phase === 'ERROR' ? fbStatus.errorMessage || '' : '');

  const isConfigOrApiKeyError = Boolean(
    displayError &&
      (displayError.includes('configuration-not-found') ||
        displayError.includes('CONFIGURATION_NOT_FOUND') ||
        displayError.includes('api-key-not-valid') ||
        displayError.includes('invalid-api-key') ||
        displayError.includes('API Key') ||
        displayError.includes('unauthorized-domain') ||
        displayError.includes('Domínio') ||
        displayError.includes('HTTP Referrer') ||
        displayError.includes('Authentication ainda não foi ativado') ||
        fbStatus.phase === 'ERROR')
  );

  const isAuthNotEnabledError = Boolean(
    displayError &&
      (displayError.includes('configuration-not-found') ||
        displayError.includes('CONFIGURATION_NOT_FOUND') ||
        displayError.includes('Authentication ainda não foi ativado'))
  );

  const handleReturnToLocalMode = () => {
    removeManualConfig();
    refreshFirebaseAuthBinding();
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-[#7a0606] text-white shadow-xl shadow-red-950/70 ring-1 ring-red-500/40 mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">Extintores</span>
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/70 text-xs font-bold uppercase tracking-wider">
              Manager
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Controle Patrimonial, Estoque & Movimentações • Firebase Cloud Sync
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl bg-[#11141d] border border-[#252b3b] p-5 sm:p-6 shadow-2xl space-y-5">
          {/* Firebase Target Pill */}
          <div className="p-2.5 rounded-xl bg-[#161a25] border border-[#263044] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 truncate">
              <Cloud className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-gray-400">Projeto:</span>
              <span className="font-mono font-bold text-white truncate">
                {fbStatus.projectId || 'Não definido'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenFirebaseModal}
              className="text-red-400 hover:text-red-300 font-semibold shrink-0 ml-2 underline"
            >
              Configurar
            </button>
          </div>

          {/* Auth Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0c0e15] border border-[#202636] text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setTab('LOGIN');
                setLocalError('');
                setSuccessMsg('');
              }}
              className={`py-2 rounded-lg transition-colors ${
                tab === 'LOGIN'
                  ? 'bg-red-700 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('FIRST_ACCESS');
                setLocalError('');
                setSuccessMsg('');
              }}
              className={`py-2 rounded-lg transition-colors ${
                tab === 'FIRST_ACCESS'
                  ? 'bg-red-700 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Primeiro Acesso
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('RESET');
                setLocalError('');
                setSuccessMsg('');
              }}
              className={`py-2 rounded-lg transition-colors ${
                tab === 'RESET'
                  ? 'bg-red-700 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Redefinir Senha
            </button>
          </div>

          {displayError && (
            <div className="p-3.5 rounded-xl bg-rose-950/85 border border-rose-700/80 text-rose-200 text-xs space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{displayError}</span>
              </div>

              {isConfigOrApiKeyError && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-800/60">
                  {isAuthNotEnabledError && fbStatus.projectId && (
                    <a
                      href={`https://console.firebase.google.com/project/${encodeURIComponent(
                        fbStatus.projectId
                      )}/authentication`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Ativar Authentication no Firebase</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onOpenFirebaseModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shadow transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Corrigir API Key / Config. Firebase</span>
                  </button>
                  {fbStatus.source === 'MANUAL' && (
                    <button
                      type="button"
                      onClick={handleReturnToLocalMode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181d29] hover:bg-[#22293a] text-gray-200 border border-rose-700/60 font-semibold text-[11px] transition-colors"
                    >
                      <HardDrive className="h-3.5 w-3.5 text-amber-400" />
                      <span>Voltar ao Modo Local (Preservar Dados)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {tab === 'FIRST_ACCESS' && (
              <div>
                <label className="block font-semibold text-gray-300 mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full rounded-xl bg-[#161a25] border border-[#2c3448] pl-9 pr-3.5 py-2.5 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                E-mail Corporativo *
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  className="w-full rounded-xl bg-[#161a25] border border-[#2c3448] pl-9 pr-3.5 py-2.5 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            {tab !== 'RESET' && (
              <div>
                <label className="block font-semibold text-gray-300 mb-1">
                  {tab === 'FIRST_ACCESS' ? 'Definir Senha (mín. 6 caracteres) *' : 'Senha *'}
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-[#161a25] border border-[#2c3448] pl-9 pr-3.5 py-2.5 text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {tab === 'FIRST_ACCESS' && (
              <p className="text-[11px] text-gray-400 leading-relaxed bg-[#151924] p-2.5 rounded-xl border border-[#232b3d]">
                Use o e-mail previamente cadastrado pelo Administrador para ativar seu perfil (ADMIN, SUPERVISOR, OPERADOR ou CONSULTA), ou crie a conta inicial do projeto.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-950/60 disabled:opacity-50 transition-all"
            >
              {tab === 'RESET' ? (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>{isSubmitting ? 'Enviando...' : 'Enviar E-mail de Redefinição'}</span>
                </>
              ) : (
                <>
                  <span>
                    {isSubmitting
                      ? 'Autenticando...'
                      : tab === 'FIRST_ACCESS'
                      ? 'Ativar Conta e Entrar'
                      : 'Entrar no Sistema'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {tab !== 'RESET' && (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#23293a]" />
                <span className="shrink mx-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  ou acesse com
                </span>
                <div className="flex-grow border-t border-[#23293a]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#181d29] hover:bg-[#202636] text-white border border-[#2e384e] disabled:opacity-50 transition-colors"
              >
                <span className="font-black text-amber-400">G</span>
                <span>Entrar com Conta Google</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
