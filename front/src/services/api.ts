/**
 * Servicio centralizado para todas las llamadas a la API del backend
 */

// Configuración de la URL del backend
// En producción, usar la variable de entorno REACT_APP_API_URL si está definida
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// API_URL configurada

/**
 * Obtiene el token de autenticación del localStorage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem("token");
};

/**
 * Realiza una petición HTTP con manejo de errores
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Construir la URL: si API_URL está vacío, usar ruta relativa (proxy)
  // Si tiene valor, usar esa URL completa
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Leer el cuerpo de la respuesta una sola vez
    let errorData: any = {};
    try {
      const responseText = await response.text();
      if (responseText) {
        errorData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Error parseando respuesta de error:', parseError);
    }
    
    const error = new Error(errorData.message || errorData.error || `Error: ${response.statusText}`);
    
    // Preservar detalles de validación si existen
    if (errorData.details) {
      (error as any).details = errorData.details;
    }
    
    // Preservar el mensaje de error original
    if (errorData.error) {
      (error as any).error = errorData.error;
    }
    
    // Si es un error 401 (no autorizado) o 403 relacionado con autenticación (token expirado/inválido), limpiar el token
    // PERO NO redirigir si estamos en la página de login (evitar loop infinito)
    const errorMsg = (errorData.error && typeof errorData.error === 'string') ? errorData.error.toLowerCase() : '';
    const messageMsg = (errorData.message && typeof errorData.message === 'string') ? errorData.message.toLowerCase() : '';
    const isAuthError = response.status === 401 || 
      (response.status === 403 && (
        errorMsg.includes('token') ||
        messageMsg.includes('token') ||
        errorMsg.includes('expirado') ||
        messageMsg.includes('expirado') ||
        errorMsg.includes('inválido') ||
        errorMsg.includes('invalido') ||
        messageMsg.includes('inválido') ||
        messageMsg.includes('invalido') ||
        messageMsg.includes('asegúrate de haber iniciado sesión') ||
        messageMsg.includes('asegurate de haber iniciado sesion')
      ));
    
    if (isAuthError) {
      localStorage.removeItem('token');
      // Solo redirigir si NO estamos en la página de login
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && window.location.pathname !== '/') {
        window.location.href = '/';
      }
      // Marcar el error como de autenticación para que el llamador pueda manejarlo silenciosamente
      (error as any).isAuthError = true;
    }
    
    // Si es un error 429 (rate limit), agregar retryAfter al error
    if (response.status === 429 && errorData.retryAfter) {
      (error as any).retryAfter = errorData.retryAfter;
      (error as any).isRateLimit = true;
    }
    
    throw error;
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Error parseando JSON:', parseError);
    throw new Error('Error al parsear la respuesta del servidor');
  }
}

// ==================== AUTENTICACIÓN ====================

export interface LoginCredentials {
  email: string;
  contraseña: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: number | string;
    name?: string;
    nombre?: string;
    nombreCompleto?: string;
    email: string;
    initials?: string;
    rol?: string;
    fotoPerfil?: string | null;
  };
}

/**
 * Inicia sesión con email y contraseña
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: credentials.email,
      contraseña: credentials.contraseña,
    }),
  });
}

/**
 * Solicita recuperación de contraseña por email
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Cambia la contraseña (requiere autenticación)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/auth/password-change", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
}

/**
 * Cambia la contraseña con token de recuperación (sin autenticación)
 */
export async function resetPassword(
  token: string,
  contraseña: string,
  confirmarContraseña: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, contraseña, confirmarContraseña }),
  });
}

// ==================== PROYECTOS ====================

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface SidebarProject {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  ownerId?: string; // ID del usuario responsable/gestor
  team?: string;
  startDate?: string;
  endDate?: string;
  status?: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
}

/**
 * Obtiene la lista de proyectos del usuario
 */
export async function getProjects(): Promise<SidebarProject[]> {
  // Solicitar un límite alto (100 es el máximo) para obtener todos los proyectos disponibles
  // Esto asegura que todos los proyectos aparezcan en el sidebar, incluyendo los recién creados
  const response = await apiRequest<{ proyectos: any[]; paginacion: any }>("/api/proyectos?limite=100");
  // El backend devuelve { proyectos: [...], paginacion: {...} }
  const proyectos = Array.isArray(response) ? response : (response.proyectos || []);
  
  // Mapear proyectos del backend al formato SidebarProject
  return proyectos.map((proyecto: any) => ({
    id: proyecto.id.toString(),
    name: proyecto.nombre,
    description: proyecto.descripcion || undefined,
    owner: proyecto.responsable || undefined,
    team: proyecto.equipo || undefined,
    startDate: proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toISOString().split('T')[0] : undefined,
    endDate: proyecto.fecha_fin ? new Date(proyecto.fecha_fin).toISOString().split('T')[0] : undefined,
    status: 'En progreso' as const, // Por defecto, se puede calcular basado en fechas si es necesario
  }));
}

/**
 * Interfaz para crear un proyecto
 */
export interface CreateProjectData {
  nombre: string;
  descripcion?: string | null;
  responsable: string;
  equipo: string;
  fecha_inicio: string; // Formato ISO date string (YYYY-MM-DD)
  fecha_fin?: string | null; // Formato ISO date string (YYYY-MM-DD)
  gestorId: number;
}

/**
 * Crea un nuevo proyecto
 */
