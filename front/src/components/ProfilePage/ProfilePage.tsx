import React, { useRef, useState, useEffect } from 'react';
import Header, { HeaderProps } from '../Header/Header';
import Sidebar, { SidebarProject, DEFAULT_PROJECTS } from '../Sidebar/Sidebar';
import { MyTask } from '../MyTasksPage/MyTasksPage';
import { getCurrentUser, updateProfile, uploadProfilePhoto, getUserTasks, getUserStats, UserTask, UserStats, changePassword } from '../../services/api';

// Helper para construir la URL completa de la imagen
const buildImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  // En desarrollo, usar localhost:3001, en producción usar la URL del backend
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  return `${API_URL}${imagePath}`;
};

type ProfilePageProps = {
  user?: {
    initials?: string;
    name: string;
    email: string;
  };
  onBack?: () => void;
  onChangePassword?: () => void;
  onLogoutRequest?: () => void;
  onSelect?: (projectId: string) => void;
  selectedId?: string | null;
  onOpenBoardTask?: (options: { taskId: string; columnId?: string; projectId: string }) => void;
  projects?: SidebarProject[];
  headerNotifications?: HeaderProps['notifications'];
};

// Ya no usamos datos por defecto, siempre cargamos del servidor

const TABS = [
  { id: 'profile', label: 'Mi perfil' },
  { id: 'jobs', label: 'Mis trabajos' },
  { id: 'stats', label: 'Mis estadísticas' },
];

