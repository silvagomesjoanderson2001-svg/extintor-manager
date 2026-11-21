import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Flame,
  ArrowLeftRight,
  Boxes,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Building2,
  Users,
  Settings,
  ShieldAlert,
  Database,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getFirebaseConnectionStatus,
  subscribeFirebaseStatus,
  FirebaseConnectionStatus,
} from '../../services/firebaseConfig';

export type ActiveTab =
  | 'dashboard'
  | 'cadastro'
  | 'extintores'
  | 'movimentacoes'
  | 'estoque'
  | 'recargas'
  | 'alertas'
  | 'relatorios'
  | 'unidades'
  | 'usuarios'
  | 'configuracoes';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  alertsCount: number;
  rechargesCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number | string | null;
  badgeColor?: string;
  hidden?: boolean;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  alertsCount,
  rechargesCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { currentUser, canCreateExtinguisher, canManageUsers } = useAuth();
  const [fbStatus, setFbStatus] = useState<FirebaseConnectionStatus>(() =>
    getFirebaseConnectionStatus()
  );

  useEffect(() => {
    return subscribeFirebaseStatus((status) => setFbStatus(status));
  }, []);

  // Exactly the 11 requested menu options
  const navItems: NavSection[] = [
    {
      group: 'Visão Geral & Operação',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'cadastro' as ActiveTab,
          label: 'Cadastro de Extintores',
          icon: PlusCircle,
          badge: null,
          hidden: !canCreateExtinguisher,
        },
        {
          id: 'extintores' as ActiveTab,
          label: 'Lista de Extintores',
          icon: Flame,
          badge: null,
        },
        {
          id: 'movimentacoes' as ActiveTab,
          label: 'Movimentações',
          icon: ArrowLeftRight,
          badge: null,
        },
      ],
    },
    {
      group: 'Logística & Controle',
      items: [
        {
          id: 'estoque' as ActiveTab,
          label: 'Estoque',
          icon: Boxes,
          badge: null,
        },
        {
          id: 'recargas' as ActiveTab,
          label: 'Recargas',
          icon: RefreshCw,
          badge: rechargesCount > 0 ? rechargesCount : null,
          badgeColor: 'bg-amber-600 text-white',
        },
        {
          id: 'alertas' as ActiveTab,
          label: 'Alertas de Vencimento',
          icon: AlertTriangle,
          badge: alertsCount > 0 ? alertsCount : null,
          badgeColor: 'bg-red-600 text-white',
        },
        {
          id: 'relatorios' as ActiveTab,
          label: 'Relatórios e Gráficos',
          icon: BarChart3,
          badge: null,
        },
      ],
    },
    {
      group: 'Administração & Cadastros',
      items: [
        {
          id: 'unidades' as ActiveTab,
          label: 'Unidades',
          icon: Building2,
          badge: null,
        },
        {
          id: 'usuarios' as ActiveTab,
          label: 'Usuários',
          icon: Users,
          badge: null,
          hidden: !canManageUsers, // Accessible exclusively to administrators
        },
        {
          id: 'configuracoes' as ActiveTab,
          label: 'Configurações',
          icon: Settings,
          badge: null,
        },
      ],
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-[#0e1017] text-gray-200 border-r border-[#222734] transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between px-5 border-b border-[#222734] bg-[#090b10]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-[#7a0606] text-white shadow-lg shadow-red-950/60 ring-1 ring-red-500/40">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-white">Extintores</span>
                <span className="font-bold text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/60">
                  Manager
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Controle Patrimonial & SESMT</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f232d]"
            aria-label="Fechar menu lateral"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 11 System Navigation Items */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {navItems.map((section) => (
            <div key={section.group} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                {section.group}
              </div>

              {section.items
                .filter((item) => !item.hidden)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs transition-all text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-red-900/90 to-red-800/80 text-white shadow-md shadow-red-950/50 border-l-4 border-red-500'
                          : 'text-gray-300 hover:bg-[#1a1e27] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4.5 w-4.5 transition-colors ${
                            isActive ? 'text-red-300' : 'text-gray-400'
                          }`}
                        />
                        <span className="font-semibold">{item.label}</span>
                      </div>

                      {item.badge !== null && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            item.badgeColor || 'bg-gray-700 text-gray-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Database & Sync Status */}
        <div className="p-3 mx-3 mb-2 rounded-xl bg-[#141720] border border-[#232938] text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Database
              className={`h-3.5 w-3.5 ${
                fbStatus.isConnected
                  ? 'text-emerald-400'
                  : fbStatus.isConfigured
                  ? 'text-sky-400'
                  : 'text-amber-400'
              }`}
            />
            <span className="font-semibold text-gray-200 text-[11px]">Banco de Dados</span>
            <span
              className={`ml-auto text-[9px] px-1.5 py-0.2 rounded border font-mono ${
                fbStatus.isConnected
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                  : fbStatus.isConfigured
                  ? 'bg-sky-950 text-sky-300 border-sky-800/60'
                  : 'bg-amber-950 text-amber-300 border-amber-800/60'
              }`}
            >
              {fbStatus.isConnected
                ? 'Firestore Ao Vivo'
                : fbStatus.isConfigured
                ? 'Auth Pendente'
                : 'Modo Local'}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-tight">
            {fbStatus.isConnected
              ? 'Sincronização em tempo real ativa com Cloud Firestore.'
              : fbStatus.isConfigured
              ? 'Firebase configurado; entre com sua conta para sincronizar.'
              : 'Armazenamento local ativo. Conecte o Firebase para multi-dispositivo.'}
          </p>
        </div>

        {/* Active User Footer */}
        <div className="p-3 border-t border-[#222734] bg-[#090b10]">
          <div className="flex items-center gap-2.5">
            <img
              src={
                currentUser?.avatarUrl ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
              }
              alt={currentUser?.name || 'Usuário'}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-red-600/40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {currentUser?.name || 'Sessão Ativa'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <p className="truncate text-[10px] text-red-300 font-medium">
                  {currentUser?.role || 'CONSULTA'} •{' '}
                  {currentUser?.department?.split(' ')[0] || 'SESMT'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
