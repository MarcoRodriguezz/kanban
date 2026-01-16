import { useState, useEffect } from 'react';
import { getMiembrosProyecto, MiembroProyecto, getProjectFull } from '../../../services/api';

export function useProjectMembers(projectId?: string) {
  const [projectMembers, setProjectMembers] = useState<MiembroProyecto[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [projectManagerId, setProjectManagerId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProjectMembers([]);
      setProjectManagerId(null);
      return;
    }

    const loadMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const { miembros } = await getMiembrosProyecto(projectId);
        setProjectMembers(miembros);
      } catch (error) {
        console.error('Error cargando miembros del proyecto:', error);
        setProjectMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    const loadProjectManager = async () => {
      try {
        const proyecto = await getProjectFull(projectId);
        setProjectManagerId(proyecto.gestorId?.toString() || null);
      } catch (error) {
        console.error('Error cargando gestor del proyecto:', error);
        setProjectManagerId(null);
      }
    };

    loadMembers();
    loadProjectManager();
  }, [projectId]);

  return { projectMembers, isLoadingMembers, projectManagerId };
}