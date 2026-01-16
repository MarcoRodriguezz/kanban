export type BoardTaskItem = {
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
  // Campos adicionales para comunicación con el backend
  assigneeId?: string;
  projectId?: string;
  dueDate?: string; // Fecha en formato ISO para el backend
  createdById?: string; // ID del usuario que creó la tarea
  projectManagerId?: string; // ID del gestor del proyecto
};

