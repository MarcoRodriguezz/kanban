import React, { useEffect, useState } from 'react';
import { getCurrentUser, markAllNotificationsAsRead, getUsuarios, createUsuario, deleteUsuario, Usuario, CreateUsuarioData } from '../../services/api';

// Helper para construir la URL completa de la imagen
const buildImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  // En desarrollo, usar localhost:3001, en producción usar la URL del backend
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  return `${API_URL}${imagePath}`;
};

export type HeaderNotification = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'commit' | 'task-assigned' | 'task-updated' | 'project-added' | 'issue-reported';
  onClick?: () => void;
  read?: boolean;
};

export type HeaderProps = {
  title?: string;
  onProfileClick?: () => void;
  onBack?: () => void;
  notifications?: HeaderNotification[];
  onNotificationsUpdated?: () => void;
};

const Header: React.FC<HeaderProps> = ({
  title = 'Kanban Planner',
  onProfileClick,
  onBack,
  notifications = [],
  onNotificationsUpdated,
}) => {
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserManagement, setShowUserManagement] = React.useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsuario, setNewUsuario] = useState<CreateUsuarioData>({
    nombreCompleto: '',
    email: '',
    rol: 'Empleado',
    contraseña: '',
  });
  const [creatingUsuario, setCreatingUsuario] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('Usuario');
  const [userInitials, setUserInitials] = useState<string>('U');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<boolean>(false);
  
  // Estados para popups personalizados
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingUsuario, setDeletingUsuario] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Filtrar solo notificaciones no leídas para el contador y el popup
  const unreadNotifications = notifications.filter(n => !n.read);
  const hasNotifications = unreadNotifications.length > 0;

  // Función para marcar todas las notificaciones como leídas
  const handleMarkAllAsRead = async () => {
    if (unreadNotifications.length === 0) return;
    
    try {
      await markAllNotificationsAsRead();
      // Notificar al componente padre para que recargue las notificaciones
      onNotificationsUpdated?.();
      // También disparar un evento personalizado para que App.tsx pueda escucharlo
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error);
    }
  };

  // Función para cargar datos del usuario
  const loadUser = React.useCallback(async () => {
    try {
      const userData = await getCurrentUser();
      const name = userData.name || userData.nombreCompleto || 'Usuario';
      setUserName(name);
      setUserInitials(userData.initials || 'U');
      setUserPhoto(userData.fotoPerfil || null);
      setPhotoError(false); // Resetear el error cuando se carga un nuevo usuario
      // Normalizar el rol para comparación (trim y verificar que sea Administrador)
      const rol = (userData.role || userData.rol || '').trim();
      setCurrentUserRole(rol);
    } catch (error) {
      // Si falla, mantener los valores por defecto
      console.error('Error cargando usuario en Header:', error);
    }
  }, []);

  // Función para cargar usuarios
  const loadUsuarios = React.useCallback(async () => {
    setLoadingUsuarios(true);
    try {
      const response = await getUsuarios();
      setUsuarios(response.usuarios || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
    }
  }, []);

  // Cargar usuarios cuando se abre el panel
  useEffect(() => {
    if (showUserManagement) {
      loadUsuarios();
    }
  }, [showUserManagement, loadUsuarios]);

  // Función para crear usuario
  const handleCreateUsuario = async () => {
    if (!newUsuario.nombreCompleto.trim() || !newUsuario.email.trim()) {
      showMessagePopup('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    setCreatingUsuario(true);
    try {
      // Preparar datos para enviar: si la contraseña está vacía, no incluirla en el request
      const usuarioData: CreateUsuarioData = {
        nombreCompleto: newUsuario.nombreCompleto.trim(),
        email: newUsuario.email.trim(),
        rol: newUsuario.rol,
      };
      
      // Solo incluir contraseña si tiene valor
      if (newUsuario.contraseña && newUsuario.contraseña.trim().length > 0) {
        usuarioData.contraseña = newUsuario.contraseña.trim();
      }
      
      const response = await createUsuario(usuarioData);
      const message = `Usuario creado exitosamente${response.contraseñaTemporal ? `. Contraseña temporal: ${response.contraseñaTemporal}` : ''}`;
      showMessagePopup(message, 'success');
      setNewUsuario({
        nombreCompleto: '',
        email: '',
        rol: 'Empleado',
        contraseña: '',
      });
      setShowCreateForm(false);
      loadUsuarios();
    } catch (error: any) {
      showMessagePopup(error.message || 'Error al crear usuario', 'error');
    } finally {
      setCreatingUsuario(false);
    }
  };

  // Función para abrir popup de confirmación de eliminación
  const handleDeleteClick = (usuarioId: string, usuarioName: string) => {
    setUsuarioToDelete({ id: usuarioId, name: usuarioName });
    setShowDeleteConfirm(true);
  };

  // Función para confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!usuarioToDelete) return;

    setDeletingUsuario(true);
    try {
      await deleteUsuario(usuarioToDelete.id);
      setShowDeleteConfirm(false);
      setUsuarioToDelete(null);
      showMessagePopup('Usuario eliminado exitosamente', 'success');
      loadUsuarios();
    } catch (error: any) {
      showMessagePopup(error.message || 'Error al eliminar usuario', 'error');
    } finally {
      setDeletingUsuario(false);
    }
  };

  // Función para mostrar mensaje popup
  const showMessagePopup = (text: string, type: 'success' | 'error') => {
    setMessageText(text);
    setMessageType(type);
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 3000);
  };

  // Cargar datos del usuario al montar
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Escuchar eventos de actualización de perfil
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUser();
    };

    // Escuchar evento personalizado cuando se actualiza el perfil
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [loadUser]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-12 w-12 items-center justify-center text-black transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Volver"
          >
            <img src="/img/arrow_back-icon.svg" alt="Volver" className="h-6 w-6" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserManagement(false);
            }}
            className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Abrir notificaciones"
          >
            <img
              src={showNotifications ? '/img/notification-icon-active.svg' : '/img/notification-icon.svg'}
              alt="Notificaciones"
              className="h-5 w-5 transition group-hover:scale-105"
            />
            {hasNotifications && (
              <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-semibold text-white">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 z-30 mt-3 flex w-80 max-h-96 flex-col rounded-3xl border border-slate-200 bg-white text-left text-sm text-slate-600 shadow-xl shadow-slate-900/10">
              <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Notificaciones</h2>
                <div className="flex items-center gap-2">
                  {unreadNotifications.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                      onClick={handleMarkAllAsRead}
                      title="Marcar todas como leídas"
                    >
                      Marcar todas
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                    onClick={() => setShowNotifications(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </header>

              <div className="overflow-y-auto px-4 py-4">
                {unreadNotifications.length > 0 ? (
                  <ul className="space-y-3">
                    {unreadNotifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`rounded-2xl border px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50 ${
                          notification.read 
                            ? 'border-slate-200 bg-white' 
                            : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            notification.onClick?.();
                            setShowNotifications(false);
                          }}
                          className="flex w-full flex-col items-start gap-2 text-left"
                        >
                          <div className="flex w-full items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                            <span>
                              {notification.type === 'commit'
                                ? 'Nuevo commit'
                                : notification.type === 'task-assigned'
                                ? 'Tarea asignada'
                                : notification.type === 'project-added'
                                ? 'Añadido a proyecto'
                                : notification.type === 'issue-reported'
                                ? 'Nuevo issue'
                                : 'Actualización de tarea'}
                            </span>
                            <span>{notification.timestamp}</span>
                          </div>
                          <p className={`text-sm font-semibold ${notification.read ? 'text-slate-600' : 'text-slate-800'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500">{notification.description}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                    Sin notificaciones por ahora.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botón de gestión de usuarios - Solo visible para administradores */}
        {currentUserRole === 'Administrador' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowUserManagement((prev) => !prev);
                setShowNotifications(false);
              }}
              className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Gestionar usuarios"
            >
              <img
                src={showUserManagement ? '/img/user-icon.svg' : '/img/user-icon.svg'}
                alt="Usuarios"
                className="h-5 w-5 transition group-hover:scale-105"
              />
            </button>

            {showUserManagement && (
              <div className="absolute right-0 z-30 mt-3 flex w-96 max-h-[600px] flex-col rounded-3xl border border-slate-200 bg-white text-left text-sm text-slate-600 shadow-xl shadow-slate-900/10">
                <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Gestión de Usuarios</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                      onClick={() => {
                        setShowCreateForm(true);
                        setNewUsuario({
                          nombreCompleto: '',
                          email: '',
                          rol: 'Empleado',
                          contraseña: '',
                        });
                      }}
                    >
                      Nuevo
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                      onClick={() => {
                        setShowUserManagement(false);
                        setShowCreateForm(false);
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                </header>

                <div className="overflow-y-auto px-4 py-4">
                  {showCreateForm ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-900">Crear Nuevo Usuario</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Nombre Completo *
                          </label>
                          <input
                            type="text"
                            value={newUsuario.nombreCompleto}
                            onChange={(e) => setNewUsuario({ ...newUsuario, nombreCompleto: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Juan Pérez"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Email *
                          </label>
                          <input
                            type="email"
                            value={newUsuario.email}
                            onChange={(e) => setNewUsuario({ ...newUsuario, email: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="juan@ejemplo.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Rol
                          </label>
                          <select
                            value={newUsuario.rol}
                            onChange={(e) => setNewUsuario({ ...newUsuario, rol: e.target.value as 'Administrador' | 'Empleado' })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Empleado">Empleado</option>
                            <option value="Administrador">Administrador</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Contraseña (opcional)
                          </label>
                          <input
                            type="password"
                            value={newUsuario.contraseña}
                            onChange={(e) => setNewUsuario({ ...newUsuario, contraseña: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Dejar vacío para usar contraseña por defecto"
                          />
                          <p className="mt-1 text-xs text-slate-400">
                            Si se deja vacío, se usará "empleado123" como contraseña temporal
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleCreateUsuario}
                            disabled={creatingUsuario}
                            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {creatingUsuario ? 'Creando...' : 'Crear Usuario'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewUsuario({
                                nombreCompleto: '',
                                email: '',
                                rol: 'Empleado',
                                contraseña: '',
                              });
                            }}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {loadingUsuarios ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                          Cargando usuarios...
                        </div>
                      ) : usuarios.length > 0 ? (
                        <ul className="space-y-3">
                          {usuarios.map((usuario) => (
                            <li
                              key={usuario.id}
                              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-xs font-semibold text-white">
                                  {usuario.initials || usuario.name.charAt(0).toUpperCase()}
                                </span>
                                <div className="flex flex-col">
                                  <p className="text-sm font-semibold text-slate-800">{usuario.name}</p>
                                  <p className="text-xs text-slate-500">{usuario.email}</p>
                                  <p className="text-xs text-slate-400">{usuario.role}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(usuario.id, usuario.name)}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                title="Eliminar usuario"
                              >
                                Eliminar
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                          No hay usuarios registrados.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onProfileClick}
          className="group flex items-center gap-3 rounded-full border border-transparent px-3 py-1.5 transition hover:border-slate-200 hover:bg-slate-50"
          aria-label="Abrir perfil de usuario"
        >
          <div className="text-right text-xs leading-tight text-slate-500">
            <p className="font-medium text-slate-700">{userName}</p>
            <span className="hidden text-slate-400 sm:inline">Ver perfil</span>
          </div>
          {userPhoto && !photoError ? (
            <img
              src={buildImageUrl(userPhoto) || ''}
              alt={`Foto de ${userName}`}
              className="h-10 w-10 rounded-full object-cover shadow-md shadow-blue-500/25 transition group-hover:scale-105"
              onError={() => {
                // Si la imagen falla al cargar, mostrar las iniciales
                setPhotoError(true);
              }}
            />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition group-hover:scale-105">
              {userInitials}
            </span>
          )}
        </button>
      </div>

      {/* Popup de confirmación de eliminación */}
      {showDeleteConfirm && usuarioToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Confirmar eliminación</h3>
            <p className="mb-6 text-sm text-slate-600">
              ¿Estás seguro de que quieres eliminar al usuario <span className="font-semibold">"{usuarioToDelete.name}"</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingUsuario}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingUsuario ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUsuarioToDelete(null);
                }}
                disabled={deletingUsuario}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de mensaje (éxito/error) */}
      {showMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-lg ${
              messageType === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <p className="text-sm font-medium">{messageText}</p>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

