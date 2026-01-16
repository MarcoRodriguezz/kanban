import React, { useMemo, useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import ForgotPasswordPage from './components/ForgotPasswordPage/ForgotPasswordPage';
import PasswordChangePage from './components/PasswordChangePage/PasswordChangePage';
import MainLayout from './components/MainLayout/MainLayout';
import ProfilePage from './components/ProfilePage/ProfilePage';
import { DEFAULT_PROJECTS } from './components/Sidebar/Sidebar';
import BoardPage from './components/BoardPage/BoardPage';
import ReleasesPage from './components/ReleasesPage/ReleasesPage';
import BacklogsPage from './components/BacklogsPage/BacklogsPage';
import SettingsPage from './components/SettingsPage/SettingsPage';
import ComponentsPage from './components/ComponentsPage/ComponentsPage';
import RepositoryPage from './components/RepositoryPage/RepositoryPage';
import ReportsPage from './components/ReportsPage/ReportsPage';
import IssuesPage from './components/IssuesPage/IssuesPage';
import { HeaderNotification } from './components/Header/Header';
import { getCurrentUser, getProjects, getNotifications, markNotificationAsRead, Notification, createProject, deleteProject, getProjectFull } from './services/api';

// Mapear rol del backend al formato del frontend
// Ahora solo hay Administrador y Empleado como roles globales
// Los gestores se determinan por proyecto específico
const mapRole = (rol: string): 'admin' | 'product-owner' | 'employee' => {
  if (rol === 'Administrador') {
    return 'admin';
  }
  // Gestor_de_proyecto ya no existe como rol global
  // Si viene del backend antiguo, tratarlo como empleado
  if (rol === 'Gestor_de_proyecto') {
    return 'employee';
  }
  return 'employee';
};

const App: React.FC = () => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [view, setView] = useState<
    | 'login'
    | 'forgot-password'
    | 'password-change'
    | 'main'
    | 'profile'
    | 'board'
    | 'releases'
    | 'backlogs'
    | 'settings'
    | 'components'
    | 'repository'
    | 'reports'
    | 'issues'
  >('login');
  const [selectionId, setSelectionId] = useState<string>('my-tasks');
  const [pendingBoardTask, setPendingBoardTask] = useState<
    { taskId: string; columnId?: string; projectId: string } | null
  >(null);
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: 'admin' | 'product-owner' | 'employee'; id?: string; rol?: string } | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [selectedProjectGestorId, setSelectedProjectGestorId] = useState<string | null>(null);

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await getNotifications();
      const unreadCount = notifs.filter(n => !n.read).length;
      setNotificationCount(unreadCount);
      
      // Convertir notificaciones del backend al formato del Header
      const headerNotifs: HeaderNotification[] = notifs.map((notif) => {
        // Determinar el tipo de notificación basado en el tipo del backend
        let notificationType: 'commit' | 'task-assigned' | 'task-updated' | 'project-added' | 'issue-reported' = 'task-updated';
        if (notif.type === 'task-assigned') {
          notificationType = 'task-assigned';
        } else if (notif.type === 'commit') {
          notificationType = 'commit';
        } else if (notif.type === 'project-added') {
          notificationType = 'project-added';
        } else if (notif.type === 'issue-reported') {
          notificationType = 'issue-reported';
        }
        
        // Crear función onClick según el tipo de notificación
        const onClick = async () => {
          // Marcar como leída solo si no está leída
          if (!notif.read) {
            try {
              await markNotificationAsRead(notif.id);
              // Actualizar el estado local inmediatamente
              setNotifications(prev => 
                prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
              );
              setNotificationCount(prev => Math.max(0, prev - 1));
            } catch (err) {
              console.error('Error marcando notificación como leída:', err);
            }
          }
          
          // Navegar según el tipo
          if (notificationType === 'task-assigned' || notificationType === 'task-updated') {
            // Navegar a la tarea en el board
            if (notif.taskId && notif.tarea) {
              const estadoToColumnId: Record<string, string> = {
                'Pendiente': 'pending',
                'En_progreso': 'in-progress',
                'En_revision': 'review',
                'Completado': 'done',
              };
              const columnId = estadoToColumnId[notif.tarea.estado] || 'pending';
              setSelectionId(notif.tarea.proyectoId.toString());
              setPendingBoardTask({ 
                taskId: notif.taskId, 
                columnId, 
                projectId: notif.tarea.proyectoId.toString() 
              });
              setView('board');
            }
          } else if (notificationType === 'project-added') {
            // Navegar al proyecto
            if (notif.projectId) {
              setSelectionId(notif.projectId);
              setView('main');
            }
          } else if (notificationType === 'commit') {
            // Navegar al repositorio del proyecto
            if (notif.projectId) {
              setSelectionId(notif.projectId);
              setView('repository');
            }
          } else if (notificationType === 'issue-reported') {
            // Navegar a la página de issues del proyecto
            if (notif.projectId) {
              setSelectionId(notif.projectId);
              setView('issues');
            }
          }
        };
        
        return {
          id: notif.id,
          title: notif.title,
          description: notif.description,
          timestamp: notif.timestamp,
          type: notificationType,
          read: notif.read,
          onClick,
        };
      });
      
      setNotifications(headerNotifs);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      setNotifications([]);
      setNotificationCount(0);
    }
  }, []); // Los setters de React son estables y no necesitan estar en las dependencias

  // Verificar si hay token de reset en la URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      // Guardar el token y cambiar a la vista de password-change
      setResetToken(token);
      setView('password-change');
      // Limpiar la URL para que no se muestre el token
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Función para cargar datos del usuario (reutilizable)
  const loadUserData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCurrentUser(null);
      setProjects(DEFAULT_PROJECTS);
      return;
    }

    try {
      // Verificar si el token es válido y obtener usuario actual
      const user = await getCurrentUser();
      
      const mappedRole = mapRole(user.role || user.rol || 'Empleado');
      
      // Mapear el usuario del backend
      const mappedUser = {
        name: user.name || user.nombreCompleto || 'Usuario',
        role: mappedRole,
        id: user.id,
        rol: user.rol || user.role,
      };
      
      setCurrentUser(mappedUser);
      
      // Cargar proyectos y notificaciones
      setIsLoadingProjects(true);
      try {
        const proyectos = await getProjects();
        setProjects(proyectos);
      } catch (error) {
        console.error('Error cargando proyectos:', error);
        // Continuar con proyectos por defecto si falla
        setProjects(DEFAULT_PROJECTS);
      } finally {
        setIsLoadingProjects(false);
      }
      
      // Cargar notificaciones
      loadNotifications();
    } catch (error: any) {
      // Limpiar el token si es un error de autenticación (401 o 403 con mensaje de token)
      // No limpiar para otros errores para evitar perder el token por errores temporales
      const errorMessage = error.message?.toLowerCase() || '';
      const errorError = (error.error && typeof error.error === 'string') ? error.error.toLowerCase() : '';
      const isAuthError = 
        errorMessage.includes('401') || 
        errorMessage.includes('403') ||
        errorMessage.includes('no autorizado') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('token expirado') ||
        errorMessage.includes('token inválido') ||
        errorMessage.includes('token invalido') ||
        errorMessage.includes('token expiró') ||
        errorMessage.includes('token correcto') ||
        errorMessage.includes('asegúrate de haber iniciado sesión') ||
        errorMessage.includes('asegurate de haber iniciado sesion') ||
        errorMessage.includes('expirado') ||
        errorError.includes('token') ||
        errorError.includes('expirado');
      
      if (isAuthError) {
        // Limpiar el token y resetear el estado sin lanzar error
        localStorage.removeItem('token');
        setCurrentUser(null);
        setProjects(DEFAULT_PROJECTS);
        // No lanzar el error para evitar logs innecesarios - esto es un comportamiento esperado
        return;
      }
      
      // Solo loggear errores que NO son de autenticación
      console.error('Error cargando datos del usuario:', error);
      // Re-lanzar el error para que el llamador pueda manejarlo
      throw error;
    }
  }, [loadNotifications]);

  // Verificar autenticación al cargar la app y cargar proyectos
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        await loadUserData();
        setView('main');
      } catch (error: any) {
        // Si es un error de autenticación, ya fue manejado silenciosamente en loadUserData
        // Solo loggear otros errores
        if (!error?.isAuthError) {
          console.error('Error en checkAuth:', error);
        }
        // No cambiar la vista si hay un error de autenticación - dejar que el usuario vea la página de login
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Escuchar cambios en el token de localStorage para recargar datos cuando cambie el usuario
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        // Si el token cambió, recargar datos del usuario
        loadUserData().catch((error) => {
          console.error('Error en loadUserData desde storage change:', error);
          // No hacer nada, solo loggear el error para evitar que la página se recargue
        });
      }
    };

    // Escuchar cambios de localStorage desde otras pestañas/ventanas
    window.addEventListener('storage', handleStorageChange);

    // También escuchar cambios locales usando un evento personalizado
    // NOTA: Este listener se ejecuta DESPUÉS del login, pero el callback onLogin ya llama a loadUserData()
    // Por lo tanto, este listener solo debería ejecutarse para cambios de token desde otras fuentes
    const handleTokenChange = () => {
      // Solo recargar si no estamos en el proceso de login
      const currentView = view; // Capturar el valor actual de view
      if (currentView !== 'login') {
        loadUserData().catch((error) => {
          console.error('Error en loadUserData desde tokenChanged:', error);
          // No hacer nada, solo loggear el error para evitar que la página se recargue
        });
      }
    };
    window.addEventListener('tokenChanged', handleTokenChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, [loadUserData, view]);

  // Recargar notificaciones periódicamente cuando el usuario está autenticado
  useEffect(() => {
    if (view === 'login' || view === 'forgot-password' || view === 'password-change') {
      return;
    }
    
    // Cargar notificaciones cada 30 segundos
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [view]);

  // Escuchar evento de actualización de notificaciones
  useEffect(() => {
    const handleNotificationsUpdated = () => {
      loadNotifications();
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);
    
    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
    };
  }, []);

  const selectedProject = selectionId === 'my-tasks'
    ? null
    : projects.find((project) => project.id === selectionId) ?? null;

  // Cargar gestorId del proyecto seleccionado
  useEffect(() => {
    const loadProjectGestor = async () => {
      if (!selectedProject?.id || selectedProject.id === 'my-tasks') {
        setSelectedProjectGestorId(null);
        return;
      }

      try {
        const proyecto = await getProjectFull(selectedProject.id);
        setSelectedProjectGestorId(proyecto.gestorId?.toString() || null);
      } catch (error) {
        console.error('Error cargando gestor del proyecto:', error);
        setSelectedProjectGestorId(null);
      }
    };

    loadProjectGestor();
  }, [selectedProject?.id]);

  // Verificar si el usuario puede acceder al backlog (administrador o gestor del proyecto)
  const canAccessBacklog = useMemo(() => {
    if (!currentUser?.id) return false;
    const isAdmin = currentUser.rol === 'Administrador';
    const isGestor = selectedProjectGestorId && currentUser.id === selectedProjectGestorId;
    return isAdmin || isGestor;
  }, [currentUser?.id, currentUser?.rol, selectedProjectGestorId]);

  // Proteger la ruta de Backlogs: solo administradores o gestores del proyecto pueden acceder
  useEffect(() => {
    if (view === 'backlogs' && !canAccessBacklog) {
      setView('main');
    }
  }, [view, canAccessBacklog]);

  const handleSelect = (projectId: string) => {
    setSelectionId(projectId);
    setPendingBoardTask(null);
    if (projectId === 'my-tasks') {
      setView('main');
    }
  };

  const handleCreateProject = async (projectData: Omit<typeof DEFAULT_PROJECTS[0], 'id'>) => {
    if (!currentUser?.id) {
      console.error('No se puede crear proyecto: usuario no autenticado');
      throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
    }

    try {
      // Usar el ownerId si está disponible y es válido (usuario seleccionado como gestor), 
      // de lo contrario usar el usuario actual
      let gestorIdStr: string;
      if (projectData.ownerId && projectData.ownerId.trim()) {
        gestorIdStr = projectData.ownerId;
      } else {
        gestorIdStr = currentUser.id;
      }
      
      const gestorId = parseInt(gestorIdStr, 10);
      if (isNaN(gestorId) || gestorId <= 0) {
        throw new Error('ID de usuario inválido. Por favor, selecciona un responsable o recarga la página.');
      }

      // Preparar datos para el backend
      // Convertir fecha a formato ISO datetime completo (el backend espera datetime, no solo fecha)
      const fechaInicioStr = projectData.startDate || new Date().toISOString().split('T')[0];
      const fechaInicio = fechaInicioStr.includes('T') 
        ? fechaInicioStr 
        : new Date(fechaInicioStr + 'T00:00:00.000Z').toISOString();
      
      const fechaFin = projectData.endDate 
        ? (projectData.endDate.includes('T') 
            ? projectData.endDate 
            : new Date(projectData.endDate + 'T00:00:00.000Z').toISOString())
        : null;

      const proyectoData = {
        nombre: projectData.name,
        descripcion: projectData.description || null,
        responsable: projectData.owner || currentUser.name,
        equipo: projectData.team || 'Sin equipo',
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        gestorId: gestorId,
      };

      // Crear proyecto en el backend
      const response = await createProject(proyectoData);
      
      // Recargar proyectos desde el backend para actualizar el sidebar
      const proyectos = await getProjects();
      setProjects(proyectos);
      
      // Seleccionar el proyecto recién creado
      if (response.proyecto?.id) {
        setSelectionId(response.proyecto.id.toString());
      }
    } catch (error: any) {
      console.error('Error creando proyecto:', error);
      // Construir mensaje de error más descriptivo
      let errorMessage = 'Error al crear el proyecto. Por favor, intenta nuevamente.';
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Re-lanzar el error con el mensaje mejorado para que el Sidebar pueda mostrarlo
      const enhancedError = new Error(errorMessage);
      throw enhancedError;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      // Eliminar proyecto en el backend
      await deleteProject(projectId);
      
      // Actualizar estado local
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      
      // Si el proyecto eliminado estaba seleccionado, cambiar a "Mis tareas"
      if (selectionId === projectId) {
        setSelectionId('my-tasks');
        setView('main');
      }
      
      // Recargar proyectos desde el backend para asegurar sincronización
      const proyectos = await getProjects();
      setProjects(proyectos);
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      alert('Error al eliminar el proyecto. Por favor, intenta nuevamente.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setProjects(DEFAULT_PROJECTS);
    setNotifications([]);
    setNotificationCount(0);
    setView('login');
    // Disparar evento personalizado para que otros listeners sepan que el token cambió
    window.dispatchEvent(new Event('tokenChanged'));
  };

  // Mostrar loading mientras se verifica la autenticación
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b3d91] to-[#1f8ecd]">
        <div className="text-center text-white">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          <p className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }


  if (view === 'main') {
    return (
      <MainLayout
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        selectionId={selectionId}
        onSelect={handleSelect}
        projects={projects}
        onCreateProject={handleCreateProject}
        currentUser={currentUser}
        headerNotifications={notifications}
        onOpenBoard={(project) => {
          setSelectionId(project.id);
          setPendingBoardTask(null);
          setView('board');
        }}
        onOpenBoardTask={({ taskId, columnId, projectId }) => {
          setSelectionId(projectId);
          setPendingBoardTask({ taskId, columnId, projectId });
          setView('board');
        }}
        onOpenReleases={(project) => {
          setSelectionId(project.id);
          setView('releases');
        }}
        onOpenBacklogs={(project) => {
          setSelectionId(project.id);
          setView('backlogs');
        }}
        onOpenSettings={(project) => {
          setSelectionId(project.id);
          setView('settings');
        }}
        onOpenComponents={(project) => {
          setSelectionId(project.id);
          setView('components');
        }}
        onOpenRepository={(project) => {
          setSelectionId(project.id);
          setView('repository');
        }}
        onOpenReports={(project) => {
          setSelectionId(project.id);
          setView('reports');
        }}
        onOpenIssues={(project) => {
          setSelectionId(project.id);
          setView('issues');
        }}
      />
    );
  }

  if (view === 'profile') {
    return (
      <ProfilePage
        onBack={() => setView('main')}
        onChangePassword={() => setView('password-change')}
        onLogoutRequest={handleLogout}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView(projectId === 'my-tasks' ? 'main' : 'main');
        }}
        onOpenBoardTask={({ taskId, columnId, projectId }) => {
          setSelectionId(projectId);
          setPendingBoardTask({ taskId, columnId, projectId });
          setView('board');
        }}
        headerNotifications={notifications}
      />
    );
  }

  if (view === 'board') {
    return (
      <BoardPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          handleSelect(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        initialTaskRef={pendingBoardTask ? { taskId: pendingBoardTask.taskId, columnId: pendingBoardTask.columnId } : null}
        onInitialTaskHandled={() => setPendingBoardTask(null)}
        currentUser={currentUser ? { 
          name: currentUser.name, 
          initials: currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          id: currentUser.id,
          rol: currentUser.rol
        } : undefined}
        headerNotifications={notifications}
      />
    );
  }

  if (view === 'releases') {
    return (
      <ReleasesPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId: string) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
        currentUser={currentUser || { name: 'Usuario', role: 'employee', id: undefined, rol: undefined }}
      />
    );
  }

  if (view === 'backlogs') {
    // Si no tiene permisos, no renderizar nada (el useEffect ya redirigirá)
    if (!canAccessBacklog) {
      return null;
    }
    return (
      <BacklogsPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
      />
    );
  }

  if (view === 'settings') {
    return (
      <SettingsPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
        currentUser={currentUser || { name: 'Usuario', role: 'employee', id: undefined, rol: undefined }}
        onDeleteProject={handleDeleteProject}
      />
    );
  }

  if (view === 'components') {
    return (
      <ComponentsPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
      />
    );
  }

  if (view === 'repository') {
    // No renderizar hasta que currentUser esté cargado para evitar mostrar botones incorrectos
    if (!currentUser) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b3d91] to-[#1f8ecd]">
          <div className="text-center text-white">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
            <p className="text-sm">Cargando...</p>
          </div>
        </div>
      );
    }
    
    return (
      <RepositoryPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
        currentUser={currentUser}
      />
    );
  }

  if (view === 'reports') {
    return (
      <ReportsPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
      />
    );
  }

  if (view === 'issues') {
    return (
      <IssuesPage
        project={selectedProject}
        projects={projects}
        selectedId={selectionId}
        onSelect={(projectId) => {
          setSelectionId(projectId);
          setView('main');
        }}
        onBack={() => setView('main')}
        onProfileClick={() => setView('profile')}
        onLogout={handleLogout}
        headerNotifications={notifications}
        currentUser={currentUser ? { 
          name: currentUser.name, 
          role: currentUser.role, 
          rol: currentUser.rol 
        } : { name: 'Usuario', role: 'employee', rol: undefined }}
      />
    );
  }

  if (view === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onBackToLogin={() => setView('login')}
        onAccessWithEmail={() => setView('password-change')}
      />
    );
  }

  if (view === 'password-change') {
    return <PasswordChangePage onBackToLogin={() => setView('login')} resetToken={resetToken || undefined} />;
  }

  return (
    <LoginPage
      onForgotPassword={() => setView('forgot-password')}
      onLogin={async () => {
        // Recargar datos del usuario después del login
        setIsCheckingAuth(true);
        try {
          await loadUserData();
          setSelectionId('my-tasks');
          setView('main');
          // NO disparar tokenChanged aquí porque ya se disparó en LoginPage
          // y causaría una doble llamada a loadUserData()
        } catch (error: any) {
          console.error('Error después del login:', error);
          // Si hay un error, volver al login pero mantener el token por si es un error temporal
          setView('login');
          // Mostrar un mensaje de error al usuario
          alert('Error al cargar los datos del usuario. Por favor, intenta iniciar sesión nuevamente.');
        } finally {
          setIsCheckingAuth(false);
        }
      }}
    />
  );
};

export default App;
