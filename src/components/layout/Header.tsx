import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  PlusCircle,
  ArrowLeftRight,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  Cloud,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AlertItem } from '../../types/extinguisher';
import {
  getFirebaseConnectionStatus,
  subscribeFirebaseStatus,
  FirebaseConnectionStatus,
} from '../../services/firebaseConfig';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenNewExtinguisher: () => void;
  onOpenNewMovement: () => void;
  onSelectAlertsTab: () => void;
  onOpenFirebaseModal?: () => void;
  alerts: AlertItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenNewExtinguisher,
  onOpenNewMovement,
  onSelectAlertsTab,
  onOpenFirebaseModal,
  alerts,
  searchTerm,
  setSearchTerm,
}) => {
  const {
    currentUser,
    availableUsers,
    switchUser,
    logout,
    isFirebaseMode,
    canCreateExtinguisher,
    canRegisterMovement,
  } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [fbStatus, setFbStatus] = useState<FirebaseConnectionStatus>(() =>
    getFirebaseConnectionStatus()
  );

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const alertsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeFirebaseStatus((status) => setFbStatus(status));
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(event.target as Node)) {
        setShowAlertsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL');

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-[#242832] bg-[#0e1015]/95 px-4 md:px-8 backdrop-blur-md">
      {/* Left: Mobile trigger & Quick search */}
      <div className="flex items-center gap-3 md:gap-4 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1a1e27] border border-[#272c3a]"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por ID, patrimônio, série ou local..."
            className="w-full rounded-xl bg-[#171a22] border border-[#2a3040] py-2 pl-9 pr-4 text-sm text-gray-100 placeholder-gray-400 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-400 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Right Actions & Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Action: New Movement Button */}
        {canRegisterMovement && (
          <button
            onClick={onOpenNewMovement}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1c202a] text-gray-200 border border-[#2e3547] hover:bg-[#252b38] hover:text-white hover:border-red-700/50 transition-all shadow-xs"
            title="Registrar movimentação de extintor"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-red-400" />
            <span>Movimentação</span>
          </button>
        )}

        {/* Action: New Extinguisher Button */}
        {canCreateExtinguisher && (
          <button
            onClick={onOpenNewExtinguisher}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500 shadow-md shadow-red-950/60 transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo Extintor</span>
            <span className="sm:hidden">Novo</span>
          </button>
        )}

        {/* Firebase Cloud Connection Button */}
        {onOpenFirebaseModal && (
          <button
            onClick={onOpenFirebaseModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#161a24] hover:bg-[#202534] text-gray-200 border border-[#2c3345] hover:border-red-600/70 transition-all shadow-xs"
            title={fbStatus.statusMessage}
          >
            <Cloud className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline font-bold">Firebase</span>
            {fbStatus.isConnected ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Conectado" />
            ) : fbStatus.isConfigured ? (
              <span className="h-2 w-2 rounded-full bg-sky-400" title="Configurado" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-400" title="Não conectado" />
            )}
          </button>
        )}

        {/* Alerts Bell Popover */}
        <div className="relative" ref={alertsDropdownRef}>
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="relative p-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1a1e27] border border-[#272c3a] transition-all"
            aria-label="Notificações de alertas"
          >
            <Bell className="h-4.5 w-4.5" />
            {alerts.length > 0 && (
              <span
                className={`absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs ${
                  criticalAlerts.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-600'
                }`}
              >
                {alerts.length}
              </span>
            )}
          </button>

          {showAlertsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#141720] border border-[#272d3d] p-3 shadow-2xl z-50 text-gray-200">
              <div className="flex items-center justify-between pb-2 border-b border-[#242938]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-semibold text-sm text-white">Alertas do Sistema</span>
                </div>
                <span className="text-xs text-gray-400">Total: {alerts.length}</span>
              </div>

              <div className="mt-2 max-h-64 overflow-y-auto space-y-2 pr-1">
                {alerts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">
                    Nenhum alerta pendente no momento. Todos os extintores operacionais!
                  </p>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-950/40 border-red-800/60 text-red-200'
                          : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      }`}
                    >
                      <div className="font-semibold">{alert.title}</div>
                      <p className="mt-0.5 text-[11px] text-gray-300">{alert.description}</p>
                    </div>
                  ))
                )}
              </div>

              {alerts.length > 0 && (
                <button
                  onClick={() => {
                    setShowAlertsDropdown(false);
                    onSelectAlertsTab();
                  }}
                  className="mt-3 w-full py-2 text-center text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-[#1c212e] rounded-xl transition-colors"
                >
                  Ver todos os {alerts.length} alertas na Central →
                </button>
              )}
            </div>
          )}
        </div>

        {/* User Profile / Account Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl hover:bg-[#1a1e27] border border-[#272c3a] transition-all text-left"
            aria-label="Perfil do usuário"
          >
            <img
              src={
                currentUser?.avatarUrl ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
              }
              alt={currentUser?.name || 'Usuário'}
              className="h-7 w-7 rounded-full object-cover ring-1 ring-red-600/50"
            />
            <div className="hidden lg:block text-xs">
              <span className="font-semibold text-white block leading-tight">
                {currentUser?.name?.split(' ')[0] || 'Usuário'}
              </span>
              <span className="text-[10px] text-red-400 font-mono">{currentUser?.role || '-'}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden lg:block" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#141720] border border-[#272d3d] p-3 shadow-2xl z-50 text-gray-200">
              {isFirebaseMode ? (
                <div className="space-y-3">
                  <div className="pb-2 border-b border-[#242938]">
                    <div className="text-[10px] font-semibold tracking-wider uppercase text-emerald-400">
                      Conta Autenticada (Firebase)
                    </div>
                    <div className="font-semibold text-sm text-white mt-1">
                      {currentUser?.name || 'Usuário'}
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono truncate">
                      {currentUser?.email}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {currentUser?.department || 'SESMT'} •{' '}
                      <span className="text-red-300 font-mono font-bold">
                        {currentUser?.role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setShowUserDropdown(false);
                      await logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sair da Conta (Logout)</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="pb-2 mb-2 border-b border-[#242938]">
                    <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">
                      Sessão Local ({availableUsers.length > 0 ? 'Perfis Locais' : 'Sem Firebase'})
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {availableUsers.length > 0
                        ? 'Selecione um usuário local ou conecte o Firebase para login real:'
                        : 'Conecte o Firebase para habilitar login corporativo multi-dispositivo.'}
                    </p>
                  </div>

                  {availableUsers.length > 0 && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {availableUsers.map((user) => {
                        const isCurrent = user.id === currentUser?.id;
                        return (
                          <button
                            key={user.id}
                            onClick={() => {
                              switchUser(user.id);
                              setShowUserDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                              isCurrent
                                ? 'bg-red-950/60 border border-red-700/60 text-white font-medium'
                                : 'hover:bg-[#1d222e] text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={
                                  user.avatarUrl ||
                                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
                                }
                                alt={user.name}
                                className="h-7 w-7 rounded-full object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-white truncate">{user.name}</div>
                                <div className="text-[10px] text-gray-400 truncate">
                                  {user.department}
                                </div>
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-red-300 border border-[#333a4d] shrink-0">
                              {user.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-[#242938] flex items-center gap-2 text-[11px] text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Perfil ativo: {currentUser?.role || 'ADMIN'}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
