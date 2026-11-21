import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Check,
  X,
  PlusCircle,
  KeyRound,
  ShieldAlert,
  Search,
  Filter,
  Edit,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Mail,
  Building2,
  Calendar,
  Eye,
  EyeOff,
  UserPlus,
  RefreshCw,
  Clock,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User, UserRole, UserStatus, Unit } from '../../types/extinguisher';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '../../utils/extinguisherLogic';
import { storageService } from '../../services/storageService';

export const UsersView: React.FC = () => {
  const { currentUser, switchUser, canManageUsers, isFirebaseMode } = useAuth();

  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [units, setUnits] = useState<Unit[]>(() => storageService.getUnits());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('SUPERVISOR');
  const [formDepartment, setFormDepartment] = useState('');
  const [formStatus, setFormStatus] = useState<UserStatus>('ATIVO');
  const [formUnits, setFormUnits] = useState<string[]>(['ALL']);
  const [formError, setFormError] = useState('');

  // Password Reset Modal
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [userForPasswordReset, setUserForPasswordReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Feedback Notifications & Inline Errors
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = storageService.subscribeUsers((data) => {
      setUsers([...data]);
    });
    const unsubUnits = storageService.subscribeUnits((data) => {
      setUnits([...data]);
    });
    return () => {
      unsubUsers();
      unsubUnits();
    };
  }, []);

  const showNotification = (msg: string) => {
    setFeedbackSuccess(msg);
    setActionError(null);
    setTimeout(() => {
      setFeedbackSuccess((prev) => (prev === msg ? null : prev));
    }, 9000);
  };

  // If the user does not have Administrator permissions
  if (!currentUser || !canManageUsers) {
    return (
      <div className="p-8 rounded-2xl bg-[#141720] border border-red-900/40 text-center max-w-xl mx-auto my-12 shadow-xl">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-red-950/80 border border-red-800 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito: Módulo de Usuários</h2>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          O gerenciamento de usuários, concessão de perfis e controle de acessos é reservado exclusivamente a usuários com perfil de <strong className="text-red-400">Administrador</strong>.
        </p>
        <div className="p-4 rounded-xl bg-[#1b1f2b] border border-[#2d3648] text-xs text-gray-300 text-left">
          <p className="font-semibold text-white mb-1">Seu Perfil Atual:</p>
          <div className="flex items-center gap-2">
            <span className="font-bold text-red-400">{currentUser?.name || 'Sessão não autenticada'}</span>
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono text-[10px]">
              {currentUser?.role || 'SEM PERFIL'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Caso precise realizar manutenções cadastrais em usuários, solicite a um Administrador autorizado.
          </p>
        </div>
      </div>
    );
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = u.name.toLowerCase().includes(term);
      const matchEmail = u.email.toLowerCase().includes(term);
      const matchDept = u.department?.toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchDept) return false;
    }
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    return true;
  });

  // Open Create Modal
  const handleOpenCreateUser = () => {
    setUserToEdit(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('SUPERVISOR');
    setFormDepartment('Segurança do Trabalho (SESMT)');
    setFormStatus('ATIVO');
    setFormUnits(['ALL']);
    setFormError('');
    setIsUserFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditUser = (user: User) => {
    setUserToEdit(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormStatus(user.status || 'ATIVO');
    setFormUnits(user.authorizedUnitIds && user.authorizedUnitIds.length > 0 ? user.authorizedUnitIds : ['ALL']);
    setFormError('');
    setIsUserFormOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Informe o nome completo do usuário.');
      return;
    }

    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('Informe um endereço de e-mail válido.');
      return;
    }

    if (!userToEdit && !isFirebaseMode && (!formPassword || formPassword.length < 6)) {
      setFormError('A senha inicial deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!userToEdit) {
        // Creation
        const res = await storageService.addUser(
          {
            name: formName.trim(),
            email: formEmail.trim(),
            password: isFirebaseMode ? '' : formPassword,
            role: formRole,
            department: formDepartment.trim(),
            authorizedUnitIds: formUnits,
          },
          currentUser
        );

        if (!res.success) {
          setFormError(res.error || 'Erro ao cadastrar usuário.');
          return;
        }

        showNotification(res.notice || `Usuário "${formName.trim()}" cadastrado com sucesso.`);
      } else {
        // Editing
        const res = await storageService.updateUser(
          userToEdit.id,
          {
            name: formName.trim(),
            role: formRole,
            department: formDepartment.trim(),
            authorizedUnitIds: formUnits,
            status: formStatus,
          },
          currentUser
        );

        if (!res.success) {
          setFormError(res.error || 'Erro ao atualizar dados do usuário.');
          return;
        }

        showNotification(`Dados do usuário "${formName.trim()}" atualizados com sucesso.`);
      }

      setIsUserFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status (Bloquear / Reativar)
  const handleToggleStatus = async (targetUser: User) => {
    setActionError(null);
    const res = await storageService.toggleUserStatus(targetUser.id, currentUser);
    if (!res.success) {
      setActionError(res.error || 'Não foi possível alterar o status do usuário.');
      return;
    }
    const newStatusLabel = targetUser.status === 'ATIVO' ? 'bloqueado' : 'reativado';
    showNotification(`Usuário "${targetUser.name}" foi ${newStatusLabel} com sucesso.`);
  };

  // Delete User Confirmation
  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await storageService.deleteUser(userToDelete.id, currentUser);
      if (!res.success) {
        setDeleteError(res.error || 'Erro ao excluir usuário.');
        return;
      }
      showNotification(
        `Usuário "${userToDelete.name}" foi excluído. Todo o histórico de movimentações foi preservado.`
      );
      setUserToDelete(null);
      setDeleteError('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password Reset Submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!userForPasswordReset) return;

    if (isFirebaseMode) {
      await handleSendResetEmail();
      return;
    }

    if (newPassword.length < 6) {
      setResetError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await storageService.resetUserPassword(
        userForPasswordReset.id,
        newPassword,
        currentUser
      );
      if (!res.success) {
        setResetError(res.error || 'Erro ao redefinir senha.');
        return;
      }

      showNotification(
        `A senha do usuário "${userForPasswordReset.name}" foi redefinida com segurança via criptografia.`
      );
      setIsResetPasswordOpen(false);
      setUserForPasswordReset(null);
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!userForPasswordReset) return;
    setResetError('');
    setIsSubmitting(true);
    try {
      const res = await storageService.requestPasswordReset(userForPasswordReset.email);
      if (!res.success) {
        setResetError(res.error || 'Não foi possível enviar o link de redefinição.');
        return;
      }
      showNotification(
        res.message ||
          `E-mail de redefinição enviado com sucesso para ${userForPasswordReset.email}.`
      );
      setIsResetPasswordOpen(false);
      setUserForPasswordReset(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // RBAC Reference Matrix
  const permissionsMatrix = [
    {
      feature: 'Cadastrar novos extintores',
      ADMIN: true,
      SUPERVISOR: true,
      OPERADOR: true,
      CONSULTA: false,
    },
    {
      feature: 'Editar dados cadastrais e prazos técnicos',
      ADMIN: true,
      SUPERVISOR: true,
      OPERADOR: false,
      CONSULTA: false,
    },
    {
      feature: 'Registrar movimentações (campo, estoque, recargas)',
      ADMIN: true,
      SUPERVISOR: true,
      OPERADOR: true,
      CONSULTA: false,
    },
    {
      feature: 'Interditar cilindro e laudo de condenação',
      ADMIN: true,
      SUPERVISOR: true,
      OPERADOR: false,
      CONSULTA: false,
    },
    {
      feature: 'Baixa patrimonial / Arquivamento / Exclusão de extintores',
      ADMIN: true,
      SUPERVISOR: false,
      OPERADOR: false,
      CONSULTA: false,
    },
    {
      feature: 'Gerenciar usuários, senhas e perfis de acesso',
      ADMIN: true,
      SUPERVISOR: false,
      OPERADOR: false,
      CONSULTA: false,
    },
    {
      feature: 'Exportar relatórios gerenciais e histórico',
      ADMIN: true,
      SUPERVISOR: true,
      OPERADOR: true,
      CONSULTA: true,
    },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-12">
      {/* Toast Feedback */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-600/80 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/50 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{feedbackSuccess}</span>
          </div>
          <button onClick={() => setFeedbackSuccess(null)} className="text-emerald-400 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Inline Action Error */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242938]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-red-500" />
            <span>Gerenciamento de Usuários & Controle de Acesso</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Administração de contas, perfis RBAC, bloqueio temporário e redefinição segura de senhas.
          </p>
        </div>

        <button
          onClick={handleOpenCreateUser}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 transition-all self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Cadastrar Usuário</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-[11px] font-semibold text-gray-400 block">Total de Usuários</span>
          <span className="text-2xl font-black text-white mt-1 block">{users.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-[11px] font-semibold text-gray-400 block">Administradores</span>
          <span className="text-2xl font-black text-red-400 mt-1 block">
            {users.filter((u) => u.role === 'ADMIN').length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-[11px] font-semibold text-gray-400 block">Ativos</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {users.filter((u) => u.status === 'ATIVO').length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c]">
          <span className="text-[11px] font-semibold text-gray-400 block">Bloqueados / Suspensos</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">
            {users.filter((u) => u.status === 'BLOQUEADO').length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#141720] border border-[#262c3c] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome, e-mail ou setor..."
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] py-2 pl-9 pr-3 text-xs text-white placeholder-gray-400 focus:border-red-600 focus:outline-none"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Todos os Perfis de Acesso</option>
              <option value="ADMIN">Administrador (Controle Total)</option>
              <option value="SUPERVISOR">Supervisor Operacional</option>
              <option value="OPERADOR">Operador</option>
              <option value="CONSULTA">Consulta (Somente Leitura)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] px-3 py-2 text-xs text-white focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Todas as Situações</option>
              <option value="ATIVO">Ativo</option>
              <option value="BLOQUEADO">Bloqueado / Suspenso</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
          <span>
            Exibindo <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuário(s)
          </span>
          {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-red-400 hover:text-red-300 font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Users Table / List */}
      <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
              <tr>
                <th className="px-4 py-3.5 font-bold">Usuário / Nome Completo</th>
                <th className="px-4 py-3.5 font-bold">Perfil de Acesso</th>
                <th className="px-4 py-3.5 font-bold">Situação</th>
                <th className="px-4 py-3.5 font-bold">Unidades Autorizadas</th>
                <th className="px-4 py-3.5 font-bold">Cadastro & Último Acesso</th>
                <th className="px-4 py-3.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202535]">
              {filteredUsers.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const isBlocked = user.status === 'BLOQUEADO';

                return (
                  <tr key={user.id} className="hover:bg-[#1a1e29] transition-colors">
                    {/* User & Email */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775?w=150'}
                          alt={user.name}
                          className="h-9 w-9 rounded-full object-cover ring-1 ring-[#2f374a] shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white block">{user.name}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950 text-red-300 border border-red-800">
                                Você
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono block">{user.email}</span>
                          <span className="text-[10px] text-gray-400">{user.department}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          user.role === 'ADMIN'
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : user.role === 'SUPERVISOR' || user.role === 'TST'
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : user.role === 'OPERADOR' || user.role === 'ALMOXARIFE'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-gray-800 text-gray-300 border-gray-600'
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        <span>{USER_ROLE_LABELS[user.role] || user.role}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          user.status === 'ATIVO'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                            : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.status === 'ATIVO' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span>{user.status === 'ATIVO' ? 'Ativo' : 'Bloqueado'}</span>
                      </span>
                    </td>

                    {/* Authorized Units */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="text-xs text-gray-300">
                        {user.authorizedUnitIds?.includes('ALL') ? (
                          <span className="font-semibold text-emerald-400">Todas as Unidades</span>
                        ) : (
                          <span className="truncate block" title={user.authorizedUnitIds?.join(', ')}>
                            {user.authorizedUnitIds && user.authorizedUnitIds.length > 0
                              ? `${user.authorizedUnitIds.length} unidade(s) atribuída(s)`
                              : 'Todas'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <div className="text-gray-300 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span>
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '2023'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span>
                          {user.lastLoginAt
                            ? `Último acesso: ${new Date(user.lastLoginAt).toLocaleDateString('pt-BR')}`
                            : 'Primeiro acesso pendente'}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Switch user session button (only in Local Mode for RBAC preview) */}
                        {!isFirebaseMode && (
                          <button
                            onClick={() => switchUser(user.id)}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isCurrent
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'text-gray-400 hover:text-white hover:bg-[#202534]'
                            }`}
                            title={isCurrent ? 'Sua sessão atual' : `Simular acesso com ${user.name}`}
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEditUser(user)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-[#222838] transition-colors"
                          title="Editar usuário"
                          aria-label={`Editar ${user.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => {
                            setUserForPasswordReset(user);
                            setNewPassword('');
                            setConfirmPassword('');
                            setResetError('');
                            setIsResetPasswordOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-300 hover:bg-[#222838] transition-colors"
                          title="Redefinir senha de acesso"
                          aria-label={`Redefinir senha de ${user.name}`}
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>

                        {/* Lock / Unlock */}
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isCurrent
                              ? 'opacity-30 cursor-not-allowed text-gray-600'
                              : isBlocked
                              ? 'text-emerald-400 hover:bg-emerald-950/60'
                              : 'text-amber-400 hover:bg-amber-950/60'
                          }`}
                          title={
                            isCurrent
                              ? 'Você não pode bloquear sua própria conta'
                              : isBlocked
                              ? 'Reativar acesso do usuário'
                              : 'Bloquear / Suspender temporariamente'
                          }
                          aria-label={`Alterar status de ${user.name}`}
                        >
                          {isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            setUserToDelete(user);
                            setDeleteError('');
                          }}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isCurrent
                              ? 'opacity-30 cursor-not-allowed text-gray-600'
                              : 'text-gray-400 hover:text-rose-400 hover:bg-[#222838]'
                          }`}
                          title={isCurrent ? 'Você não pode excluir sua própria conta' : 'Excluir usuário'}
                          aria-label={`Excluir usuário ${user.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix Reference Table */}
      <div className="rounded-2xl bg-[#141720] border border-[#262c3c] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#222838] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Matriz Oficial de Permissões por Perfil (RBAC)</h3>
          </div>
          <span className="text-xs text-gray-400">Conformidade e Auditoria SESMT</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0f1118] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242938]">
              <tr>
                <th className="px-4 py-3 font-bold">Funcionalidade / Operação</th>
                <th className="px-4 py-3 font-bold text-center">Administrador</th>
                <th className="px-4 py-3 font-bold text-center">Supervisor</th>
                <th className="px-4 py-3 font-bold text-center">Operador</th>
                <th className="px-4 py-3 font-bold text-center">Consulta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202535]">
              {permissionsMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#1a1e29] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.feature}</td>
                  {(['ADMIN', 'SUPERVISOR', 'OPERADOR', 'CONSULTA'] as const).map((col) => {
                    const allowed = item[col];
                    return (
                      <td key={col} className="px-4 py-3 text-center">
                        {allowed ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-950/60 text-rose-500/80 border border-rose-900/40">
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {isUserFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#13161f] border border-[#272e3f] shadow-2xl text-gray-100 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222838] bg-[#0d0f15]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-950 text-red-400 border border-red-800">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {userToEdit ? 'Editar Dados do Usuário' : 'Cadastrar Novo Usuário'}
                  </h3>
                  <span className="text-xs text-gray-400">
                    Definição de perfil, unidades autorizadas e credenciais de acesso
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsUserFormOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f2533]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nome completo */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Engenheiro Carlos Silva"
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  E-mail Corporativo *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  disabled={!!userToEdit} // Email is immutable identity
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="carlos.silva@empresa.com.br"
                  className={`w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none ${
                    userToEdit ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  required
                />
                {userToEdit && (
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    O e-mail é a chave de identidade do usuário e não pode ser alterado após o cadastro.
                  </span>
                )}
              </div>

              {/* Senha Inicial (Only when creating in Local Mode; Firebase uses invite + Primeiro Acesso) */}
              {!userToEdit && !isFirebaseMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Senha Inicial de Acesso *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres (ex: Seguranca#2026)"
                      className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 pr-9 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                    >
                      {showPasswordText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    A senha será criptografada com hash SHA-256 e nunca será armazenada em texto puro.
                  </span>
                </div>
              )}

              {!userToEdit && isFirebaseMode && (
                <div className="p-3 rounded-xl bg-sky-950/35 border border-sky-800/70 text-sky-200 text-xs space-y-1">
                  <p className="font-bold text-sky-300 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Ativação Segura via Firebase Authentication</span>
                  </p>
                  <p className="text-[11px] text-sky-200/80 leading-relaxed">
                    Sem credenciais administrativas no frontend: ao cadastrar, o e-mail é pré-autorizado no Cloud Firestore. O colaborador definirá a própria senha na aba <strong>Primeiro Acesso</strong> da tela de login (ou entrará com Google).
                  </p>
                </div>
              )}

              {/* Perfil de Acesso & Situação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Perfil de Acesso *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white focus:border-red-600 focus:outline-none"
                  >
                    <option value="ADMIN">Administrador (Controle Total)</option>
                    <option value="SUPERVISOR">Supervisor Operacional</option>
                    <option value="OPERADOR">Operador</option>
                    <option value="CONSULTA">Consulta (Somente Leitura)</option>
                  </select>
                </div>

                {userToEdit && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Situação da Conta *
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                      className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white focus:border-red-600 focus:outline-none"
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="BLOQUEADO">Bloqueado / Suspenso</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Departamento */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Departamento / Setor
                </label>
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="Ex: Gerência de EHS, Almoxarifado Central, Brigada..."
                  className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white placeholder-gray-500 focus:border-red-600 focus:outline-none"
                />
              </div>

              {/* Unidades Autorizadas */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Unidades Autorizadas
                </label>
                <div className="space-y-1.5 p-3 rounded-xl bg-[#1b1f2b] border border-[#2d3648] max-h-36 overflow-y-auto">
                  <label className="flex items-center gap-2 text-xs text-white cursor-pointer pb-1 border-b border-[#252c3c]">
                    <input
                      type="checkbox"
                      checked={formUnits.includes('ALL')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormUnits(['ALL']);
                        } else {
                          setFormUnits([]);
                        }
                      }}
                      className="accent-red-600"
                    />
                    <span className="font-bold text-emerald-400">Todas as Unidades (Acesso Global)</span>
                  </label>

                  {units.map((unit) => (
                    <label key={unit.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formUnits.includes('ALL') || formUnits.includes(unit.id)}
                        disabled={formUnits.includes('ALL')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormUnits([...formUnits.filter((u) => u !== 'ALL'), unit.id]);
                          } else {
                            setFormUnits(formUnits.filter((u) => u !== unit.id));
                          }
                        }}
                        className="accent-red-600"
                      />
                      <span>{unit.name} ({unit.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#242b3b]">
                <button
                  type="button"
                  onClick={() => setIsUserFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1f2533]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-950/70 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Salvando...'
                    : userToEdit
                    ? 'Salvar Alterações'
                    : isFirebaseMode
                    ? 'Pré-autorizar Usuário'
                    : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordOpen && userForPasswordReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#141720] border border-sky-800/80 p-6 shadow-2xl text-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-sky-400 mb-4 pb-3 border-b border-[#242b3b]">
              <div className="p-2 rounded-xl bg-sky-950/90 border border-sky-800">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Redefinir Senha de Acesso</h3>
                <span className="text-xs text-gray-400 font-mono">{userForPasswordReset.email}</span>
              </div>
            </div>

            {resetError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{resetError}</span>
              </div>
            )}

            {isFirebaseMode ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                  No modo conectado ao Firebase Authentication, senhas de terceiros nunca são definidas ou exibidas no navegador. Dispare o link oficial de redefinição diretamente para o e-mail de <strong className="text-white">{userForPasswordReset.name}</strong>.
                </p>

                <div className="pt-3 border-t border-[#242b3b] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1f2533]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSendResetEmail}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/70 disabled:opacity-50"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>
                      {isSubmitting
                        ? 'Enviando...'
                        : 'Enviar E-mail Oficial de Redefinição (Firebase Auth)'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-300 mb-3">
                  Defina uma nova senha local para <strong>{userForPasswordReset.name}</strong>. A senha nunca é visível em texto puro e é armazenada com hash criptográfico SHA-256.
                </p>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Nova Senha *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Confirmar Nova Senha *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full rounded-xl bg-[#1b1f2b] border border-[#2d3648] p-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Enviar link por e-mail (requer Firebase)</span>
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#242b3b] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsResetPasswordOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1f2533]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/70 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Salvando...' : 'Gravar Nova Senha'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#141720] border border-rose-800/80 p-6 shadow-2xl text-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-500 mb-3 pb-2 border-b border-[#242b3b]">
              <div className="p-2 rounded-xl bg-rose-950/90 border border-rose-800">
                <AlertTriangle className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Exclusão de Conta de Usuário</h3>
                <span className="text-xs text-gray-400">Confirmação de segurança</span>
              </div>
            </div>

            <p className="text-xs text-gray-300 mt-2">
              Você está prestes a remover o usuário <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email}) do sistema.
            </p>

            <div className="mt-3 p-3 rounded-xl bg-[#1b1f2b] border border-[#2d3648] text-[11px] text-gray-400 space-y-1">
              <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Preservação de Histórico Ativa:</span>
              </p>
              <p>
                Todas as movimentações e registros assinados por este usuário permanecerão <strong>integralmente preservados</strong> no histórico auditável do sistema.
              </p>
            </div>

            {deleteError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-[#242b3b]">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1f2533]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteUserConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/70 disabled:opacity-50"
              >
                {isSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