const ProfilePage: React.FC<ProfilePageProps> = ({
  user: userProp,
  onBack,
  onChangePassword,
  onLogoutRequest,
  onSelect,
  selectedId = 'my-tasks',
  onOpenBoardTask,
  projects: projectsProp,
  headerNotifications,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'jobs' | 'stats'>('profile');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [jobsPriorityFilter, setJobsPriorityFilter] = useState<'all' | MyTask['priority']>('all');
  const [jobsProjectFilter, setJobsProjectFilter] = useState<'all' | string>('all');
  const [jobsStatusFilter, setJobsStatusFilter] = useState<'all' | MyTask['status']>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados para datos del usuario
  const [user, setUser] = useState<{ initials?: string; name: string; email: string; fotoPerfil?: string | null }>({
    name: '',
    email: '',
    initials: '',
    fotoPerfil: null,
  });
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  
  // Verificar el estado del usuario después de que se actualice
  useEffect(() => {
    if (!isLoadingUser && user.name) {
      // El usuario se ha cargado correctamente
    }
  }, [user.name, isLoadingUser]);
  
  // Estados para edición de perfil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  // Estados para tareas y estadísticas
  const [tasksAssigned, setTasksAssigned] = useState<MyTask[]>([]);
  const [taskStats, setTaskStats] = useState<UserStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    inReview: 0,
    progressPercent: 0,
    byProject: {},
  });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const projects = React.useMemo(() => projectsProp ?? DEFAULT_PROJECTS, [projectsProp]);

  const loadTasks = React.useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const userTasks = await getUserTasks();
      // Función para formatear la fecha límite (similar a MyTasksPage)
      const formatDueDate = (dateString: string | null): string => {
        if (!dateString || dateString === 'Sin fecha') {
          return 'Sin fecha';
        }

        try {
          const date = new Date(dateString);
          if (Number.isNaN(date.getTime())) {
            return dateString;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const taskDate = new Date(date);
          taskDate.setHours(0, 0, 0, 0);

          const diffTime = taskDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
            return 'Hoy';
          } else if (diffDays === 1) {
            return 'Mañana';
          } else if (diffDays === -1) {
            return 'Ayer';
          } else if (diffDays > 0 && diffDays <= 7) {
            return `En ${diffDays} días`;
          } else {
            return new Intl.DateTimeFormat('es-ES', {
              day: '2-digit',
              month: 'short',
            }).format(date);
          }
        } catch {
          return dateString;
        }
      };

      // Convertir UserTask[] a MyTask[]
      const convertedTasks: MyTask[] = userTasks.map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectName: task.projectName,
        status: task.status as MyTask['status'],
        priority: task.priority,
        dueDate: formatDueDate(task.dueDate),
        dueDateRaw: task.dueDate || undefined, // Guardar fecha original para ordenamiento (undefined si es null)
        boardTaskRef: task.boardTaskRef && task.boardTaskRef.columnId
          ? {
              taskId: task.boardTaskRef.taskId,
              columnId: task.boardTaskRef.columnId,
            }
          : undefined,
      }));
      setTasksAssigned(convertedTasks);
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const loadStats = React.useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const stats = await getUserStats();
      setTaskStats(stats);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    let isMounted = true;
    
    const loadUserData = async () => {
      setIsLoadingUser(true);
      setUserError(null);
      try {
        const userData = await getCurrentUser();
        // Asegurarse de obtener el nombre correctamente
        const userName = userData.name || userData.nombreCompleto || '';
        
        if (isMounted) {
          // Actualizar el estado del usuario primero
          setUser({
            initials: userData.initials || 'U',
            name: userName,
            email: userData.email || '',
            fotoPerfil: userData.fotoPerfil || null,
          });
          // Luego actualizar los campos de edición
          setEditedName(userName);
          setEditedEmail(userData.email || '');
          // Finalmente, marcar como cargado
          setIsLoadingUser(false);
        }
      } catch (error: any) {
        if (isMounted) {
          setUserError(error.message || 'Error al cargar los datos del usuario');
          // Si falla la carga y hay userProp, usar esos datos
          if (userProp && userProp.name) {
            setUser({
              initials: userProp.initials,
              name: userProp.name,
              email: userProp.email,
              fotoPerfil: null,
            });
            setEditedName(userProp.name);
            setEditedEmail(userProp.email);
          }
        }
      } finally {
        // Asegurar que isLoadingUser se establezca en false si aún está en true
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    };

    // Cargar datos del servidor siempre al montar
    loadUserData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Cargar tareas cuando se cambia a la pestaña de trabajos
  useEffect(() => {
    if (activeTab === 'jobs' && tasksAssigned.length === 0) {
      loadTasks();
    }
  }, [activeTab, tasksAssigned.length, loadTasks]);

  // Cargar estadísticas cuando se cambia a la pestaña de estadísticas
  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, loadStats]);

  const handleSaveProfile = async () => {
    if (!editedName.trim() && !editedEmail.trim()) {
      setUserError('Debe proporcionar al menos un campo para actualizar');
      return;
    }

    setIsSavingUser(true);
    setUserError(null);
    try {
      const updateData: { nombreCompleto?: string; email?: string } = {};
      if (editedName.trim() && editedName !== user.name) {
        updateData.nombreCompleto = editedName.trim();
      }
      if (editedEmail.trim() && editedEmail !== user.email) {
        updateData.email = editedEmail.trim();
      }

      if (Object.keys(updateData).length === 0) {
        setIsEditingProfile(false);
        return;
      }

      const updatedUser = await updateProfile(updateData);
      const updatedUserName = updatedUser.name || updatedUser.nombreCompleto || '';
      setUser({
        initials: updatedUser.initials,
        name: updatedUserName,
        email: updatedUser.email,
        fotoPerfil: updatedUser.fotoPerfil || null,
      });
      setEditedName(updatedUserName);
      setEditedEmail(updatedUser.email);
      setIsEditingProfile(false);
      
      // Disparar evento personalizado para notificar a otros componentes (como Header)
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: any) {
      console.error('Error actualizando perfil:', error);
      setUserError(error.message || 'Error al actualizar el perfil');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleCancelEditProfile = () => {
    setEditedName(user.name);
    setEditedEmail(user.email);
    setIsEditingProfile(false);
    setUserError(null);
  };
  const jobProjectOptions = React.useMemo(() => {
    const set = new Set<string>();
    tasksAssigned.forEach((task) => set.add(task.projectName));
    return Array.from(set);
  }, [tasksAssigned]);
  const filteredJobs = React.useMemo(() => {
    return tasksAssigned.filter((task) => {
      const matchesPriority = jobsPriorityFilter === 'all' || task.priority === jobsPriorityFilter;
      const matchesProject = jobsProjectFilter === 'all' || task.projectName === jobsProjectFilter;
      const matchesStatus = jobsStatusFilter === 'all' || task.status === jobsStatusFilter;
      return matchesPriority && matchesProject && matchesStatus;
    });
  }, [jobsPriorityFilter, jobsProjectFilter, jobsStatusFilter, tasksAssigned]);
  const isFilteringJobs = jobsPriorityFilter !== 'all' || jobsProjectFilter !== 'all' || jobsStatusFilter !== 'all';
  const activeTabIndex = React.useMemo(
    () => Math.max(0, TABS.findIndex((tab) => tab.id === activeTab)),
    [activeTab]
  );
  const sliderStyle = React.useMemo(() => {
    const width = 100 / TABS.length;
    return {
      width: `${width}%`,
      left: `${activeTabIndex * width}%`,
    } as React.CSSProperties;
  }, [activeTabIndex]);

  const isPasswordMismatch = newPassword !== '' && confirmPassword !== '' && newPassword !== confirmPassword;
  const isPasswordFormInvalid =
    currentPassword.trim().length === 0 || newPassword.trim().length < 8 || confirmPassword.trim().length < 8 || isPasswordMismatch;

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPasswordFormInvalid) {
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingPassword(false);
      
      // Ocultar el mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (error: any) {
      // Extraer mensaje de error más específico
      let errorMessage = 'Error al cambiar la contraseña. Por favor, intenta de nuevo.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Si hay detalles de validación, construir mensaje más específico
      if (error?.details && Array.isArray(error.details) && error.details.length > 0) {
        const validationMessages = error.details.map((detail: any) => {
          const fieldName = detail.field === 'currentPassword' ? 'Contraseña actual' :
                           detail.field === 'newPassword' ? 'Nueva contraseña' :
                           detail.field === 'confirmPassword' ? 'Confirmar contraseña' :
                           detail.field;
          return `${fieldName}: ${detail.message}`;
        });
        errorMessage = validationMessages.join('. ');
      }
      
      setPasswordError(errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validar tamaño (2MB máximo)
    if (file.size > 2 * 1024 * 1024) {
      setUserError('El archivo es demasiado grande. Máximo 2 MB');
      return;
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setUserError('Tipo de archivo no permitido. Solo se admiten JPG y PNG');
      return;
    }

    setIsSavingUser(true);
    setUserError(null);
    try {
      const updatedUser = await uploadProfilePhoto(file);
      
      setUser({
        initials: updatedUser.initials,
        name: updatedUser.name || updatedUser.nombreCompleto || '',
        email: updatedUser.email,
        fotoPerfil: updatedUser.fotoPerfil || null,
      });
      
      // Disparar evento personalizado para notificar a otros componentes (como Header)
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: any) {
      console.error('Error subiendo foto:', error);
      setUserError(error.message || 'Error al subir la foto de perfil');
    } finally {
      setIsSavingUser(false);
      // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTaskCardClick = (task: MyTask) => {
    if (task.boardTaskRef) {
      onOpenBoardTask?.({
        taskId: task.boardTaskRef.taskId,
        columnId: task.boardTaskRef.columnId,
        projectId: task.projectId,
      });
      return;
    }

    onSelect?.(task.projectId);
  };

  const getStatusClasses = (status: MyTask['status']) => {
    switch (status) {
      case 'Pendiente':
        return 'bg-amber-100 text-amber-700';
      case 'En progreso':
        return 'bg-blue-100 text-blue-700';
      case 'En revisión':
        return 'bg-purple-100 text-purple-700';
      case 'Completado':
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  };

  const handleResetJobFilters = () => {
    setJobsPriorityFilter('all');
    setJobsProjectFilter('all');
    setJobsStatusFilter('all');
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        projects={projects}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoutRequest={() => setShowLogoutConfirm(true)}
        selectedId={selectedId}
        onSelect={(projectId) => {
          onSelect?.(projectId);
        }}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header title="Perfil de usuario" onBack={onBack} notifications={headerNotifications} />

        <main className="flex flex-1 flex-col px-6 py-10">
          <div className="flex justify-center">
            <div className="relative flex w-full max-w-xl overflow-hidden rounded-full bg-white p-1 text-sm font-medium text-slate-500 shadow-md shadow-slate-200/70">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative z-10 flex-1 px-6 py-2 text-center transition-colors focus:outline-none ${
                      isActive ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <span
                className="pointer-events-none absolute inset-y-1 flex items-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg transition-[left] duration-300 ease-out"
                style={sliderStyle}
              >
                <span className="mx-auto h-8 w-full rounded-full bg-white/10" />
              </span>
            </div>
          </div>

          <div className="mt-10 flex-1">
            <div className="mx-auto w-full max-w-4xl">
              {activeTab === 'profile' ? (
                <section className="space-y-8 rounded-3xl bg-white p-8 shadow-sm">
                  <div className="space-y-6">
                    <header className="flex items-center gap-3 text-slate-500">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50">
                        <img src="/img/user-icon.svg" alt="Usuario" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                          Información personal
                        </p>
                      </div>
                    </header>

                    <div className="flex flex-col gap-8">
                      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-start sm:text-left">
                        {user.fotoPerfil ? (
                          <img 
                            src={buildImageUrl(user.fotoPerfil) || ''} 
                            alt="Foto de perfil" 
                            className="h-24 w-24 rounded-full object-cover shadow-lg"
                          />
                        ) : (
                          <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-2xl font-semibold text-white shadow-lg">
                            {user.initials || 'U'}
                          </span>
                        )}
                        <div className="flex flex-col items-center gap-2 text-xs text-slate-400 sm:items-start">
                          <div className="flex flex-col gap-1">
                            <p className="text-base font-semibold text-slate-900">
                              {isLoadingUser ? 'Cargando...' : (user.name ? user.name : 'Usuario')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handlePhotoButtonClick}
                            disabled={isSavingUser}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSavingUser ? 'Subiendo...' : 'Cambiar foto'}
                          </button>
                          <span>JPG o PNG, máximo 2 MB</span>
                          <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept="image/jpeg,image/jpg,image/png" 
                            onChange={handlePhotoChange}
                            className="hidden" 
                          />
                        </div>
                      </div>

                      {isLoadingUser ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                        </div>
                      ) : (
                        <>
                          {userError && (
                            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
                              {userError}
                            </div>
                          )}
                          <div className="grid gap-6 text-sm text-slate-600 sm:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Nombre completo
                              </span>
                              <input
                                type="text"
                                value={isEditingProfile ? editedName : user.name}
                                onChange={(e) => setEditedName(e.target.value)}
                                readOnly={!isEditingProfile}
                                className={`h-12 rounded-2xl border border-slate-200 px-4 text-slate-900 ${
                                  isEditingProfile
                                    ? 'bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10'
                                    : 'bg-slate-50'
                                }`}
                              />
                            </label>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Email
                              </span>
                              <input
                                type="email"
                                value={isEditingProfile ? editedEmail : user.email}
                                onChange={(e) => setEditedEmail(e.target.value)}
                                readOnly={!isEditingProfile}
                                className={`h-12 rounded-2xl border border-slate-200 px-4 text-slate-900 ${
                                  isEditingProfile
                                    ? 'bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10'
                                    : 'bg-slate-50'
                                }`}
                              />
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            {isEditingProfile ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSaveProfile}
                                  disabled={isSavingUser}
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSavingUser ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditProfile}
                                  disabled={isSavingUser}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsEditingProfile(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
                              >
                                Editar perfil
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <header className="flex items-center gap-3 text-slate-500">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50">
                        <img src="/img/lock-icon.svg" alt="Contraseña" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">Contraseña</p>
                      </div>
                    </header>

                    {isEditingPassword ? (
                      <form
                        className="mt-6 grid gap-6 text-sm text-slate-600 lg:grid-cols-3"
                        onSubmit={handlePasswordSubmit}
                      >
                        <label className="flex flex-col gap-2 lg:col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Contraseña actual
                          </span>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={currentPassword}
                            onChange={(event) => {
                              setCurrentPassword(event.target.value);
                              setPasswordError(null);
                              setPasswordSuccess(false);
                            }}
                            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                            required
                          />
                        </label>

                        <label className="flex flex-col gap-2 lg:col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Nueva contraseña
                          </span>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(event) => {
                              setNewPassword(event.target.value);
                              setPasswordError(null);
                              setPasswordSuccess(false);
                            }}
                            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                            required
                            minLength={8}
                          />
                        </label>

                        <label className="flex flex-col gap-2 lg:col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Repite contraseña
                          </span>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(event) => {
                              setConfirmPassword(event.target.value);
                              setPasswordError(null);
                              setPasswordSuccess(false);
                            }}
                            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                            required
                            minLength={8}
                          />
                        </label>

                        {isPasswordMismatch && (
                          <p className="lg:col-span-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
                            Las contraseñas no coinciden. Intenta nuevamente.
                          </p>
                        )}

                        {passwordError && (
                          <p className="lg:col-span-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
                            {passwordError}
                          </p>
                        )}

                        {passwordSuccess && (
                          <p className="lg:col-span-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-xs font-semibold text-green-600">
                            Contraseña cambiada exitosamente.
                          </p>
                        )}

                        <div className="lg:col-span-3 flex items-center gap-3">
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isPasswordFormInvalid || isChangingPassword}
                          >
                            {isChangingPassword ? 'Cambiando...' : 'Confirmar cambios'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingPassword(false);
                              setCurrentPassword('');
                              setNewPassword('');
                              setConfirmPassword('');
                              setPasswordError(null);
                              setPasswordSuccess(false);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isChangingPassword}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => setIsEditingPassword(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
                        >
                          Editar contraseña
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              ) : activeTab === 'jobs' ? (
                <section className="space-y-6 rounded-3xl bg-white p-8 text-sm text-slate-600 shadow-sm">
                  <header className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-slate-900">Mis trabajos</h2>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Accede a las tareas que tienes asignadas y revisa su progreso.
                    </p>
                  </header>

                  {isLoadingTasks && (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <span className="mb-1">Prioridad</span>
                      <select
                        value={jobsPriorityFilter}
                        onChange={(event) => setJobsPriorityFilter(event.target.value as typeof jobsPriorityFilter)}
                        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition focus:border-blue-300 focus:outline-none"
                      >
                        <option value="all">Todas</option>
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>

                    <div className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <span className="mb-1">Proyecto</span>
                      <select
                        value={jobsProjectFilter}
                        onChange={(event) => setJobsProjectFilter(event.target.value as typeof jobsProjectFilter)}
                        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition focus:border-blue-300 focus:outline-none"
                      >
                        <option value="all">Todos</option>
                        {jobProjectOptions.map((projectName) => (
                          <option key={projectName} value={projectName}>
                            {projectName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <span className="mb-1">Estado</span>
                      <select
                        value={jobsStatusFilter}
                        onChange={(event) => setJobsStatusFilter(event.target.value as typeof jobsStatusFilter)}
                        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition focus:border-blue-300 focus:outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En progreso">En progreso</option>
                        <option value="En revisión">En revisión</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>

                    {isFilteringJobs && (
                      <button
                        type="button"
                        onClick={handleResetJobFilters}
                        className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredJobs.map((task) => (
                      <article
                        key={task.id}
                        onClick={() => handleTaskCardClick(task)}
                        className="group flex h-full min-h-[180px] w-full cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg"
                      >
                        <div className="flex flex-col gap-2 text-xs text-slate-500">
                          <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                          <span className="font-medium text-slate-600">{task.projectName}</span>
                          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 font-semibold uppercase tracking-wide ${getStatusClasses(task.status)}`}>
                            {task.status}
                          </span>
                        </div>

                        <div className="mt-auto text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Fecha límite:</span> {task.dueDate}
                        </div>
                      </article>
                    ))}
                    {filteredJobs.length === 0 && (
                      <div className="col-span-full flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Sin tareas que coincidan con los filtros.
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <section className="space-y-8 rounded-3xl bg-white p-8 text-sm text-slate-600 shadow-sm">
                  <header className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-slate-900">Mis estadísticas</h2>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Seguimiento de productividad, estados y tiempos de entrega.
                    </p>
                  </header>

                  {isLoadingStats && (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-5 text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">Tareas totales</span>
                      <span className="text-3xl font-semibold text-slate-900">{taskStats.total}</span>
                      <span className="text-xs">Asignadas a tu usuario</span>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-5 text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Progreso actual</span>
                      <span className="text-3xl font-semibold text-slate-900">{taskStats.progressPercent}%</span>
                      <span className="text-xs">Porcentaje de tareas completadas</span>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-5 text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">Pendientes</span>
                      <span className="text-3xl font-semibold text-slate-900">{taskStats.pending}</span>
                      <span className="text-xs">A la espera de inicio o feedback</span>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-5 text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wide text-purple-500">En revisión</span>
                      <span className="text-3xl font-semibold text-slate-900">{taskStats.inReview}</span>
                      <span className="text-xs">Tareas esperando validación final</span>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5">
                      <header className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Distribución por estado</h3>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Últimas 4 semanas</span>
                      </header>
                      <ul className="space-y-3 text-xs text-slate-500">
                        <li className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-400" />
                            En progreso
                          </span>
                          <span className="font-semibold text-slate-700">{taskStats.inProgress} tareas</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Completadas
                          </span>
                          <span className="font-semibold text-slate-700">{taskStats.completed} tareas</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Pendientes
                          </span>
                          <span className="font-semibold text-slate-700">{taskStats.pending} tareas</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-purple-400" />
                            En revisión
                          </span>
                          <span className="font-semibold text-slate-700">{taskStats.inReview} tareas</span>
                        </li>
                      </ul>
                    </section>

                    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5">
                      <header className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Tareas por proyecto</h3>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Total {taskStats.total}
                        </span>
                      </header>
                      <ul className="space-y-3 text-xs text-slate-500">
                        {Object.entries(taskStats.byProject).map(([projectName, count]) => (
                          <li key={projectName} className="flex items-center justify-between">
                            <span className="font-medium text-slate-600">{projectName}</span>
                            <span className="font-semibold text-slate-700">{count} tareas</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">¿Cerrar sesión?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tu sesión se cerrará y deberás volver a iniciar sesión para acceder al tablero.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogoutRequest?.();
                }}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