export async function createProject(data: CreateProjectData): Promise<{ message: string; proyecto: any }> {
  return apiRequest<{ message: string; proyecto: any }>('/api/proyectos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Elimina un proyecto
 */
export async function deleteProject(projectId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/proyectos/${projectId}`, {
    method: 'DELETE',
  });
}

/**
 * Obtiene un proyecto por ID
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await apiRequest<{ proyecto: any }>(`/api/proyectos/${projectId}`);
  const proyecto = response.proyecto || response;
  
  // Mapear proyecto del backend al formato del frontend
  return {
    id: proyecto.id.toString(),
    name: proyecto.nombre,
    description: proyecto.descripcion,
    color: proyecto.color || undefined,
  };
}

/**
 * Obtiene un proyecto completo por ID (con todos los datos)
 */
export async function getProjectFull(projectId: string): Promise<{
  id: number;
  nombre: string;
  descripcion: string | null;
  responsable: string;
  equipo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  gestorId: number;
}> {
  const response = await apiRequest<{ proyecto: any }>(`/api/proyectos/${projectId}`);
  const proyecto = response.proyecto || response;
  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion,
    responsable: proyecto.responsable,
    equipo: proyecto.equipo,
    fecha_inicio: proyecto.fecha_inicio,
    fecha_fin: proyecto.fecha_fin,
    gestorId: proyecto.gestorId,
  };
}

/**
 * Actualiza un proyecto
 */
export interface UpdateProjectData {
  nombre?: string;
  descripcion?: string | null;
  responsable?: string;
  equipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  gestorId?: number;
}

export async function updateProject(projectId: string, data: UpdateProjectData): Promise<{ message: string; proyecto: any }> {
  return apiRequest<{ message: string; proyecto: any }>(`/api/proyectos/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== USUARIOS ====================

export interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
  initials?: string;
}

/**
 * Obtiene la lista de usuarios (solo para administradores y gestores)
 */
export async function getUsuarios(): Promise<{ usuarios: Usuario[] }> {
  return apiRequest<{ usuarios: Usuario[] }>('/api/auth/usuarios');
}

/**
 * Crea un nuevo usuario (solo para administradores)
 */
export interface CreateUsuarioData {
  nombreCompleto: string;
  email: string;
  rol?: 'Administrador' | 'Empleado';
  contraseña?: string;
}

export async function createUsuario(data: CreateUsuarioData): Promise<{ 
  message: string; 
  usuario: Usuario;
  contraseñaTemporal?: string;
}> {
  return apiRequest<{ message: string; usuario: Usuario; contraseñaTemporal?: string }>('/api/auth/usuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Elimina un usuario (solo para administradores)
 */
export async function deleteUsuario(usuarioId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/auth/usuarios/${usuarioId}`, {
    method: 'DELETE',
  });
}

/**
 * Obtiene los miembros de un proyecto
 */
export interface MiembroProyecto {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  lastActivity?: string;
  esCreador?: boolean;
  esGestor?: boolean;
  fotoPerfil?: string | null;
  // El rol global del usuario ya no se incluye porque no influye en el rol del proyecto
}

export async function getMiembrosProyecto(projectId: string): Promise<{ miembros: MiembroProyecto[]; proyecto: { id: number; nombre: string } }> {
  return apiRequest<{ miembros: MiembroProyecto[]; proyecto: { id: number; nombre: string } }>(`/api/proyectos/${projectId}/miembros`);
}

/**
 * Cambia el rol de un miembro del proyecto
 */
export async function cambiarRolMiembro(
  projectId: string,
  usuarioId: string,
  rol: 'administrator' | 'project-manager' | 'employee',
  nuevoGestorId?: string
): Promise<{ message: string; miembro: { id: string; rol: string } }> {
  const body: { rol: string; nuevoGestorId?: string } = { rol };
  if (nuevoGestorId) {
    body.nuevoGestorId = nuevoGestorId;
  }
  try {
    const resultado = await apiRequest<{ message: string; miembro: { id: string; rol: string } }>(
      `/api/proyectos/${projectId}/miembros/${usuarioId}/rol`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );
    return resultado;
  } catch (error) {
    console.error('cambiarRolMiembro - Error en la llamada:', error);
    throw error;
  }
}

/**
 * Cambia el gestor del proyecto directamente
 */
export async function cambiarGestorProyecto(
  projectId: string,
  nuevoGestorId: string
): Promise<{ message: string; proyecto: { id: number; gestorId: number; responsable: string } }> {
  return apiRequest<{ message: string; proyecto: { id: number; gestorId: number; responsable: string } }>(
    `/api/proyectos/${projectId}/gestor`,
    {
      method: 'PATCH',
      body: JSON.stringify({ nuevoGestorId }),
    }
  );
}

/**
 * Remueve un miembro del proyecto
 */
export async function removerMiembroProyecto(
  projectId: string,
  usuarioId: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/api/proyectos/${projectId}/miembros/${usuarioId}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Agrega un miembro al proyecto
 */
export async function agregarMiembroProyecto(
  projectId: string,
  usuarioId: string,
  rol: 'administrator' | 'project-manager' | 'employee'
): Promise<{ message: string; miembro: { id: string } }> {
  return apiRequest<{ message: string; miembro: { id: string } }>(
    `/api/proyectos/${projectId}/miembros`,
    {
      method: 'POST',
      body: JSON.stringify({ usuarioId, rol }),
    }
  );
}

/**
 * Permite que el usuario actual salga del proyecto
 */
export async function salirDelProyecto(projectId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/api/proyectos/${projectId}/salir`,
    {
      method: 'POST',
    }
  );
}

// ==================== ESTADÍSTICAS / REPORTS ====================

export interface EstadisticasProyecto {
  proyecto: {
    id: number;
    nombre: string;
  };
  estadisticas: {
    tareas: {
      total: number;
      porEstado: Array<{ estado: string; cantidad: number }>;
      porPrioridad: Array<{ prioridad: string; cantidad: number }>;
      vencidas: number;
      porVencer: number;
    };
    comentarios: {
      total: number;
    };
    usuarios: {
      involucrados: number;
    };
  };
  fechaConsulta: string;
}

export async function getEstadisticasProyecto(projectId: string): Promise<EstadisticasProyecto> {
  return apiRequest<EstadisticasProyecto>(`/api/estadisticas/proyecto/${projectId}`);
}

// ==================== RELEASES ====================

export interface ReleaseRow {
  id: string;
  version: string;
  status: 'En progreso' | 'Sin lanzar' | 'Publicado';
  progress: Array<{ title: string; value: number; colorClass: string }>;
  startDate: string;
  releaseDate: string;
  description: string;
}

export interface TimelineItem {
  id: string;
  label: string;
  type: 'release' | 'sprint';
  status: 'En progreso' | 'Completado' | 'Pendiente';
  start: number;
  end: number;
  accent: string;
  backendId?: string;
  backendType?: 'release' | 'sprint';
}

export interface TimelineColumn {
  id: string;
  label: string;
  secondaryLabel?: string;
  date?: string; // ISO date string para identificar la semana actual
}

export interface ReleasesPageData {
  releases: ReleaseRow[];
  timelineItems: TimelineItem[];
  timelineColumns: TimelineColumn[];
  fechaInicio: string;
  fechaFin: string;
}

export async function getReleasesPageData(projectId: string): Promise<ReleasesPageData> {
  return apiRequest<ReleasesPageData>(`/api/releases/page/${projectId}`);
}

export interface CreateReleaseData {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string; // ISO date string
  fecha_lanzamiento: string; // ISO date string
  estado?: 'En_progreso' | 'Sin_lanzar' | 'Publicado';
  proyectoId: number;
  estadoFrontend?: 'En progreso' | 'Sin lanzar' | 'Publicado';
}

export interface UpdateReleaseData {
  nombre?: string;
  descripcion?: string | null;
  fecha_inicio?: string; // ISO date string
  fecha_lanzamiento?: string; // ISO date string
  estado?: 'En_progreso' | 'Sin_lanzar' | 'Publicado';
  proyectoId?: number;
  estadoFrontend?: 'En progreso' | 'Sin lanzar' | 'Publicado';
}

export interface ReleaseResponse {
  release: {
    id: number;
    nombre: string;
    descripcion: string | null;
    fecha_inicio: string;
    fecha_lanzamiento: string;
    estado: string;
    proyectoId: number;
  };
}

export async function createRelease(data: CreateReleaseData): Promise<ReleaseResponse> {
  return apiRequest<ReleaseResponse>('/api/releases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRelease(releaseId: string, data: UpdateReleaseData): Promise<ReleaseResponse> {
  return apiRequest<ReleaseResponse>(`/api/releases/${releaseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRelease(releaseId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/releases/${releaseId}`, {
    method: 'DELETE',
  });
}

// ==================== SPRINTS ====================

export interface CreateSprintData {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string; // ISO date string
  fecha_fin: string; // ISO date string
  estado?: 'Pendiente' | 'En_progreso' | 'Completado';
  proyectoId: number;
}

export interface UpdateSprintData {
  nombre?: string;
  descripcion?: string | null;
  fecha_inicio?: string; // ISO date string
  fecha_fin?: string; // ISO date string
  estado?: 'Pendiente' | 'En_progreso' | 'Completado';
  proyectoId?: number;
}

export interface SprintResponse {
  sprint: {
    id: number;
    nombre: string;
    descripcion: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    proyectoId: number;
  };
}

export async function createSprint(data: CreateSprintData): Promise<SprintResponse> {
  return apiRequest<SprintResponse>('/api/sprints', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSprint(sprintId: string, data: UpdateSprintData): Promise<SprintResponse> {
  return apiRequest<SprintResponse>(`/api/sprints/${sprintId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSprint(sprintId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/sprints/${sprintId}`, {
    method: 'DELETE',
  });
}

export interface CalculateTimelineDatesData {
  startColumn: number;
  endColumn: number;
}

export interface CalculateTimelineDatesResponse {
  fechaInicio: string;
  fechaFin: string;
}

export async function calculateTimelineDates(
  projectId: string,
  data: CalculateTimelineDatesData
): Promise<CalculateTimelineDatesResponse> {
  return apiRequest<CalculateTimelineDatesResponse>(`/api/releases/timeline/${projectId}/calcular-fechas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== COMPONENTS ====================

export interface Componente {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  tags: string[];
  preview: string | null;
  archivo: string | null;
  proyectoId: number;
  creadoPorId: number;
  createdAt: string;
  updatedAt: string;
  proyecto?: {
    id: number;
    nombre: string;
  };
  creadoPor?: {
    id: number;
    nombreCompleto: string;
    email: string;
  };
}

export interface ComponentesResponse {
  componentes: Componente[];
  paginacion: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
  filtros: {
    proyectoId: number | null;
    categoria: string | null;
    busqueda: string | null;
  };
}

export async function getComponentes(projectId?: string, categoria?: string, busqueda?: string): Promise<ComponentesResponse> {
  const params = new URLSearchParams();
  if (projectId) params.append('proyectoId', projectId);
  if (categoria) params.append('categoria', categoria);
  if (busqueda) params.append('busqueda', busqueda);
  params.append('limite', '100'); // Obtener todos los componentes
  
  const queryString = params.toString();
  return apiRequest<ComponentesResponse>(`/api/componentes${queryString ? `?${queryString}` : ''}`);
}

export interface CreateComponenteData {
  nombre: string;
  descripcion?: string;
  categoria: 'logos' | 'iconos' | 'ilustraciones' | 'fondos';
  preview?: string;
  tags?: string[];
  proyectoId?: number;
  archivo?: File | Blob;
}

/**
 * Crea un nuevo componente
 */
export async function createComponente(data: CreateComponenteData): Promise<{ message: string; componente: Componente }> {
  const token = getAuthToken();
  
  // Si hay archivo, usar FormData
  if (data.archivo) {
    const formData = new FormData();
    formData.append('archivo', data.archivo);
    formData.append('nombre', data.nombre);
    if (data.descripcion) formData.append('descripcion', data.descripcion);
    formData.append('categoria', data.categoria);
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }
    if (data.proyectoId) {
      formData.append('proyectoId', data.proyectoId.toString());
    }

    const url = `${API_URL}/api/componentes`;
    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || errorData.error || `Error: ${response.statusText}`);
      throw error;
    }

    return response.json();
  } else {
    // Si no hay archivo, usar JSON
    return apiRequest<{ message: string; componente: Componente }>('/api/componentes', {
      method: 'POST',
      body: JSON.stringify({
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoria: data.categoria,
        preview: data.preview || null,
        tags: data.tags || [],
        proyectoId: data.proyectoId || null,
      }),
    });
  }
}

/**
 * Elimina un componente
 */
export async function deleteComponente(componenteId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/componentes/${componenteId}`, {
    method: 'DELETE',
  });
}

// ==================== ACTIVIDADES / BACKLOGS ====================

export interface Actividad {
  id: number;
  accion: string;
  entidad: string;
  entidadId: number;
  usuarioId: number;
  descripcion: string;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  createdAt: string;
  usuario?: {
    id: number;
    nombreCompleto: string;
    email: string;
  };
  // Campos procesados por el backend para el backlog
  backlogAction?: string;
  from?: string;
  to?: string;
  taskTitle?: string;
}

export interface ActividadesResponse {
  actividades: Actividad[];
  paginacion: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
}

export async function getActividades(entidad?: string, usuarioId?: string, pagina: number = 1, limite: number = 50): Promise<ActividadesResponse> {
  const params = new URLSearchParams();
  if (entidad) params.append('entidad', entidad);
  if (usuarioId) params.append('usuarioId', usuarioId);
  params.append('pagina', pagina.toString());
  params.append('limite', limite.toString());
  
  return apiRequest<ActividadesResponse>(`/api/actividad?${params.toString()}`);
}

export interface ActividadesProyectoResponse {
  actividades: Actividad[];
  paginacion: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
  proyecto: {
    id: number;
    nombre: string;
  };
  filtros: {
    fechaInicio: string | null;
    fechaFin: string | null;
  };
}

export async function getActividadesProyecto(projectId: string, pagina: number = 1, limite: number = 200): Promise<ActividadesProyectoResponse> {
  const params = new URLSearchParams();
  params.append('pagina', pagina.toString());
  params.append('limite', limite.toString());
  
  // Cambiado a /de-proyecto/ para evitar conflicto con /:entidad/:id
  return apiRequest<ActividadesProyectoResponse>(`/api/actividad/de-proyecto/${projectId}?${params.toString()}`);
}

// ==================== ISSUES (usando tareas) ====================

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: 'Bug' | 'Mejora' | 'Idea' | 'Pregunta';
  status: 'Abierto' | 'En revisión' | 'Asignado' | 'Resuelto';
  priority: 'Alta' | 'Media' | 'Baja';
  reporter: string;
  createdAt: string;
  assignee?: string;
}

// Los issues se obtendrán de las tareas con un filtro especial
// Por ahora usaremos las tareas del proyecto y las mapearemos a issues

// ==================== TAREAS (BOARD) ====================

export interface BoardTask {
  id: string;
  title: string;
  description?: string;
  status: string; // 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'Alta' | 'Media' | 'Baja';
  owner?: string;
  assigneeId?: string;
  asignado_a?: string; // Nombre del usuario asignado (para enviar al backend)
  projectId: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  labels?: string[];
  attachments?: Array<{ id: string; name: string; size: number; url: string }>;
  createdById?: string; // ID del usuario que creó la tarea
  projectManagerId?: string; // ID del gestor del proyecto
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority: 'Alta' | 'Media' | 'Baja';
  projectId: string;
  assigneeId?: string;
  dueDate?: string;
}

/**
 * Interfaz para tarea formateada del Kanban (viene del backend)
 */
export interface KanbanTaskItem {
  id: string;
  title: string;
  description: string;
  owner: string;
  avatar: string;
  due: string;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
  priority: 'Alta' | 'Media' | 'Baja';
  createdAt: string;
  updatedAt: string;
  assigneeId?: string;
  projectId: string;
  dueDate: string | null;
  createdById?: string;
  projectManagerId?: string;
  labels?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    url: string;
  }>;
}

/**
 * Obtiene todas las tareas de un proyecto organizadas por columna (vista Kanban)
 * El backend devuelve los datos completamente formateados, sin necesidad de transformaciones
 */
export async function getProjectTasks(projectId: string): Promise<Record<string, KanbanTaskItem[]>> {
  const response = await apiRequest<{ 
    kanban: Record<string, KanbanTaskItem[]>;
    resumen: any;
    filtros: any;
  }>(`/api/tareas/kanban?proyectoId=${projectId}`);
  
  // El backend ya devuelve los datos completamente formateados
  return response.kanban || {
    'pending': [],
    'in-progress': [],
    'review': [],
    'done': [],
  };
}

/**
 * Crea una nueva tarea
 */
export async function createTask(data: CreateTaskData): Promise<BoardTask> {
  // Validar y convertir proyectoId
  const proyectoId = typeof data.projectId === 'string' 
    ? parseInt(data.projectId, 10) 
    : Number(data.projectId);
  
  if (isNaN(proyectoId) || proyectoId <= 0) {
    throw new Error('ID de proyecto inválido');
  }
  
  // Mapear campos del frontend al formato del backend
  const backendData: any = {
    titulo: data.title,
    descripcion: data.description || null,
    prioridad: data.priority,
    proyectoId: proyectoId,
    estado: 'Pendiente', // Valor por defecto
  };
  
  // Manejar asignación: solo incluir usuarioId si hay un usuario asignado
  // Si no hay asignado, no enviar el campo (el backend lo manejará como null)
  if (data.assigneeId && typeof data.assigneeId === 'string' && data.assigneeId.trim() !== '') {
    const usuarioId = parseInt(data.assigneeId, 10);
    if (!isNaN(usuarioId) && usuarioId > 0) {
      backendData.usuarioId = usuarioId;
      // asignado_a será establecido por el backend basándose en usuarioId
    }
    // Si el usuarioId no es válido, no incluirlo (el backend lo manejará como null)
  }
  // Si no hay assigneeId, no incluir usuarioId en absoluto
  
  // Fecha límite solo si está presente
  if (data.dueDate) {
    backendData.fecha_limite = data.dueDate;
  }
  
  const response = await apiRequest<{ tarea: any }>("/api/tareas", {
    method: "POST",
    body: JSON.stringify(backendData),
  });
  
  const tarea = response.tarea || response;
  
  // Mapear respuesta del backend al formato del frontend
  return {
    id: tarea.id.toString(),
    title: tarea.titulo,
    description: tarea.descripcion,
    status: tarea.estado,
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    owner: tarea.asignado_a,
    assigneeId: tarea.usuarioId?.toString(),
    projectId: tarea.proyectoId.toString(),
    dueDate: tarea.fecha_limite,
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt,
  };
}

export async function canEditTask(taskId: string): Promise<boolean> {
  const numericId = taskId.startsWith('KB-') ? taskId.replace('KB-', '') : taskId;
  try {
    const response = await apiRequest<{ puedeEditar: boolean }>(`/api/tareas/${numericId}/permisos`);
    return response.puedeEditar || false;
  } catch (error: any) {
    console.error('Error verificando permisos de edición:', error);
    return false;
  }
}

export async function updateTask(taskId: string, updates: Partial<BoardTask>): Promise<BoardTask> {
  // Mapear campos del frontend al formato del backend
  const backendUpdates: any = {};
  if (updates.title !== undefined) backendUpdates.titulo = updates.title;
  if (updates.description !== undefined) backendUpdates.descripcion = updates.description;
  if (updates.priority !== undefined) backendUpdates.prioridad = updates.priority;
  
  // Mapear estados del frontend al formato del backend
  if (updates.status !== undefined) {
    const estadoMap: Record<string, string> = {
      'todo': 'Pendiente',
      'in-progress': 'En_progreso',
      'review': 'En_revision',
      'done': 'Completado',
      'Pendiente': 'Pendiente',
      'En progreso': 'En_progreso',
      'En revisión': 'En_revision',
      'Completado': 'Completado',
    };
    backendUpdates.estado = estadoMap[updates.status] || updates.status;
  }
  
  if (updates.projectId !== undefined) backendUpdates.proyectoId = parseInt(updates.projectId);
  
  // Manejar asignado: el backend buscará el usuarioId por nombre
  // Si viene asignado_a, el backend lo procesará y buscará el usuarioId correspondiente
  if (updates.asignado_a !== undefined) {
    backendUpdates.asignado_a = updates.asignado_a;
  }
  
  // Mantener compatibilidad con el enfoque antiguo (assigneeId)
  // Si viene assigneeId, también se procesará (pero asignado_a tiene prioridad)
  if (updates.assigneeId !== undefined && updates.asignado_a === undefined) {
    backendUpdates.usuarioId = updates.assigneeId ? parseInt(updates.assigneeId) : null;
  }
  
  // Convertir fecha_limite al formato ISO 8601 datetime que espera el backend
  if (updates.dueDate !== undefined) {
    if (updates.dueDate && updates.dueDate.trim() !== '') {
      try {
        // Si es solo fecha (YYYY-MM-DD), convertir a datetime ISO completo
        const dateStr = updates.dueDate.trim();
        let date: Date;
        
        // Si no tiene hora, agregar medianoche UTC
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          date = new Date(dateStr + 'T00:00:00.000Z');
        } else {
          date = new Date(dateStr);
        }
        
        // Validar que sea una fecha válida
        if (!isNaN(date.getTime())) {
          backendUpdates.fecha_limite = date.toISOString();
        } else {
          backendUpdates.fecha_limite = null;
        }
      } catch (error) {
        console.error('Error al convertir fecha:', error);
        backendUpdates.fecha_limite = null;
      }
    } else {
      backendUpdates.fecha_limite = null;
    }
  }
  
  const response = await apiRequest<{ tarea: any }>(`/api/tareas/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(backendUpdates),
  });
  
  const tarea = response.tarea || response;
  
  // Mapear respuesta del backend al formato del frontend
  return {
    id: tarea.id.toString(),
    title: tarea.titulo,
    description: tarea.descripcion,
    status: tarea.estado,
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    owner: tarea.asignado_a,
    assigneeId: tarea.usuarioId?.toString(),
    projectId: tarea.proyectoId.toString(),
    dueDate: tarea.fecha_limite,
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt,
  };
}

/**
 * Mapea IDs de columna del frontend a estados del backend
 */
const columnIdToEstado: Record<string, string> = {
  'pending': 'Pendiente',
  'in-progress': 'En_progreso',
  'review': 'En_revision',
  'done': 'Completado',
  // Mantener compatibilidad con estados directos
  'Pendiente': 'Pendiente',
  'En progreso': 'En_progreso',
  'En revisión': 'En_revision',
  'Completado': 'Completado',
};

/**
 * Mueve una tarea a otra columna (cambia el estado)
 * Puede recibir un ID de columna (pending, in-progress, etc.) o un estado directo
 */
export async function moveTask(
  taskId: string,
  columnIdOrStatus: string,
  newPosition?: number
): Promise<BoardTask> {
  // Mapear ID de columna o estado al formato del backend
  const estadoBackend = columnIdToEstado[columnIdOrStatus] || columnIdOrStatus;
  
  const response = await apiRequest<{ tarea: any }>(`/api/tareas/${taskId}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado: estadoBackend }),
  });
  
  const tarea = response.tarea || response;
  
  // Mapear respuesta del backend al formato del frontend
  return {
    id: tarea.id.toString(),
    title: tarea.titulo,
    description: tarea.descripcion,
    status: tarea.estado,
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    owner: tarea.asignado_a,
    assigneeId: tarea.usuarioId?.toString(),
    projectId: tarea.proyectoId.toString(),
    dueDate: tarea.fecha_limite,
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt,
  };
}

