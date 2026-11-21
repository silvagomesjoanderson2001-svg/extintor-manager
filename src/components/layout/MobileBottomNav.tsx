import React from 'react';
import {
  LayoutDashboard,
  Flame,
  ArrowLeftRight,
  AlertTriangle,
  Menu,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMobileSidebar: () => void;
  alertsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileSidebar,
  alertsCount,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0e1017]/95 border-t border-[#222734] backdrop-blur-md px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
      {/* 1. Dashboard */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] min-h-[48px] transition-colors ${
          activeTab === 'dashboard' ? 'text-red-400 font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <LayoutDashboard className="h-5 w-5 mb-0.5" />
        <span className="text-[10px]">Início</span>
      </button>

      {/* 2. Extintores */}
      <button
        onClick={() => setActiveTab('extintores')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] min-h-[48px] transition-colors ${
          activeTab === 'extintores' ? 'text-red-400 font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Flame className="h-5 w-5 mb-0.5" />
        <span className="text-[10px]">Extintores</span>
      </button>

      {/* 3. Movimentações */}
      <button
        onClick={() => setActiveTab('movimentacoes')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] min-h-[48px] transition-colors ${
          activeTab === 'movimentacoes' ? 'text-red-400 font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <ArrowLeftRight className="h-5 w-5 mb-0.5" />
        <span className="text-[10px]">Movimentos</span>
      </button>

      {/* 4. Alertas */}
      <button
        onClick={() => setActiveTab('alertas')}
        className={`relative flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] min-h-[48px] transition-colors ${
          activeTab === 'alertas' ? 'text-red-400 font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <AlertTriangle className="h-5 w-5 mb-0.5" />
        {alertsCount > 0 && (
          <span className="absolute top-1 right-2.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white px-1">
            {alertsCount}
          </span>
        )}
        <span className="text-[10px]">Alertas</span>
      </button>

      {/* 5. Menu Completo (11 opções) */}
      <button
        onClick={onOpenMobileSidebar}
        className="flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] min-h-[48px] text-gray-400 hover:text-white transition-colors"
        aria-label="Abrir menu completo do sistema"
      >
        <Menu className="h-5 w-5 mb-0.5" />
        <span className="text-[10px]">Menu</span>
      </button>
    </nav>
  );
};
