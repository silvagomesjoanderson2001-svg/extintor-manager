/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CloudOff, Database, Loader2, Settings, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import {
  subscribeFirebaseStatus,
  getFirebaseConnectionStatus,
  FirebaseConnectionStatus,
} from './services/firebaseConfig';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExtinguisherListView } from './components/extinguishers/ExtinguisherListView';
import { ExtinguisherFormModal } from './components/extinguishers/ExtinguisherFormModal';
import { ExtinguisherDetailModal } from './components/extinguishers/ExtinguisherDetailModal';
import { MovementsView } from './components/movements/MovementsView';
import { InventoryView } from './components/inventory/InventoryView';
import { RechargesView } from './components/recharges/RechargesView';
import { AlertsView } from './components/alerts/AlertsView';
import { ReportsView } from './components/reports/ReportsView';
import { UnitsView } from './components/units/UnitsView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';
import { FirebaseSetupModal } from './components/settings/FirebaseSetupModal';
import { storageService } from './services/storageService';
import {
  Extinguisher,
  Movement,
  DashboardMetrics,
  AlertItem,
  Unit,
} from './types/extinguisher';
import {
  calculateDashboardMetrics,
  generateAlerts,
} from './utils/extinguisherLogic';

function ExtintoresManagerApp() {
  const {
    currentUser,
    firebaseUser,
    isFirebaseMode,
    isAuthLoading,
    isUnauthorizedAccount,
    isBlockedAccount,
  } = useAuth();

  const [fbStatus, setFbStatus] = useState<FirebaseConnectionStatus>(() =>
    getFirebaseConnectionStatus()
  );

  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Navigation & layout: Dashboard is the primary default screen after start/login
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [extinguisherToEdit, setExtinguisherToEdit] = useState<Extinguisher | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedExtinguisherForDetail, setSelectedExtinguisherForDetail] =
    useState<Extinguisher | null>(null);

  const [extinguisherToDeleteRequested, setExtinguisherToDeleteRequested] =
    useState<Extinguisher | null>(null);

  const [isNewMovementModalOpen, setIsNewMovementModalOpen] = useState(false);
  const [preSelectedForMovement, setPreSelectedForMovement] =
    useState<Extinguisher | null>(null);

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // Subscribe to reactive storage (single unified database)
  useEffect(() => {
    const unsubStatus = subscribeFirebaseStatus(setFbStatus);
    const unsubExt = storageService.subscribeExtinguishers((data) => {
      setExtinguishers([...data]);
    });
    const unsubMov = storageService.subscribeMovements((data) => {
      setMovements([...data]);
    });
    const unsubUnits = storageService.subscribeUnits((data) => {
      setUnits([...data]);
    });

    return () => {
      unsubStatus();
      unsubExt();
      unsubMov();
      unsubUnits();
    };
  }, []);

  // Compute live unified metrics and alerts whenever data updates
  const metrics: DashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(extinguishers);
  }, [extinguishers]);

  const alerts: AlertItem[] = useMemo(() => {
    return generateAlerts(extinguishers);
  }, [extinguishers]);

  // Handlers for modal interactions
  const handleOpenNewExtinguisher = () => {
    setExtinguisherToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditExtinguisher = (ext: Extinguisher) => {
    setExtinguisherToEdit(ext);
    setIsFormModalOpen(true);
  };

  const handleOpenNewMovement = (ext?: Extinguisher) => {
    setPreSelectedForMovement(ext || null);
    setActiveTab('movimentacoes');
    setIsNewMovementModalOpen(true);
  };

  const handleViewDetails = (ext: Extinguisher) => {
    setSelectedExtinguisherForDetail(ext);
    setIsDetailModalOpen(true);
  };

  const handleRefresh = () => {
    setExtinguishers([...storageService.getExtinguishers()]);
    setMovements([...storageService.getMovements()]);
    setUnits([...storageService.getUnits()]);
  };

  if (isFirebaseMode && isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#090b10] text-gray-200 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/80 border border-red-800/70 text-red-400 mx-auto">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-white">Conectando ao Firebase...</h2>
          <p className="text-xs text-gray-400">
            Verificando sessão no Firebase Authentication e permissões no Cloud Firestore.
          </p>
        </div>
      </div>
    );
  }

  if (
    isFirebaseMode &&
    (!firebaseUser || isUnauthorizedAccount || isBlockedAccount || !currentUser)
  ) {
    return (
      <>
        <LoginView onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)} />
        <FirebaseSetupModal
          isOpen={isFirebaseModalOpen}
          onClose={() => setIsFirebaseModalOpen(false)}
          onSuccess={handleRefresh}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-gray-100 flex font-sans antialiased selection:bg-red-900 selection:text-white">
      {/* 11-Option Sidebar Navigation (Desktop and Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab === 'cadastro' ? 'extintores' : activeTab}
        setActiveTab={(tab) => {
          if (tab === 'cadastro') {
            handleOpenNewExtinguisher();
          } else {
            setActiveTab(tab);
          }
        }}
        alertsCount={alerts.length}
        rechargesCount={metrics.inRechargeCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-72">
        {/* Top Header */}
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenNewExtinguisher={handleOpenNewExtinguisher}
          onOpenNewMovement={() => handleOpenNewMovement()}
          onSelectAlertsTab={() => setActiveTab('alertas')}
          onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
          alerts={alerts}
          searchTerm={searchTerm}
          setSearchTerm={(term) => {
            setSearchTerm(term);
            if (term && activeTab !== 'extintores') {
              setActiveTab('extintores');
            }
          }}
        />

        {/* View Router (Using the same central database) */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {!isFirebaseMode && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-950/35 border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <CloudOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-200">
                    Firebase ainda não conectado — Armazenamento Local (localStorage) ativo
                  </p>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    {fbStatus.statusMessage} Seus registros locais permanecem preservados e podem ser migrados após conectar ao seu projeto Firebase.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('configuracoes')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#181d28] hover:bg-[#222938] text-gray-200 border border-[#2d3648] transition-colors"
                >
                  <Database className="h-3.5 w-3.5 text-sky-400" />
                  <span>Backup & Migração</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFirebaseModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-black transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Conectar Firebase</span>
                </button>
              </div>
            </div>
          )}

          {isFirebaseMode && fbStatus.phase === 'ERROR' && fbStatus.errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-200">
                    Falha na sincronização em tempo real com o Cloud Firestore
                  </p>
                  <p className="text-[11px] text-rose-200/85 mt-0.5">{fbStatus.errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFirebaseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-700 hover:bg-rose-600 text-white shrink-0"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Diagnosticar Conexão</span>
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              extinguishers={extinguishers}
              movements={movements}
              alerts={alerts}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onOpenNewExtinguisher={handleOpenNewExtinguisher}
              onOpenNewMovement={() => handleOpenNewMovement()}
              onViewExtinguisherDetails={handleViewDetails}
            />
          )}

          {activeTab === 'extintores' && (
            <ExtinguisherListView
              extinguishers={extinguishers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onOpenNewExtinguisher={handleOpenNewExtinguisher}
              onOpenEditExtinguisher={handleOpenEditExtinguisher}
              onOpenNewMovement={handleOpenNewMovement}
              onViewDetails={handleViewDetails}
              onRefresh={handleRefresh}
              extinguisherToDeleteRequested={extinguisherToDeleteRequested}
              onClearDeleteRequest={() => setExtinguisherToDeleteRequested(null)}
            />
          )}

          {activeTab === 'movimentacoes' && (
            <MovementsView
              movements={movements}
              extinguishers={extinguishers}
              isNewMovementModalOpen={isNewMovementModalOpen}
              setIsNewMovementModalOpen={setIsNewMovementModalOpen}
              preSelectedExtinguisher={preSelectedForMovement}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'estoque' && (
            <InventoryView
              extinguishers={extinguishers}
              movements={movements}
              onOpenNewMovement={handleOpenNewMovement}
              onViewDetails={handleViewDetails}
            />
          )}

          {activeTab === 'recargas' && (
            <RechargesView
              extinguishers={extinguishers}
              movements={movements}
              onOpenNewMovement={handleOpenNewMovement}
              onViewDetails={handleViewDetails}
            />
          )}

          {activeTab === 'alertas' && (
            <AlertsView
              alerts={alerts}
              extinguishers={extinguishers}
              onOpenNewMovement={handleOpenNewMovement}
              onViewDetails={handleViewDetails}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView
              extinguishers={extinguishers}
              movements={movements}
            />
          )}

          {activeTab === 'unidades' && (
            <UnitsView
              units={units}
              extinguishers={extinguishers}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'usuarios' && (
            <UsersView />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView
              onRefreshAll={handleRefresh}
              onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Fast 1-thumb touch navigation) */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'cadastro') {
              handleOpenNewExtinguisher();
            } else {
              setActiveTab(tab);
            }
          }}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          alertsCount={alerts.length}
        />
      </div>

      {/* Global Form Modal (Cadastrar ou Editar Extintor) */}
      <ExtinguisherFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setExtinguisherToEdit(null);
        }}
        extinguisherToEdit={extinguisherToEdit}
        onSaved={handleRefresh}
      />

      {/* Global Prontuário Individual Modal */}
      <ExtinguisherDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedExtinguisherForDetail(null);
        }}
        extinguisher={selectedExtinguisherForDetail}
        movements={movements}
        onEdit={(ext) => {
          setIsDetailModalOpen(false);
          handleOpenEditExtinguisher(ext);
        }}
        onNewMovement={(ext) => {
          setIsDetailModalOpen(false);
          handleOpenNewMovement(ext);
        }}
        onDelete={(ext) => {
          setIsDetailModalOpen(false);
          setExtinguisherToDeleteRequested(ext);
          setActiveTab('extintores');
        }}
      />

      {/* Firebase Cloud Connection & Setup Modal */}
      <FirebaseSetupModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ExtintoresManagerApp />
    </AuthProvider>
  );
}