/**
 * Elimina una tarea
 */
export async function deleteTask(taskId: string): Promise<void> {
  return apiRequest<void>(`/api/tareas/${taskId}`, {
    method: "DELETE",
  });
}

/**
 * Autoasigna una tarea al usuario actual
 */
export async function autoAssignTask(taskId: string): Promise<BoardTask> {
  const response = await apiRequest<{ tarea: any }>(`/api/tareas/${taskId}/asignar`, {
    method: "PATCH",
  });
  
  const tarea = response.tarea || response;
  
  // Mapear respuesta del backend al formato del frontend
  return {
    id: tarea.id.toString(),
    title: tarea.titulo,
    description: tarea.descripcion,
    status: tarea.estado,
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    owner: tarea.asignado_a,
    assigneeId: tarea.usuarioId?.toString(),
    projectId: tarea.proyectoId.toString(),
    dueDate: tarea.fecha_limite,
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt,
    labels: tarea.etiquetas?.map((e: any) => e.nombre || e) || [],
  };
}

// ==================== ISSUES ====================

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: 'Bug' | 'Mejora' | 'Idea' | 'Pregunta';
  status: 'Abierto' | 'En revisión' | 'Asignado' | 'Resuelto';
  priority: 'Alta' | 'Media' | 'Baja';
  reporter: string;
  reporterId: string;
  createdAt: string;
  assignee?: string;
  assigneeId?: string;
  projectId?: string;
}

