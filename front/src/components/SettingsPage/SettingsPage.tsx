import React from 'react';
import Sidebar, { DEFAULT_PROJECTS, SidebarProject } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import { getProjectFull, updateProject, UpdateProjectData, getUsuarios, getMiembrosProyecto, getProjects, Usuario, cambiarRolMiembro, removerMiembroProyecto, agregarMiembroProyecto, salirDelProyecto } from '../../services/api';

// Helper para construir la URL completa de la imagen
const buildImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  // En desarrollo, usar localhost:3001, en producción usar la URL del backend
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  return `${API_URL}${imagePath}`;
};

type RoleKey = 'administrator' | 'project-manager' | 'employee';

type ProjectMember = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  role: RoleKey;
  lastActivity: string;
  esCreador?: boolean;
  fotoPerfil?: string | null;
};

type PermissionMatrix = {
  key: RoleKey;
  label: string;
  summary: string;
  permissions: Array<{ action: string; allowed: boolean }>;
};

const INITIAL_MEMBERS: ProjectMember[] = [
  {
    id: 'user-001',
    name: 'María Sánchez',
    email: 'maria.sanchez@empresa.com',
    initials: 'MS',
    avatarColor: 'bg-gradient-to-br from-blue-600 to-blue-500',
    role: 'administrator',
    lastActivity: 'Hace 2 horas',
  },
  {
    id: 'user-002',
    name: 'Carlos Ortega',
    email: 'carlos.ortega@empresa.com',
    initials: 'CO',
    avatarColor: 'bg-gradient-to-br from-slate-600 to-slate-500',
    role: 'project-manager',
    lastActivity: 'Hace 35 minutos',
  },
  {
    id: 'user-003',
    name: 'Ana Rodríguez',
    email: 'ana.rodriguez@empresa.com',
    initials: 'AR',
    avatarColor: 'bg-gradient-to-br from-rose-500 to-rose-400',
    role: 'employee',
    lastActivity: 'Hace 10 minutos',
  },
];

const ROLES: PermissionMatrix[] = [
  {
    key: 'administrator',
    label: 'Administrador',
    summary: 'Control total del proyecto, configuraciones críticas y facturación.',
    permissions: [
      { action: 'Gestionar miembros y roles', allowed: true },
      { action: 'Editar configuraciones globales', allowed: true },
      { action: 'Crear/Editar/Eliminar tareas', allowed: true },
      { action: 'Modificar columnas y estados', allowed: true },
      { action: 'Ver reportes y métricas', allowed: true },
    ],
  },
  {
    key: 'project-manager',
    label: 'Gestor de proyecto',
    summary: 'Gestiona backlog, releases, prioridades y configuración operativa.',
    permissions: [
      { action: 'Gestionar miembros y roles', allowed: true },
      { action: 'Editar configuraciones globales', allowed: true },
      { action: 'Crear/Editar/Eliminar tareas', allowed: true },
      { action: 'Modificar columnas y estados', allowed: true },
      { action: 'Ver reportes y métricas', allowed: true },
    ],
  },
  {
    key: 'employee',
    label: 'Empleado',
    summary: 'Aporta en el backlog, toma tareas y actualiza estados.',
    permissions: [
      { action: 'Gestionar miembros y roles', allowed: false },
      { action: 'Editar configuraciones globales', allowed: false },
      { action: 'Crear/Editar/Eliminar tareas', allowed: true },
      { action: 'Modificar columnas y estados', allowed: true },
      { action: 'Ver reportes y métricas', allowed: true },
    ],
  },
];

const ROLE_DISPLAY: Record<RoleKey, string> = {
  administrator: 'Administrador',
  'project-manager': 'Gestor de proyecto',
  employee: 'Empleado',
};

type SettingsPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerNotifications?: HeaderProps['notifications'];
  currentUser?: {
    name: string;
    role: 'admin' | 'product-owner' | 'employee';
    id?: string;
    rol?: string;
  };
  onDeleteProject?: (projectId: string) => void;
};

const CURRENT_USER_FALLBACK = {
  name: 'María Sánchez',
  role: 'employee' as const,
  id: undefined,
  rol: undefined,
};

