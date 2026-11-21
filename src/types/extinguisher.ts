export type ExtinguisherType = 
  | 'ABC_PO' // Pó Químico Seco ABC (Fosfato Monoamônico)
  | 'BC_PO'  // Pó Químico Seco BC (Bicarbonato de Sódio)
  | 'CO2'    // Dióxido de Carbono (CO2)
  | 'AGUA'   // Água Pressurizada (AP)
  | 'ESPUMA'; // Espuma Mecânica

export type OperationalCondition = 
  | 'OPERACIONAL'     // Operacional / Pronto para uso
  | 'EM_RECARGA'      // Em recarga / Manutenção externa
  | 'VAZIO'           // Vazio / Descarregado
  | 'INTERDITADO'     // Interditado / Condenado / Danificado
  | 'EM_QUARENTENA';  // Em quarentena / Avaliação técnica

export type PhysicalLocationType =
  | 'ESTOQUE'        // Estoque / Almoxarifado Central
  | 'CAMPO';          // Em campo / Setores da empresa / Postos de incêndio

export type MovementType =
  | 'ENTRADA_ESTOQUE'    // Entrada no estoque (aquisição ou recebimento)
  | 'SAIDA_CAMPO'        // Saída para campo (alocação em posto)
  | 'RETORNO_ESTOQUE'    // Retorno ao estoque (remanejamento)
  | 'ENVIO_RECARGA'      // Envio para recarga / manutenção externa
  | 'RETORNO_RECARGA'    // Retorno da recarga
  | 'UTILIZACAO'         // Utilização em ocorrência / princípio de incêndio
  | 'INTERDICAO';        // Interdição / Condenação

export type UserRole = 
  | 'ADMIN'       // Administrador: controle total
  | 'SUPERVISOR'  // Supervisor: gerenciamento operacional
  | 'OPERADOR'    // Operador: cadastro e movimentações
  | 'CONSULTA'    // Consulta: somente leitura
  | 'TST'         // Técnico de Seg. do Trabalho (compatibilidade -> Supervisor)
  | 'ALMOXARIFE'  // Almoxarifado / Estoque (compatibilidade -> Operador)
  | 'INSPETOR';   // Inspetor / Brigadista (compatibilidade -> Consulta)

export type UserStatus = 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';

export interface User {
  id: string;
  firebaseUid?: string;
  authProvider?: 'password' | 'google.com' | 'local';
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  authorizedUnitIds?: string[]; // IDs das unidades autorizadas (ex: ['unit-1', 'unit-2'] ou ['ALL'])
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  passwordHash?: string; // Armazenado com hash seguro, nunca em texto puro
}

export interface Unit {
  id: string;
  name: string;
  code: string; // Ex: UN-MTZ, UN-FAB, UN-LOG
  city: string;
  state: string;
  address: string;
  responsibleTst: string;
  phone: string;
  createdAt: string;
}

export interface SystemSettings {
  companyName: string;
  cnpj: string;
  sesmtDepartment: string;
  minTechnicalReservePercent: number;
  maintenanceAlertWindowDays: number;
  autoSyncFirestore: boolean;
}

export interface Extinguisher {
  id: string; // Identificação única individual (ex: EXT-001)
  patrimonyNumber: string; // Número patrimonial (ex: PAT-2024-001)
  type: ExtinguisherType;
  capacity: string; // ex: "4 kg", "6 kg", "10 L"
  manufacturer: string; // Fabricante (ex: Kidde, Mocelin, Resil, Bucka)
  serialNumber: string; // Número de série do cilindro
  locationArea: PhysicalLocationType; // ESTOQUE ou CAMPO
  locationDetails: string; // Localização detalhada (ex: "Almoxarifado Prateleira A-02" ou "Galpão 3 - Coluna B4")
  manufacturingDate: string; // YYYY-MM-DD
  lastRechargeDate: string; // YYYY-MM-DD
  nextMaintenanceDate: string; // YYYY-MM-DD (inspeção periódica / Nível 2)
  hydrostaticExpirationDate: string; // YYYY-MM-DD (ensaio hidrostático 5 anos / Nível 3)
  operationalCondition: OperationalCondition;
  photoUrl?: string;
  sealNumber?: string; // Número do lacre de segurança
  hasPressureGaugeNormal: boolean; // Manômetro na faixa verde
  notes?: string;
  isArchived?: boolean; // Se foi arquivado/desativado dos registros ativos
  archivedAt?: string; // Data e hora do arquivamento
  archivedReason?: string; // Motivo da desativação
  archivedBy?: string; // Usuário responsável
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timestamp: number;
  extinguisherId: string;
  extinguisherPatrimony: string;
  extinguisherType: ExtinguisherType;
  movementType: MovementType;
  originLocation: string;
  destinationLocation: string;
  responsibleUserId: string;
  responsibleUserName: string;
  incidentDescription?: string; // Para movimentações de ocorrência
  notes: string;
}

export interface AlertItem {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  extinguisherId: string;
  extinguisherPatrimony: string;
  dueDate?: string;
  daysRemaining?: number;
  type: 'EXPIRED' | 'DUE_SOON' | 'INTERDICTED' | 'EMPTY' | 'INSPECTION_OVERDUE';
}

export interface DashboardMetrics {
  totalExtinguishers: number;
  inStockCount: number;
  inFieldCount: number;
  inRechargeCount: number;
  inUseCount: number; // Operacional em campo
  emptyCount: number;
  interdictedCount: number;
  alertsCount: number;
  dueSoonCount: number;
  expiredCount: number;
}