export interface CreateIssueData {
  title: string;
  description: string;
  category: Issue['category'];
  priority: Issue['priority'];
  projectId?: string;
}

/**
 * Obtiene los issues de un proyecto
 * Nota: Los "issues" pueden ser tareas con estado específico o usar el endpoint de tareas
 */
export async function getIssues(projectId: string): Promise<Issue[]> {
  try {
    const response = await apiRequest<{ issues: Issue[] }>(`/api/issues?proyectoId=${projectId}`);
    return response.issues || [];
  } catch (error) {
    console.error('Error obteniendo issues:', error);
    return [];
  }
}

/**
 * Crea un nuevo issue
 */
export async function createIssue(data: CreateIssueData): Promise<{ message: string; issue: Issue }> {
  return apiRequest<{ message: string; issue: Issue }>('/api/issues', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualiza el estado de un issue
 */
export async function updateIssueStatus(issueId: string, status: Issue['status']): Promise<{ message: string; issue: Issue }> {
  return apiRequest<{ message: string; issue: Issue }>(`/api/issues/${issueId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: status }),
  });
}

/**
 * Actualiza un issue (actualiza la tarea correspondiente)
 */
export async function updateIssue(issueId: string, updates: Partial<Issue>): Promise<Issue> {
  const taskUpdates: any = {};
  if (updates.status) {
    // Cambiar estado de la tarea
    await moveTask(issueId, updates.status);
  }
  if (updates.title || updates.description || updates.priority) {
    taskUpdates.titulo = updates.title;
    taskUpdates.descripcion = updates.description;
    taskUpdates.prioridad = updates.priority;
    await updateTask(issueId, taskUpdates);
  }
  
  // Obtener la tarea actualizada
  const tarea = await apiRequest<any>(`/api/tareas/${issueId}`);
  return {
    id: tarea.id.toString(),
    title: tarea.titulo || '',
    description: tarea.descripcion || '',
    category: updates.category || 'Bug' as any,
    status: tarea.estado || updates.status || 'Abierto' as any,
    priority: tarea.prioridad || updates.priority || 'Media' as any,
    reporter: tarea.creador?.nombreCompleto || 'Usuario',
    reporterId: tarea.creadorId?.toString() || '',
    createdAt: tarea.createdAt || new Date().toISOString(),
    assignee: tarea.responsable?.nombreCompleto,
    assigneeId: tarea.responsableId?.toString(),
    projectId: tarea.proyectoId?.toString(),
  };
}

// ==================== BACKLOGS ====================

export interface BacklogActivity {
  id: string;
  action: string;
  author: string;
  timestamp: string;
  description?: string;
  taskId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

/**
 * Obtiene las actividades del backlog de un proyecto
 * Usa el endpoint de actividades del backend
 */
export async function getBacklogActivities(projectId?: string): Promise<BacklogActivity[]> {
  try {
    // El endpoint de actividades requiere permisos de gestor/admin
    // Usar parámetros de query para filtrar por proyecto si está disponible
    const endpoint = projectId 
      ? `/api/actividad?entidad=Tarea&pagina=1&limite=100` 
      : "/api/actividad?pagina=1&limite=100";
    
    // El backend devuelve { actividades: [...], paginacion: {...} }
    const response = await apiRequest<{ 
      actividades: any[];
      paginacion: any;
    }>(endpoint);
    
    const actividades = response.actividades || [];
    
    // Filtrar por proyecto si se especifica
    let filtered = actividades;
    if (projectId) {
      filtered = actividades.filter((act: any) => 
        act.proyectoId?.toString() === projectId || 
        act.entidadId?.toString() === projectId
      );
    }
    
    // Mapear actividades del backend al formato esperado
    return filtered.map((act: any) => ({
      id: act.id?.toString() || '',
      action: act.accion || act.tipo || 'Actividad',
      author: act.usuario?.nombreCompleto || 'Usuario',
      timestamp: act.createdAt || new Date().toISOString(),
      description: act.descripcion || '',
      taskId: act.tareaId?.toString() || act.entidadId?.toString(),
      projectId: act.proyectoId?.toString(),
      from: act.valorAnterior,
      to: act.valorNuevo,
    }));
  } catch {
    // Si falla (por ejemplo, por permisos), retornar array vacío
    return [];
  }
}

// ==================== USUARIO ====================

export interface User {
  id: string;
  name: string;
  email: string;
  initials?: string;
  role?: string;
  fotoPerfil?: string | null;
}

export interface UserTask {
  id: string;
  title: string;
  projectName: string;
  projectId: string;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
  priority: 'Alta' | 'Media' | 'Baja';
  dueDate: string | null;
  createdById?: string; // ID del usuario que creó la tarea
  projectManagerId?: string; // ID del gestor del proyecto
  boardTaskRef?: {
    taskId: string;
    columnId?: string;
  };
}

export interface UserStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  inReview: number;
  progressPercent: number;
  byProject: Record<string, number>;
}

/**
 * Obtiene el perfil del usuario actual
 */
export async function getCurrentUser(): Promise<User & { nombreCompleto?: string; rol?: string }> {
  const response = await apiRequest<any>("/api/auth/me");
  // El backend devuelve el usuario directamente con las iniciales ya calculadas
  const user = response.user || response;
  
  const nombreCompleto = user.nombreCompleto || user.name || '';
  
  return {
    id: user.id?.toString() || '',
    name: nombreCompleto,
    email: user.email || '',
    initials: user.initials || 'U',
    role: user.rol || user.role || '',
    nombreCompleto: nombreCompleto,
    rol: user.rol,
    fotoPerfil: user.fotoPerfil !== undefined ? user.fotoPerfil : null,
  };
}

/**
 * Actualiza el perfil del usuario actual
 */
export async function updateProfile(data: { nombreCompleto?: string; email?: string }): Promise<User & { nombreCompleto?: string; rol?: string }> {
  const response = await apiRequest<{ message: string; user: any }>("/api/auth/profile", {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  // El backend devuelve el usuario actualizado con las iniciales ya calculadas
  const user = response.user || response;
  
  return {
    id: user.id?.toString() || '',
    name: user.nombreCompleto || user.name || '',
    email: user.email || '',
    initials: user.initials || 'U', // Las iniciales vienen del backend, fallback solo si no vienen
    role: user.rol || user.role || '',
    nombreCompleto: user.nombreCompleto,
    rol: user.rol,
    fotoPerfil: user.fotoPerfil || null,
  };
}

/**
 * Sube una foto de perfil para el usuario actual
 */
export async function uploadProfilePhoto(file: File): Promise<User & { nombreCompleto?: string; rol?: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const formData = new FormData();
  formData.append('photo', file);

  const url = `${API_URL}/api/auth/profile/photo`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || errorData.error || `Error: ${response.statusText}`);
    throw error;
  }

  const data = await response.json();
  const user = data.user || data;
  
  return {
    id: user.id?.toString() || '',
    name: user.nombreCompleto || user.name || '',
    email: user.email || '',
    initials: user.initials || 'U',
    role: user.rol || user.role || '',
    nombreCompleto: user.nombreCompleto,
    rol: user.rol,
    fotoPerfil: user.fotoPerfil || null,
  };
}

/**
 * Obtiene las tareas asignadas al usuario actual (Mi trabajo)
 */
export async function getUserTasks(): Promise<UserTask[]> {
  const response = await apiRequest<{ tareas: any[] }>("/api/tareas/mi-trabajo");
  // El backend devuelve { tareas: [...], tareasPorEstado: {...}, ... }
  const tareas = Array.isArray(response) ? response : (response.tareas || []);
  
  // Mapear estado del backend al formato del frontend
  const statusMap: Record<string, 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado'> = {
    'Pendiente': 'Pendiente',
    'En_progreso': 'En progreso',
    'En_revision': 'En revisión',
    'Completado': 'Completado',
  };
  
  // Mapear tareas del backend al formato del frontend
  return tareas.map((tarea: any) => ({
    id: tarea.id.toString(),
    title: tarea.titulo,
    projectName: tarea.proyecto?.nombre || 'Sin proyecto',
    projectId: tarea.proyectoId.toString(),
    status: statusMap[tarea.estado] || 'Pendiente',
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    dueDate: tarea.fecha_limite || null, // Usar null en lugar de fecha de hoy para tareas sin fecha límite
    createdById: tarea.creadoPorId?.toString(),
    projectManagerId: tarea.proyecto?.gestorId?.toString(),
    boardTaskRef: {
      taskId: tarea.id.toString(),
      columnId: tarea.estado,
    },
  }));
}

/**
 * Obtiene las estadísticas del usuario actual
 */
export async function getUserStats(): Promise<UserStats> {
  try {
    // El backend devuelve { estadisticas: {...}, fechaConsulta: "..." }
    const response = await apiRequest<{ 
      estadisticas: UserStats;
      fechaConsulta: string;
    }>("/api/estadisticas/usuario");
    
    // Retornar solo la parte de estadísticas
    return response.estadisticas;
  } catch {
    // Fallback: calcular desde mi-trabajo si el endpoint falla
    const tasks = await getUserTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completado').length;
    const inProgress = tasks.filter(t => t.status === 'En progreso').length;
    const pending = tasks.filter(t => t.status === 'Pendiente').length;
    const inReview = tasks.filter(t => t.status === 'En revisión').length;
    
    return {
      total,
      completed,
      inProgress,
      pending,
      inReview,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      byProject: {},
    };
  }
}

// ==================== COMENTARIOS ====================

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

/**
 * Obtiene los comentarios de una tarea
 */
export async function getTaskComments(taskId: string): Promise<Comment[]> {
  const numericId = taskId.startsWith('KB-') ? taskId.replace('KB-', '') : taskId;
  const response = await apiRequest<{ comentarios: any[] }>(`/api/comentarios/tarea/${numericId}`);
  const comentarios = response.comentarios || [];
  
  // Mapear del formato del backend al formato del frontend
  return comentarios.map((c: any) => ({
    id: c.id.toString(),
    taskId: c.tareaId.toString(),
    userId: c.usuarioId?.toString() || '',
    userName: c.usuario?.nombreCompleto || 'Usuario',
    content: c.contenido,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));
}

/**
 * Crea un comentario en una tarea
 */
export async function createComment(taskId: string, content: string): Promise<Comment> {
  const numericId = taskId.startsWith('KB-') ? taskId.replace('KB-', '') : taskId;
  const response = await apiRequest<{ comentario: any }>("/api/comentarios", {
    method: "POST",
    body: JSON.stringify({ tareaId: parseInt(numericId), contenido: content }),
  });
  
  const c = response.comentario || response;
  return {
    id: c.id.toString(),
    taskId: c.tareaId.toString(),
    userId: c.usuarioId?.toString() || '',
    userName: c.usuario?.nombreCompleto || 'Usuario',
    content: c.contenido,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Actualiza un comentario
 */
export async function updateComment(commentId: string, content: string): Promise<Comment> {
  const numericId = commentId.startsWith('KB-') ? commentId.replace('KB-', '') : commentId;
  const response = await apiRequest<{ comentario: any }>(`/api/comentarios/${numericId}`, {
    method: "PUT",
    body: JSON.stringify({ contenido: content }),
  });
  
  const c = response.comentario || response;
  return {
    id: c.id.toString(),
    taskId: c.tareaId.toString(),
    userId: c.usuarioId?.toString() || '',
    userName: c.usuario?.nombreCompleto || 'Usuario',
    content: c.contenido,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Elimina un comentario
 */
export async function deleteComment(commentId: string): Promise<void> {
  const numericId = commentId.startsWith('KB-') ? commentId.replace('KB-', '') : commentId;
  await apiRequest(`/api/comentarios/${numericId}`, {
    method: "DELETE",
  });
}

// ==================== ARCHIVOS / ATTACHMENTS ====================

export interface Attachment {
  id: string;
  name: string;
  size: number;
  url: string;
  type?: string;
  createdAt?: string;
}

/**
 * Obtiene los archivos adjuntos de una tarea
 */
export async function getTaskAttachments(taskId: string): Promise<Attachment[]> {
  const numericId = taskId.startsWith('KB-') ? taskId.replace('KB-', '') : taskId;
  const response = await apiRequest<{ archivos: any[] }>(`/api/archivos/tarea/${numericId}`);
  const archivos = response.archivos || [];
  
  return archivos.map((a: any) => ({
    id: a.id.toString(),
    name: a.nombre,
    size: a.tamaño || 0,
    url: a.url,
    type: a.tipo,
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
  }));
}

/**
 * Sube un archivo a una tarea
 */
export async function uploadTaskFile(taskId: string, file: File): Promise<Attachment> {
  const numericId = taskId.startsWith('KB-') ? taskId.replace('KB-', '') : taskId;
  const token = getAuthToken();
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const formData = new FormData();
  formData.append('archivo', file);
  formData.append('tareaId', numericId);

  const url = `${API_URL}/api/archivos`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || errorData.error || `Error: ${response.statusText}`);
    if (errorData.details) {
      (error as any).details = errorData.details;
    }
    throw error;
  }

  const data = await response.json();
  const a = data.archivo || data;
  return {
    id: a.id.toString(),
    name: a.nombre,
    size: a.tamaño || 0,
    url: a.url,
    type: a.tipo,
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Elimina un archivo adjunto
 */
export async function deleteTaskFile(fileId: string): Promise<void> {
  const numericId = fileId.startsWith('KB-') ? fileId.replace('KB-', '') : fileId;
  await apiRequest(`/api/archivos/${numericId}`, {
    method: "DELETE",
  });
}

// ==================== ETIQUETAS / LABELS ====================

export interface Etiqueta {
  id: number;
  nombre: string;
  color: string | null;
}

/**
 * Obtiene todas las etiquetas
 */
export async function getEtiquetas(): Promise<Etiqueta[]> {
  const response = await apiRequest<{ etiquetas: Etiqueta[] }>('/api/etiquetas/todas');
  return response.etiquetas || [];
}

/**
 * Busca o crea etiquetas por nombre y devuelve sus IDs
 */
export async function buscarOCrearEtiquetas(nombres: any[]): Promise<number[]> {
  if (!Array.isArray(nombres) || nombres.length === 0) return [];
  
  try {
    // Normalizar nombres a strings
    const nombresNormalizados: string[] = nombres
      .map(n => {
        // Manejar diferentes tipos de datos
        if (typeof n === 'string') {
          return n.trim();
        }
        if (n && typeof n === 'object' && n.nombre) {
          // Si es un objeto con propiedad nombre (del backend)
          return String(n.nombre).trim();
        }
        // Convertir a string si es otro tipo
        return String(n || '').trim();
      })
      .filter(n => n !== ''); // Filtrar strings vacíos
    
    if (nombresNormalizados.length === 0) return [];
    
    // Obtener todas las etiquetas existentes
    const todasLasEtiquetas = await getEtiquetas();
    const etiquetasExistentes = new Map<string, number>();
    todasLasEtiquetas.forEach(et => {
      etiquetasExistentes.set(et.nombre.toLowerCase(), et.id);
    });
    
    const etiquetaIds: number[] = [];
    const etiquetasACrear: string[] = [];
    
    // Separar etiquetas existentes de las que hay que crear
    for (const nombre of nombresNormalizados) {
      const nombreLower = nombre.toLowerCase();
      if (nombreLower === '') continue;
      
      const idExistente = etiquetasExistentes.get(nombreLower);
      if (idExistente) {
        etiquetaIds.push(idExistente);
      } else {
        etiquetasACrear.push(nombre);
      }
    }
    
    // Crear etiquetas nuevas (si el usuario tiene permisos)
    for (const nombre of etiquetasACrear) {
      try {
        const nuevaEtiqueta = await apiRequest<{ etiqueta: Etiqueta }>('/api/etiquetas', {
          method: 'POST',
          body: JSON.stringify({ nombre }),
        });
        if (nuevaEtiqueta.etiqueta?.id) {
          etiquetaIds.push(nuevaEtiqueta.etiqueta.id);
        }
      } catch (error: any) {
        // Si no tiene permisos para crear o ya existe, intentar buscarla de nuevo
        // Etiqueta no se pudo crear (probablemente ya existe o sin permisos)
        // Intentar buscar por nombre exacto
        const encontrada = todasLasEtiquetas.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
        if (encontrada) {
          etiquetaIds.push(encontrada.id);
        }
      }
    }
    
    return etiquetaIds;
  } catch (error) {
    console.error('Error al buscar o crear etiquetas:', error);
    return [];
  }
}

/**
 * Asocia etiquetas a una tarea
 * Si el array está vacío, elimina todas las etiquetas asociadas
 */
export async function asociarEtiquetasATarea(taskId: string, etiquetaIds: number[]): Promise<void> {
  // Validar que los IDs sean números válidos
  const idsValidos = etiquetaIds.filter(id => typeof id === 'number' && id > 0);
  
  // Permitir array vacío para eliminar todas las etiquetas
  await apiRequest(`/api/etiquetas/tarea/${taskId}/asociar`, {
    method: 'POST',
    body: JSON.stringify({ etiquetaIds: idsValidos }),
  });
}

// ==================== NOTIFICACIONES ====================

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: string;
  timestamp: string;
  read: boolean;
  taskId?: string;
  projectId?: string;
  issueId?: string;
  tarea?: {
    id: number;
    titulo: string;
    estado: string;
    proyectoId: number;
  };
  proyecto?: {
    id: number;
    nombre: string;
  };
  issue?: {
    id: number;
    titulo: string;
    estado: string;
    categoria: string;
    proyectoId: number;
  };
}

/**
 * Obtiene las notificaciones del usuario actual
 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const response = await apiRequest<{ notificaciones: any[] }>("/api/notificacion");
    
    const notificaciones = response.notificaciones || [];
    
    // Formatear fecha relativa para mostrar en la UI
    const formatRelativeTime = (dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };
    
    // Mapear notificaciones del backend al formato del frontend
    return notificaciones.map((notif) => ({
      id: notif.id.toString(),
      title: notif.titulo,
      description: notif.descripcion,
      type: notif.tipo,
      timestamp: formatRelativeTime(notif.createdAt),
      read: notif.leida,
      taskId: notif.tareaId?.toString(),
      projectId: notif.proyectoId?.toString(),
      issueId: notif.issueId?.toString(),
      tarea: notif.tarea,
      proyecto: notif.proyecto,
      issue: notif.issue,
    }));
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    // Si falla, retornar array vacío
    return [];
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas
 */
export async function getNotificationCount(): Promise<number> {
  try {
    const response = await apiRequest<{ conteo: number }>("/api/notificacion/conteo");
    return response.conteo || 0;
  } catch (error) {
    console.error('Error obteniendo conteo de notificaciones:', error);
    return 0;
  }
}

/**
 * Marca una notificación como leída
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await apiRequest(`/api/notificacion/${notificationId}/leida`, {
    method: 'PATCH',
  });
}

/**
 * Marca todas las notificaciones como leídas
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  await apiRequest('/api/notificacion/marcar-todas-leidas', {
    method: 'PATCH',
  });
}

// ==================== GITHUB COMMITS ====================

export interface GitHubCommit {
  repo: string;
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  url: string;
}

export interface ProjectCommitsResponse {
  commits: GitHubCommit[];
  total: number;
  repos: string[];
  repositorios: RepoLink[]; // Repositorios formateados del backend
  proyectoId: string;
  debug?: {
    reposConsultados: Array<{
      repo: string;
      commitsObtenidos: number;
    }>;
    tokenConfigurado: boolean;
    totalRepos: number;
    errores?: Array<{
      repo: string;
      error: string;
      status?: number;
      data?: any;
    }>;
  };
}

/**
 * Obtiene commits de GitHub para un proyecto
 * Si no hay repositorios configurados (404), devuelve una respuesta vacía en lugar de lanzar error
 */
export async function getProjectCommits(
  projectId: string,
  limit: number = 10
): Promise<ProjectCommitsResponse> {
  const token = getAuthToken();
  
  const url = `${API_URL}/api/github/projects/${projectId}/commits?limit=${limit}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  
  try {
    const response = await fetch(url, { headers });
    
    // El backend ahora devuelve 200 con datos vacíos cuando no hay repositorios
    // Ya no necesitamos manejar 404 de forma especial
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || errorData.error || `Error: ${response.statusText}`);
      throw error;
    }
    
    return response.json();
  } catch (error: any) {
    // Si el error indica que no hay repositorios, devolver respuesta vacía silenciosamente
    if (error.message && (
      error.message.includes('No hay repositorios configurados') ||
      error.message.includes('repositorios configurados')
    )) {
      return {
        commits: [],
        total: 0,
        repos: [],
        repositorios: [],
        proyectoId: projectId,
      };
    }
    // Para otros errores reales, lanzarlos normalmente
    throw error;
  }
}

// ==================== REPOSITORIOS GITHUB ====================

export interface RepoLink {
  id: string;
  label: string;
  description: string;
  url: string;
  type: 'github' | 'design' | 'documentation' | 'other';
  repositorio?: {
    id: number;
    nombre: string;
    descripcion?: string;
    url: string;
    owner: string;
    repo: string;
    tipo: 'github' | 'design' | 'documentation' | 'other';
    activo: boolean;
    proyectoId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface RepositorioGitHub {
  id: number;
  nombre: string;
  descripcion?: string;
  url: string;
  owner: string;
  repo: string;
  tipo: 'github' | 'design' | 'documentation' | 'other';
  activo: boolean;
  proyectoId: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateRepositorioData {
  nombre?: string;
  descripcion?: string;
  url?: string;
  tipo?: 'github' | 'design' | 'documentation' | 'other';
  activo?: boolean;
}

export interface CreateRepositorioData {
  nombre: string;
  descripcion?: string;
  url: string;
  tipo?: 'github' | 'design' | 'documentation' | 'other';
  proyectoId: number;
}

/**
 * Obtiene los repositorios de un proyecto (ya formateados para el frontend)
 */
export async function getRepositorios(proyectoId: number): Promise<{ repositorios: RepoLink[] }> {
  return apiRequest<{ repositorios: RepoLink[] }>(`/api/repositorios?proyectoId=${proyectoId}`);
}

/**
 * Crea un nuevo repositorio
 */
export async function createRepositorio(
  data: CreateRepositorioData
): Promise<{ message: string; repositorio: RepositorioGitHub }> {
  return apiRequest<{ message: string; repositorio: RepositorioGitHub }>('/api/repositorios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualiza un repositorio
 */
export async function updateRepositorio(
  repositorioId: string,
  data: UpdateRepositorioData
): Promise<{ message: string; repositorio: RepositorioGitHub }> {
  return apiRequest<{ message: string; repositorio: RepositorioGitHub }>(`/api/repositorios/${repositorioId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Elimina un repositorio
 */
export async function deleteRepositorio(repositorioId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/repositorios/${repositorioId}`, {
    method: 'DELETE',
  });
}

// ==================== GITHUB TOKENS MANAGEMENT ====================

export interface GitHubToken {
  id: number;
  nombre: string;
  activo: boolean;
  creadoPor: {
    id: number;
    nombreCompleto: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateGitHubTokenData {
  nombre: string;
  token: string;
  proyectoId: number;
}

export interface UpdateGitHubTokenData {
  nombre?: string;
  activo?: boolean;
}

/**
 * Lista todos los tokens de GitHub de un proyecto (solo administradores)
 */
export async function getGitHubTokens(proyectoId: number): Promise<{ tokens: GitHubToken[] }> {
  return apiRequest<{ tokens: GitHubToken[] }>(`/api/github/tokens?proyectoId=${proyectoId}`);
}

/**
 * Crea un nuevo token de GitHub (solo administradores)
 */
export async function createGitHubToken(
  data: CreateGitHubTokenData
): Promise<{ message: string; token: GitHubToken }> {
  return apiRequest<{ message: string; token: GitHubToken }>('/api/github/tokens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualiza un token de GitHub (solo administradores)
 */
export async function updateGitHubToken(
  tokenId: string,
  data: UpdateGitHubTokenData
): Promise<{ message: string; token: GitHubToken }> {
  return apiRequest<{ message: string; token: GitHubToken }>(`/api/github/tokens/${tokenId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Elimina un token de GitHub (solo administradores)
 */
export async function deleteGitHubToken(tokenId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/github/tokens/${tokenId}`, {
    method: 'DELETE',
  });
}