const SettingsPage: React.FC<SettingsPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  headerNotifications,
  currentUser = CURRENT_USER_FALLBACK,
  onDeleteProject,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [members, setMembers] = React.useState<ProjectMember[]>(INITIAL_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(
    INITIAL_MEMBERS[0]?.id ?? null
  );
  const [showAddMemberModal, setShowAddMemberModal] = React.useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<{ title: string; message: string; password?: string } | null>(null);
  const [newMemberForm, setNewMemberForm] = React.useState<{
    role: RoleKey;
    usuarioId?: string;
  }>({
    role: 'employee',
    usuarioId: undefined,
  });
  const [isAddingMember, setIsAddingMember] = React.useState(false);

  // Estado para datos del proyecto
  const [projectData, setProjectData] = React.useState<{
    responsable: string;
    equipo: string;
    fecha_inicio: string;
    fecha_fin: string;
  } | null>(null);
  const [isEditingProject, setIsEditingProject] = React.useState(false);
  const [isLoadingProject, setIsLoadingProject] = React.useState(false);
  const [isSavingProject, setIsSavingProject] = React.useState(false);
  const [projectError, setProjectError] = React.useState<string | null>(null);
  
  // Estado para opciones de desplegables
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
  const [equipos, setEquipos] = React.useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = React.useState(false);
  
  // Estado para el gestor del proyecto
  const [gestorId, setGestorId] = React.useState<string | null>(null);

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);

  const filteredMembers = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return members;
    }
    const term = searchTerm.trim().toLowerCase();
    return members.filter((member) =>
      member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  // Determinar si el usuario actual es gestor del proyecto
  const esGestorProyecto = React.useMemo(() => {
    if (!currentUser?.id || !gestorId) return false;
    return currentUser.id === gestorId;
  }, [currentUser?.id, gestorId]);

  // Determinar si el usuario actual es el creador del proyecto
  const esCreadorProyecto = React.useMemo(() => {
    if (!currentUser?.id || !members.length) return false;
    const creador = members.find(m => m.esCreador === true);
    return creador?.id === currentUser.id;
  }, [currentUser?.id, members]);

  // Los gestores del proyecto también pueden gestionar miembros
  const canManageMembers = currentUser.role === 'admin' || currentUser.role === 'product-owner' || esGestorProyecto;
  const canEditProject = currentUser.role === 'admin' || currentUser.role === 'product-owner' || esGestorProyecto;
  // Solo admin, creador o gestor pueden eliminar proyectos
  const canDeleteProject = currentUser.role === 'admin' || esCreadorProyecto || esGestorProyecto;
  const isAdmin = currentUser.role === 'admin';

  const selectedMember = React.useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? members[0] ?? null,
    [members, selectedMemberId]
  );
  
  // Determinar si el miembro seleccionado es el gestor actual
  const selectedMemberIsManager = React.useMemo(() => {
    if (!selectedMember) return false;
    return selectedMember.role === 'project-manager' || selectedMember.role === 'administrator';
  }, [selectedMember]);

  // Determinar si el miembro seleccionado es un administrador global
  const selectedMemberIsAdmin = React.useMemo(() => {
    if (!selectedMember) return false;
    return selectedMember.role === 'administrator';
  }, [selectedMember]);

  // Determinar si se puede remover el miembro seleccionado
  // Los gestores no pueden remover administradores
  const canRemoveSelectedMember = React.useMemo(() => {
    if (!selectedMember) return false;
    // Si el miembro es administrador y el usuario actual no es administrador, no se puede remover
    if (selectedMemberIsAdmin && !isAdmin) {
      return false;
    }
    return true;
  }, [selectedMember, selectedMemberIsAdmin, isAdmin]);

  // Cargar usuarios cuando se abre el modal (se recarga cada vez que se abre)
  React.useEffect(() => {
    if (canManageMembers && showAddMemberModal) {
      const cargarUsuarios = async () => {
        
        const cargarUsuariosFallback = async (): Promise<boolean> => {
          if (project?.id) {
            try {
              // Intentar obtener todos los usuarios a través de los miembros de todos los proyectos
              // Esto es un workaround si el endpoint de usuarios no funciona
              const proyectos = await getProjects();
              const todosLosUsuarios = new Map<string, Usuario>();
              
              // Cargar miembros de todos los proyectos para obtener una lista completa
              for (const proyecto of proyectos) {
                try {
                  const miembrosResponse = await getMiembrosProyecto(proyecto.id);
                  miembrosResponse.miembros.forEach(m => {
                    if (!todosLosUsuarios.has(m.id)) {
                      todosLosUsuarios.set(m.id, {
                        id: m.id,
                        name: m.name,
                        email: m.email,
                        role: m.role,
                        initials: m.initials,
                      });
                  }
                  });
                } catch (err) {
                  console.error(`Error cargando miembros del proyecto ${proyecto.id}:`, err);
                }
              }
              
              const usuariosArray = Array.from(todosLosUsuarios.values());
              if (usuariosArray.length > 0) {
                setUsuarios(usuariosArray);
                return true; // Fallback exitoso
              }
            } catch (err) {
              console.error('Error en fallback de carga de usuarios:', err);
            }
          }
          return false; // Fallback falló
        };

        try {
          const usuariosResponse = await getUsuarios();
          if (usuariosResponse.usuarios && usuariosResponse.usuarios.length > 0) {
            setUsuarios(usuariosResponse.usuarios);
          } else {
            console.warn('No se recibieron usuarios del endpoint, usando fallback');
            await cargarUsuariosFallback();
          }
        } catch (error: any) {
          // Intentar fallback silenciosamente
          const fallbackExitoso = await cargarUsuariosFallback();
          if (!fallbackExitoso) {
            // Solo mostrar error si el fallback también falla
            console.error('Error cargando usuarios y fallback también falló:', error);
            console.error('Detalles del error:', {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data
            });
          } else {
            // Fallback exitoso, no mostrar error al usuario
            console.info('Endpoint de usuarios no disponible, usando lista de usuarios de proyectos');
          }
        }
      };

      cargarUsuarios();
    }
  }, [canManageMembers, showAddMemberModal, project?.id]);

  // Cargar opciones de usuarios y equipos
  React.useEffect(() => {
    const cargarOpciones = async () => {
      setIsLoadingOptions(true);
      try {
        // Cargar usuarios (solo si no se cargaron antes)
        if (usuarios.length === 0) {
          try {
            const usuariosResponse = await getUsuarios();
            setUsuarios(usuariosResponse.usuarios || []);
          } catch (error) {
            console.error('Error cargando usuarios:', error);
            // Si falla, intentar cargar miembros del proyecto actual
            if (project?.id) {
              try {
                const miembrosResponse = await getMiembrosProyecto(String(project.id));
                const miembrosComoUsuarios: Usuario[] = miembrosResponse.miembros.map(m => ({
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  role: m.role,
                  initials: m.initials,
                }));
                setUsuarios(miembrosComoUsuarios);
              } catch (err) {
                console.error('Error cargando miembros del proyecto:', err);
              }
            }
          }
        }

        // Cargar equipos únicos de todos los proyectos
        try {
          const proyectos = await getProjects();
          const equiposUnicos = new Set<string>();
          proyectos.forEach(p => {
            if (p.team && p.team.trim()) {
              equiposUnicos.add(p.team.trim());
            }
          });
          setEquipos(Array.from(equiposUnicos).sort());
        } catch (error) {
          console.error('Error cargando equipos:', error);
        }
      } finally {
        setIsLoadingOptions(false);
      }
    };

    if (canEditProject) {
      cargarOpciones();
    }
  }, [canEditProject, project?.id]);

  // Cargar miembros del proyecto cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setMembers([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setMembers([]);
      return;
    }

    getMiembrosProyecto(String(proyectoId))
      .then((response) => {
        const miembrosMapeados: ProjectMember[] = response.miembros.map((m) => {
          // Usar directamente el role que viene del backend
          // El rol se determina solo por esGestor y esCreador del proyecto específico
          const role: RoleKey = (m.role as RoleKey) || 'employee';

          // Generar iniciales desde el nombre
          const iniciales = m.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'U';

          return {
            id: m.id, // Usar el ID del backend directamente
            name: m.name,
            email: m.email,
            initials: m.initials || iniciales,
            avatarColor: 'bg-gradient-to-br from-blue-600 to-blue-500',
            role,
            lastActivity: m.lastActivity || 'Reciente',
            esCreador: m.esCreador,
            fotoPerfil: m.fotoPerfil || null,
          };
        });

        setMembers(miembrosMapeados);
        if (miembrosMapeados.length > 0 && !selectedMemberId) {
          setSelectedMemberId(miembrosMapeados[0].id);
        }
      })
      .catch((error: any) => {
        console.error('Error cargando miembros del proyecto:', error);
        // En caso de error, mantener los miembros iniciales o vacío
        setMembers([]);
      });
  }, [project?.id]);

  // Cargar datos del proyecto cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setProjectData(null);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setProjectData(null);
      return;
    }

    setIsLoadingProject(true);
    setProjectError(null);

    getProjectFull(String(proyectoId))
      .then((proyecto) => {
        setProjectData({
          responsable: proyecto.responsable || '',
          equipo: proyecto.equipo || '',
          fecha_inicio: proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toISOString().split('T')[0] : '',
          fecha_fin: proyecto.fecha_fin ? new Date(proyecto.fecha_fin).toISOString().split('T')[0] : '',
        });
        // Guardar el gestorId del proyecto
        setGestorId(proyecto.gestorId?.toString() || null);
      })
      .catch((error: any) => {
        console.error('Error cargando datos del proyecto:', error);
        setProjectError(error.message || 'Error al cargar los datos del proyecto');
      })
      .finally(() => {
        setIsLoadingProject(false);
      });
  }, [project?.id]);

  const handleSaveProjectData = async () => {
    if (!project?.id || !projectData) {
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setProjectError('ID de proyecto inválido.');
      return;
    }

    try {
      setIsSavingProject(true);
      setProjectError(null);

      // Convertir fechas de formato YYYY-MM-DD a ISO datetime
      let fechaInicioISO: string | undefined = undefined;
      let fechaFinISO: string | null = null;

      if (projectData.fecha_inicio) {
        const fechaInicio = new Date(projectData.fecha_inicio);
        fechaInicio.setHours(0, 0, 0, 0); // Inicio del día
        fechaInicioISO = fechaInicio.toISOString();
      }

      if (projectData.fecha_fin) {
        const fechaFin = new Date(projectData.fecha_fin);
        fechaFin.setHours(23, 59, 59, 999); // Final del día
        fechaFinISO = fechaFin.toISOString();
      }

      // Si se cambió el responsable, buscar el miembro correspondiente para actualizar gestorId
      let gestorIdActualizado: number | undefined = undefined;
      if (projectData.responsable.trim()) {
        const miembroSeleccionado = members.find(m => m.name === projectData.responsable.trim());
        if (miembroSeleccionado) {
          gestorIdActualizado = Number(miembroSeleccionado.id);
        }
      }

      // Si se añadió un nuevo equipo, agregarlo a la lista de equipos disponibles
      if (projectData.equipo.trim() && !equipos.includes(projectData.equipo.trim())) {
        setEquipos(prev => [...prev, projectData.equipo.trim()].sort());
      }

      const updateData: UpdateProjectData = {
        responsable: projectData.responsable.trim() || undefined,
        equipo: projectData.equipo.trim() || undefined,
        fecha_inicio: fechaInicioISO,
        fecha_fin: fechaFinISO,
        gestorId: gestorIdActualizado,
      };

      await updateProject(String(proyectoId), updateData);
      
      // Recargar datos del proyecto después de guardar para reflejar cambios del backend
      const proyectoActualizado = await getProjectFull(String(proyectoId));
      setProjectData({
        responsable: proyectoActualizado.responsable || '',
        equipo: proyectoActualizado.equipo || '',
        fecha_inicio: proyectoActualizado.fecha_inicio ? new Date(proyectoActualizado.fecha_inicio).toISOString().split('T')[0] : '',
        fecha_fin: proyectoActualizado.fecha_fin ? new Date(proyectoActualizado.fecha_fin).toISOString().split('T')[0] : '',
      });
      
      // Si el proyecto tiene un callback onSelect, notificar el cambio para actualizar otros componentes
      // Esto disparará una recarga del proyecto en otros componentes que lo estén mostrando
      if (onSelect && project?.id) {
        onSelect(project.id);
      }
      
      setIsEditingProject(false);
    } catch (error: any) {
      console.error('Error guardando datos del proyecto:', error);
      setProjectError(error.message || 'Error al guardar los datos del proyecto');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleCancelEdit = () => {
    // Recargar datos del proyecto para cancelar cambios
    if (project?.id) {
      const proyectoId = Number(project.id);
      if (!isNaN(proyectoId)) {
        getProjectFull(String(proyectoId))
          .then((proyecto) => {
            setProjectData({
              responsable: proyecto.responsable || '',
              equipo: proyecto.equipo || '',
              fecha_inicio: proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toISOString().split('T')[0] : '',
              fecha_fin: proyecto.fecha_fin ? new Date(proyecto.fecha_fin).toISOString().split('T')[0] : '',
            });
          })
          .catch((error: any) => {
            console.error('Error recargando datos del proyecto:', error);
          });
      }
    }
    setIsEditingProject(false);
  };

  const handleChangeRole = async (role: RoleKey) => {
    if (!selectedMember || !project?.id) {
      return;
    }

    // Verificar permisos
    if (!canManageMembers) {
      alert('No tienes permisos para cambiar roles');
      return;
    }

    try {
      const usuarioId = selectedMember.id;
      
      // Si se está cambiando el gestor actual a empleado, encontrar automáticamente un nuevo gestor
      // Si no se encuentra otro miembro, el backend usará el creador como fallback automáticamente
      let nuevoGestorId: string | undefined = undefined;
      if (selectedMemberIsManager && role === 'employee') {
        // Buscar el creador del proyecto en los miembros
        const creador = members.find(m => m.esCreador === true);
        if (creador && creador.id !== usuarioId) {
          nuevoGestorId = creador.id;
        } else {
          // Si no hay creador disponible o es el mismo usuario, buscar cualquier otro miembro que no sea el actual
          const otroMiembro = members.find(m => m.id !== usuarioId);
          if (otroMiembro) {
            nuevoGestorId = otroMiembro.id;
          }
        }
      }
      
      // Llamar al backend para cambiar el rol
      await cambiarRolMiembro(project.id, usuarioId, role, nuevoGestorId);

      // Recargar miembros del proyecto para reflejar los cambios
      const proyectoId = Number(project.id);
      if (!isNaN(proyectoId)) {
        try {
          const miembrosResponse = await getMiembrosProyecto(String(proyectoId));
          const miembrosMapeados: ProjectMember[] = miembrosResponse.miembros.map((m) => {
            // Usar directamente el role que viene del backend
            // El backend determina el rol basándose solo en esGestor y esCreador del proyecto
            // El rol global del usuario no influye en el rol del proyecto
            const memberRole: RoleKey = (m.role as RoleKey) || 'employee';

            // Generar iniciales desde el nombre
            const iniciales = m.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join('') || 'U';

            return {
              id: m.id,
              name: m.name,
              email: m.email,
              initials: m.initials || iniciales,
              avatarColor: 'bg-gradient-to-br from-blue-600 to-blue-500',
              role: memberRole,
              lastActivity: m.lastActivity || 'Reciente',
              esCreador: m.esCreador,
              fotoPerfil: m.fotoPerfil || null,
            };
          });

          setMembers(miembrosMapeados);

          // Actualizar el miembro seleccionado si sigue existiendo
          const miembroActualizado = miembrosMapeados.find(m => m.id === usuarioId);
          if (miembroActualizado) {
            setSelectedMemberId(miembroActualizado.id);
          }

          // Recargar los datos del proyecto para actualizar el responsable
          // (necesario tanto si se cambió a gestor como si se relegó al gestor actual)
          const proyectoActualizado = await getProjectFull(String(proyectoId));
          setProjectData({
            responsable: proyectoActualizado.responsable || '',
            equipo: proyectoActualizado.equipo || '',
            fecha_inicio: proyectoActualizado.fecha_inicio ? new Date(proyectoActualizado.fecha_inicio).toISOString().split('T')[0] : '',
            fecha_fin: proyectoActualizado.fecha_fin ? new Date(proyectoActualizado.fecha_fin).toISOString().split('T')[0] : '',
          });
        } catch (error) {
          console.error('Error recargando datos después de cambiar rol:', error);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Error al cambiar el rol del miembro';
      alert(`Error: ${errorMessage}`);
    }
  };


  const handleRemoveMember = async () => {
    if (!selectedMember || !project?.id) {
      return;
    }

    // Confirmar antes de remover
    if (!window.confirm(`¿Estás seguro de que quieres sacar a ${selectedMember.name} del proyecto?`)) {
      return;
    }

    try {
      await removerMiembroProyecto(project.id, selectedMember.id);
      
      // Actualizar la lista de miembros localmente
      setMembers((prev) => prev.filter((member) => member.id !== selectedMember.id));

      setSelectedMemberId((prevId) => {
        if (prevId === selectedMember.id) {
          const remaining = members.filter((member) => member.id !== selectedMember.id);
          return remaining[0]?.id ?? null;
        }
        return prevId;
      });

      // Recargar los miembros del proyecto para asegurar sincronización
      try {
        const response = await getMiembrosProyecto(project.id);
        const miembrosMapeados: ProjectMember[] = response.miembros.map((m) => {
          const role: RoleKey = (m.role as RoleKey) || 'employee';
          const iniciales = m.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'U';

          return {
            id: m.id,
            name: m.name,
            email: m.email,
            initials: m.initials || iniciales,
            avatarColor: 'bg-gradient-to-br from-blue-600 to-blue-500',
            role,
            lastActivity: m.lastActivity || 'Reciente',
            esCreador: m.esCreador,
          };
        });
        setMembers(miembrosMapeados);
      } catch (error) {
        console.error('Error recargando miembros después de remover:', error);
      }
    } catch (error: any) {
      console.error('Error removiendo miembro del proyecto:', error);
      const errorMessage = error.message || error.response?.data?.error || 'Error al remover el miembro del proyecto';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleSubmitNewMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project?.id) {
      alert('No hay proyecto seleccionado');
      return;
    }

    if (!newMemberForm.usuarioId) {
      alert('Por favor selecciona un usuario');
      return;
    }

    setIsAddingMember(true);

    try {
      const usuarioIdFinal = newMemberForm.usuarioId;

      // Verificar si ya está en el proyecto
      const yaEsMiembro = members.some(m => m.id === usuarioIdFinal);
      if (yaEsMiembro) {
        const usuarioSeleccionado = usuarios.find(u => u.id === usuarioIdFinal);
        alert(`El usuario ${usuarioSeleccionado?.name || 'seleccionado'} ya es miembro del proyecto.`);
        setIsAddingMember(false);
        return;
      }

      // Agregar el usuario al proyecto
      await agregarMiembroProyecto(project.id, usuarioIdFinal, newMemberForm.role);

      // Recargar los miembros del proyecto
      const response = await getMiembrosProyecto(project.id);
      const miembrosMapeados: ProjectMember[] = response.miembros.map((m) => {
        const role: RoleKey = (m.role as RoleKey) || 'employee';
        const iniciales = m.name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('') || 'U';

        return {
          id: m.id,
          name: m.name,
          email: m.email,
          initials: m.initials || iniciales,
          avatarColor: 'bg-gradient-to-br from-blue-600 to-blue-500',
          role,
          lastActivity: m.lastActivity || 'Reciente',
          esCreador: m.esCreador,
          fotoPerfil: m.fotoPerfil || null,
        };
      });
      setMembers(miembrosMapeados);

      // Seleccionar el nuevo miembro
      if (miembrosMapeados.length > 0) {
        const nuevoMiembro = miembrosMapeados.find(m => m.id === usuarioIdFinal);
        if (nuevoMiembro) {
          setSelectedMemberId(nuevoMiembro.id);
        }
      }

      // Cerrar modal y resetear formulario
      setShowAddMemberModal(false);
      setNewMemberForm({ role: 'employee', usuarioId: undefined });

      // Mostrar modal de éxito si hay mensaje pendiente
      if (successMessage) {
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Error añadiendo miembro al proyecto:', error);
      const errorMessage = error.message || error.response?.data?.error || 'Error al añadir el miembro al proyecto';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleDeleteProject = () => {
    if (project && onDeleteProject) {
      onDeleteProject(project.id);
      setShowDeleteProjectConfirm(false);
    }
  };

  const handleSalirDelProyecto = async () => {
    if (!project?.id) {
      return;
    }

    // Confirmar antes de salir
    if (!window.confirm(`¿Estás seguro de que quieres salir del proyecto "${project.name}"?`)) {
      return;
    }

    try {
      await salirDelProyecto(project.id);
      alert('Has salido del proyecto exitosamente');
      // Redirigir al tablero principal o recargar proyectos
      if (onBack) {
        onBack();
      }
    } catch (error: any) {
      console.error('Error saliendo del proyecto:', error);
      const errorMessage = error.message || error.response?.data?.error || 'Error al salir del proyecto';
      alert(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        projects={projectList}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoutRequest={() => setShowLogoutConfirm(true)}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          title="Settings"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />

        <main className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Proyecto</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{project ? project.name : 'Tablero principal'}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {canDeleteProject && project && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteProjectConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    Eliminar proyecto
                  </button>
                )}
                {project && (
                  <button
                    type="button"
                    onClick={handleSalirDelProyecto}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Salir del proyecto
                  </button>
                )}
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-slate-600">
              Administra los miembros del proyecto, define permisos por rol y controla quién puede realizar cambios críticos.
              Usa la búsqueda para localizar usuarios y revisa la matriz de permisos antes de asignar nuevos roles.
            </p>
          </section>

          {/* Sección de datos del proyecto */}
          {canEditProject && (
            <section className="rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-lg shadow-slate-900/5">
              <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Datos del proyecto</h3>
                  <p className="text-xs text-slate-500">Edita la información básica del proyecto.</p>
                </div>
                {!isEditingProject && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProject(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
                  >
                    Editar datos
                  </button>
                )}
              </div>

              {projectError && (
                <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm text-rose-700">
                  {projectError}
                </div>
              )}

              {isLoadingProject ? (
                <div className="mt-3 text-sm text-slate-500">Cargando datos del proyecto...</div>
              ) : projectData ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Responsable */}
                  <div className="flex flex-col gap-0.5 rounded-2xl bg-slate-50 px-4 py-1.5">
                    <label className="text-xs uppercase tracking-wide text-slate-400">RESPONSABLE</label>
                    {isEditingProject ? (
                      <select
                        value={projectData.responsable}
                        onChange={(e) => setProjectData({ ...projectData, responsable: e.target.value })}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Selecciona un responsable</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.name}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium text-slate-900">{projectData.responsable || 'No asignado'}</span>
                    )}
                  </div>

                  {/* Equipo */}
                  <div className="flex flex-col gap-0.5 rounded-2xl bg-slate-50 px-4 py-1.5">
                    <label className="text-xs uppercase tracking-wide text-slate-400">EQUIPO</label>
                    {isEditingProject ? (
                      <>
                        <input
                          type="text"
                          list="equipos-list"
                          value={projectData.equipo}
                          onChange={(e) => setProjectData({ ...projectData, equipo: e.target.value })}
                          placeholder="Escribe o selecciona un equipo"
                          autoComplete="off"
                          className="rounded-xl border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-list-button]:hidden"
                          style={{ appearance: 'textfield' }}
                        />
                        <datalist id="equipos-list">
                          {equipos.map((equipo) => (
                            <option key={equipo} value={equipo} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="font-medium text-slate-900">{projectData.equipo || 'No asignado'}</span>
                    )}
                  </div>

                  {/* Inicio */}
                  <div className="flex flex-col gap-0.5 rounded-2xl bg-slate-50 px-4 py-1.5">
                    <label className="text-xs uppercase tracking-wide text-slate-400">INICIO</label>
                    {isEditingProject ? (
                      <input
                        type="date"
                        value={projectData.fecha_inicio}
                        onChange={(e) => setProjectData({ ...projectData, fecha_inicio: e.target.value })}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    ) : (
                      <span className="font-medium text-slate-900">{projectData.fecha_inicio || 'Sin definir'}</span>
                    )}
                  </div>

                  {/* Fin */}
                  <div className="flex flex-col gap-0.5 rounded-2xl bg-slate-50 px-4 py-1.5">
                    <label className="text-xs uppercase tracking-wide text-slate-400">FIN</label>
                    {isEditingProject ? (
                      <input
                        type="date"
                        value={projectData.fecha_fin}
                        onChange={(e) => setProjectData({ ...projectData, fecha_fin: e.target.value })}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    ) : (
                      <span className="font-medium text-slate-900">{projectData.fecha_fin || 'Sin definir'}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">No se pudieron cargar los datos del proyecto.</div>
              )}

              {isEditingProject && (
                <div className="mt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSavingProject}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProjectData}
                    disabled={isSavingProject}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingProject ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white/90 px-6 py-6 shadow-lg shadow-slate-900/5">
              <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Miembros del proyecto</h3>
                  <p className="mt-1 text-xs text-slate-500">Gestiona acceso, roles y actividad reciente.</p>
                </div>
                {canManageMembers && (
                  <button
                    type="button"
                    onClick={async () => {
                      // Recargar usuarios antes de abrir el modal para asegurar que estén actualizados
                      try {
                        const usuariosResponse = await getUsuarios();
                        if (usuariosResponse.usuarios && usuariosResponse.usuarios.length > 0) {
                          setUsuarios(usuariosResponse.usuarios);
                        }
                      } catch (error) {
                        console.error('Error precargando usuarios:', error);
                      }
                      setShowAddMemberModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
                  >
                    Añadir miembro
                  </button>
                )}
              </header>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre o email"
                    className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  {filteredMembers.map((member) => {
                    const isActive = member.id === selectedMember?.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                          isActive
                            ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-blue-200'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          {member.fotoPerfil ? (
                            <img 
                              src={buildImageUrl(member.fotoPerfil) || ''} 
                              alt={member.name}
                              className="h-10 w-10 rounded-full object-cover"
                              onError={(e) => {
                                // Si la imagen falla al cargar, mostrar iniciales
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'grid';
                              }}
                            />
                          ) : null}
                          <span 
                            className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white ${member.avatarColor}`}
                            style={{ display: member.fotoPerfil ? 'none' : 'grid' }}
                          >
                            {member.initials}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">{member.name}</span>
                            <span className="text-xs text-slate-500">{member.email}</span>
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {ROLE_DISPLAY[member.role]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
              <header className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Detalles del miembro</h3>
                <p className="text-xs text-slate-500">Configura el rol, revisa actividad y acceso granular.</p>
              </header>

              <div className="flex items-center gap-4">
                {selectedMember ? (
                  <>
                    {selectedMember.fotoPerfil ? (
                      <img 
                        src={buildImageUrl(selectedMember.fotoPerfil) || ''} 
                        alt={selectedMember.name}
                        className="h-16 w-16 rounded-full object-cover"
                        onError={(e) => {
                          // Si la imagen falla al cargar, mostrar iniciales
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'grid';
                        }}
                      />
                    ) : null}
                    <span 
                      className={`grid h-16 w-16 place-items-center rounded-full text-lg font-semibold text-white ${selectedMember.avatarColor}`}
                      style={{ display: selectedMember.fotoPerfil ? 'none' : 'grid' }}
                    >
                      {selectedMember.initials}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-slate-900">{selectedMember.name}</span>
                      <span className="text-xs text-slate-500">{selectedMember.email}</span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">Selecciona un miembro para ver los detalles.</span>
                )}
              </div>

              {canManageMembers && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Rol asignado</span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROLES.map((role) => {
                      const isActive = role.key === selectedMember?.role;
                      return (
                        <button
                          key={role.key}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleChangeRole(role.key);
                          }}
                          disabled={!selectedMember || !canManageMembers}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                            isActive
                              ? 'border-blue-300 bg-blue-50 text-blue-600'
                              : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {canManageMembers && (
                <button
                  type="button"
                  onClick={handleRemoveMember}
                  disabled={!selectedMember || !canRemoveSelectedMember}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={!canRemoveSelectedMember && selectedMemberIsAdmin ? 'Los gestores no pueden remover administradores del proyecto' : undefined}
                >
                  Sacar del proyecto
                </button>
              )}
            </section>
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
                  onLogout?.();
                }}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Añadir miembro al proyecto</h2>
                <p className="text-xs text-slate-500">
                  Selecciona un usuario existente de la base de datos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setNewMemberForm({ role: 'employee', usuarioId: undefined });
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitNewMember} className="space-y-4">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Usuario
                <select
                  value={newMemberForm.usuarioId || ''}
                  onChange={(event) => {
                    setNewMemberForm((prev) => ({
                      ...prev,
                      usuarioId: event.target.value || undefined,
                    }));
                  }}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                >
                  <option value="">Selecciona un usuario...</option>
                  {usuarios.length === 0 ? (
                    <option value="" disabled>Cargando usuarios...</option>
                  ) : (
                    usuarios
                      .filter(u => !members.some(m => m.id === u.id)) // Excluir usuarios que ya son miembros
                      .map((usuario) => (
                        <option key={usuario.id} value={usuario.id}>
                          {usuario.name} ({usuario.email})
                        </option>
                      ))
                  )}
                </select>
                {usuarios.length > 0 && usuarios.filter(u => !members.some(m => m.id === u.id)).length === 0 && (
                  <p className="text-xs text-slate-400 italic">Todos los usuarios ya son miembros del proyecto</p>
                )}
                {usuarios.length === 0 && (
                  <p className="text-xs text-amber-600 italic">No se pudieron cargar los usuarios. Verifica que tengas permisos para gestionar miembros.</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rol en el proyecto
                <select
                  value={newMemberForm.role}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, role: event.target.value as RoleKey }))
                  }
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {ROLES.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setNewMemberForm({ role: 'employee', usuarioId: undefined });
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                  disabled={isAddingMember}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAddingMember}
                  className="rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAddingMember ? 'Añadiendo...' : 'Añadir miembro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuccessModal && successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{successMessage.title}</h2>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <p>{successMessage.message}</p>
                {successMessage.password && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Contraseña por defecto:</p>
                    <p className="mt-1 font-mono text-base font-bold text-blue-900">{successMessage.password}</p>
                    <p className="mt-2 text-xs text-blue-600">El usuario puede iniciar sesión con esta contraseña y cambiarla desde su perfil.</p>
                  </div>
                )}
              </div>
            </header>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage(null);
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProjectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Eliminar proyecto</h2>
              <p className="mt-2 text-sm text-slate-500">
                ¿Estás seguro de que deseas eliminar el proyecto <span className="font-semibold text-slate-900">{project?.name}</span>? Esta acción no se puede deshacer y se perderán todos los datos asociados al proyecto.
              </p>
            </header>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteProjectConfirm(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Eliminar proyecto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPage;
