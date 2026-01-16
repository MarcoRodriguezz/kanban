import React from 'react';
import Sidebar, { DEFAULT_PROJECTS, SidebarProject } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import { getComponentes, Componente, deleteComponente, createComponente } from '../../services/api';

type ComponentCategory = 'logos' | 'iconos' | 'ilustraciones' | 'fondos';

type StoredComponent = {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  updatedAt: string;
  tags: string[];
  preview: string;
};

const COMPONENT_CATEGORIES: Array<{ id: ComponentCategory; label: string }> = [
  { id: 'logos', label: 'Logos' },
  { id: 'iconos', label: 'Iconografía' },
  { id: 'ilustraciones', label: 'Ilustraciones' },
  { id: 'fondos', label: 'Fondos' },
];

const CATEGORY_LABEL: Record<ComponentCategory, string> = COMPONENT_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.id] = category.label;
    return acc;
  },
  {} as Record<ComponentCategory, string>,
);

const COMPONENTS: StoredComponent[] = [
  {
    id: 'cmp-001',
    name: 'Logo isotipo',
    description: 'Logotipo principal en formato SVG con versiones light y dark.',
    category: 'logos',
    updatedAt: 'Actualizado hace 1 día',
    tags: ['branding', 'isotipo'],
    preview: '/img/kanban-logo.svg',
  },
  {
    id: 'cmp-002',
    name: 'Icono tablero',
    description: 'Icono minimalista para representar tableros o paneles Kanban.',
    category: 'iconos',
    updatedAt: 'Actualizado hace 2 días',
    tags: ['icono', 'ui'],
    preview: '/img/icon-board.svg',
  },
  {
    id: 'cmp-003',
    name: 'Ilustración equipo',
    description: 'Ilustración en tonos azules para secciones de equipo y colaboración.',
    category: 'ilustraciones',
    updatedAt: 'Actualizado hace 4 días',
    tags: ['ilustración', 'team'],
    preview: '/img/kanban-image.svg',
  },
  {
    id: 'cmp-004',
    name: 'Background ondas',
    description: 'Fondo con ondas suaves y degradados para headers o secciones hero.',
    category: 'fondos',
    updatedAt: 'Actualizado hace 6 horas',
    tags: ['background', 'gradient'],
    preview: '/img/background-waves.svg',
  },
  {
    id: 'cmp-005',
    name: 'Icono campana',
    description: 'Campana de notificaciones con contorno limpio y relleno adaptable.',
    category: 'iconos',
    updatedAt: 'Actualizado hace 3 días',
    tags: ['icono', 'alerta'],
    preview: '/img/notification-icon.svg',
  },
];

type ComponentsPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerNotifications?: HeaderProps['notifications'];
};

const ComponentsPage: React.FC<ComponentsPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  headerNotifications,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<ComponentCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [componentItems, setComponentItems] = React.useState<StoredComponent[]>([]);
  const [isLoadingComponents, setIsLoadingComponents] = React.useState(false);
  const [componentsError, setComponentsError] = React.useState<string | null>(null);
  const [showNewComponentModal, setShowNewComponentModal] = React.useState(false);
  const [newComponentForm, setNewComponentForm] = React.useState<{
    name: string;
    description: string;
    category: ComponentCategory;
  }>({
    name: '',
    description: '',
    category: 'logos',
  });
  const [newComponentPreview, setNewComponentPreview] = React.useState<string | null>(null);
  const [newComponentFileName, setNewComponentFileName] = React.useState<string>('');
  const [newComponentFile, setNewComponentFile] = React.useState<File | null>(null);
  const [isSubmittingComponent, setIsSubmittingComponent] = React.useState(false);
  const [componentSubmitError, setComponentSubmitError] = React.useState<string | null>(null);
  const [exportComponent, setExportComponent] = React.useState<StoredComponent | null>(null);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportOptions, setExportOptions] = React.useState<{
    format: 'png' | 'svg';
    includeMetadata: boolean;
  }>({
    format: 'png',
    includeMetadata: true,
  });
  const [deleteComponent, setDeleteComponent] = React.useState<StoredComponent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);

  // Cargar componentes cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setComponentItems([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setComponentItems([]);
      return;
    }

    setIsLoadingComponents(true);
    setComponentsError(null);

    getComponentes(String(proyectoId))
      .then((response) => {
        // Construir URL completa para previews que vienen del servidor
        // Usar la misma lógica que en api.ts para obtener API_URL
        const API_URL = (() => {
          const envUrl = process.env.REACT_APP_API_URL;
          if (envUrl && !envUrl.includes(':3000')) {
            return envUrl;
          }
          return 'http://localhost:3001';
        })();
        
        const getPreviewUrl = (preview: string | null, archivo: string | null): string => {
          if (preview) {
            // Si es una ruta relativa del servidor (/uploads/...), usar el endpoint de la API
            if (preview.startsWith('/uploads/')) {
              const filename = preview.replace('/uploads/', '');
              const apiUrl = `${API_URL}/api/componentes/imagen/${filename}`;
              return apiUrl;
            }
            // Si ya es una URL completa o data URL, devolverla tal cual
            if (preview.startsWith('http://') || preview.startsWith('https://') || preview.startsWith('data:')) {
              return preview;
            }
            // Si es una ruta relativa que no es /uploads, usar la URL del frontend
            if (preview.startsWith('/')) {
              return preview;
            }
          }
          if (archivo) {
            if (archivo.startsWith('/uploads/')) {
              const filename = archivo.replace('/uploads/', '');
              const apiUrl = `${API_URL}/api/componentes/imagen/${filename}`;
              return apiUrl;
            }
            return archivo;
          }
          return '/img/kanban-logo.svg';
        };

        // Mapear componentes del backend al formato del frontend
        const componentesMapeados: StoredComponent[] = response.componentes.map((comp: Componente) => ({
          id: comp.id.toString(),
          name: comp.nombre,
          description: comp.descripcion || '',
          category: comp.categoria as ComponentCategory,
          updatedAt: comp.updatedAt ? new Date(comp.updatedAt).toLocaleDateString('es-ES') : 'Sin fecha',
          tags: comp.tags || [],
          preview: getPreviewUrl(comp.preview, comp.archivo),
        }));
        setComponentItems(componentesMapeados);
      })
      .catch((error: any) => {
        console.error('Error cargando componentes:', error);
        setComponentsError(error.message || 'Error al cargar los componentes');
        // Usar datos por defecto si falla
        setComponentItems(COMPONENTS);
      })
      .finally(() => {
        setIsLoadingComponents(false);
      });
  }, [project?.id]);

  const filteredComponents = React.useMemo(() => {
    return componentItems.filter((component) => {
      const matchCategory = activeCategory === 'all' || component.category === activeCategory;
      const matchSearch = searchTerm.trim()
        ? component.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          component.description.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          component.tags.some((tag) => tag.toLowerCase().includes(searchTerm.trim().toLowerCase()))
        : true;
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchTerm, componentItems]);

  const handleOpenNewComponentModal = React.useCallback(() => {
    setShowNewComponentModal(true);
  }, []);

  const resetNewComponentState = React.useCallback(() => {
    setNewComponentForm({
      name: '',
      description: '',
      category: 'logos',
    });
    setNewComponentPreview(null);
    setNewComponentFileName('');
    setNewComponentFile(null);
    setComponentSubmitError(null);
  }, []);

  const handleCloseNewComponentModal = React.useCallback(() => {
    setShowNewComponentModal(false);
    resetNewComponentState();
  }, [resetNewComponentState]);

  const handleOpenExportModal = React.useCallback((component: StoredComponent) => {
    // Detectar si es SVG: por extensión, por data URL, o por contenido
    const previewLower = component.preview.toLowerCase();
    const supportsSvg = 
      previewLower.endsWith('.svg') || 
      previewLower.startsWith('data:image/svg+xml') ||
      previewLower.includes('svg');
    
    setExportComponent(component);
    setExportOptions({
      format: supportsSvg ? 'svg' : 'png',
      includeMetadata: true,
    });
    setShowExportModal(true);
  }, []);

  const handleCloseExportModal = React.useCallback(() => {
    setShowExportModal(false);
    setExportComponent(null);
  }, []);

  const handleOpenDeleteConfirm = React.useCallback((component: StoredComponent) => {
    setDeleteComponent(component);
    setShowDeleteConfirm(true);
  }, []);

  const handleCloseDeleteConfirm = React.useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteComponent(null);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteComponent || !project?.id) return;

    setIsDeleting(true);
    try {
      await deleteComponente(deleteComponent.id);
      
      // Recargar componentes después de eliminar
      const proyectoId = Number(project.id);
      if (!isNaN(proyectoId)) {
        const API_URL = (() => {
          const envUrl = process.env.REACT_APP_API_URL;
          if (envUrl && !envUrl.includes(':3000')) {
            return envUrl;
          }
          return 'http://localhost:3001';
        })();
        const getPreviewUrl = (preview: string | null, archivo: string | null): string => {
          if (preview) {
            if (preview.startsWith('/uploads/')) {
              const filename = preview.replace('/uploads/', '');
              return `${API_URL}/api/componentes/imagen/${filename}`;
            }
            if (preview.startsWith('http://') || preview.startsWith('https://') || preview.startsWith('data:')) {
              return preview;
            }
            if (preview.startsWith('/')) {
              return preview;
            }
          }
          if (archivo) {
            if (archivo.startsWith('/uploads/')) {
              const filename = archivo.replace('/uploads/', '');
              return `${API_URL}/api/componentes/imagen/${filename}`;
            }
            return archivo;
          }
          return '/img/kanban-logo.svg';
        };

        const response = await getComponentes(String(proyectoId));
        const componentesMapeados: StoredComponent[] = response.componentes.map((comp: Componente) => ({
          id: comp.id.toString(),
          name: comp.nombre,
          description: comp.descripcion || '',
          category: comp.categoria as ComponentCategory,
          updatedAt: comp.updatedAt ? new Date(comp.updatedAt).toLocaleDateString('es-ES') : 'Sin fecha',
          tags: comp.tags || [],
          preview: getPreviewUrl(comp.preview, comp.archivo),
        }));
        setComponentItems(componentesMapeados);
      }
      
      setShowDeleteConfirm(false);
      setDeleteComponent(null);
    } catch (error: any) {
      console.error('Error eliminando componente:', error);
      alert(error.message || 'Error al eliminar el componente. Por favor, intenta de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteComponent, project?.id]);

  const handleExportMetadataToggle = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setExportOptions((prev) => ({
      ...prev,
      includeMetadata: event.target.checked,
    }));
  }, []);

  const handleExportFormatToggle = React.useCallback(
    (format: 'png' | 'svg') => {
      setExportOptions((prev) => {
        if (format === 'svg' && exportComponent) {
          // Detectar si es SVG: por extensión, por data URL, o por contenido
          const previewLower = exportComponent.preview.toLowerCase();
          const supportsSvg = 
            previewLower.endsWith('.svg') || 
            previewLower.startsWith('data:image/svg+xml') ||
            previewLower.includes('svg');
          
          if (!supportsSvg) {
            return prev;
          }
        }

        return {
          ...prev,
          format,
        };
      });
    },
    [exportComponent],
  );

  const handleExecuteExport = React.useCallback(async () => {
    if (!exportComponent) return;

    try {
      // Detectar si es SVG: por extensión, por data URL, o por contenido
      const previewLower = exportComponent.preview.toLowerCase();
      const supportsSvg = 
        previewLower.endsWith('.svg') || 
        previewLower.startsWith('data:image/svg+xml') ||
        previewLower.includes('svg');
      
      const format = exportOptions.format;
      
      // Si se intenta exportar SVG pero la imagen no es SVG, usar PNG
      const finalFormat = format === 'svg' && !supportsSvg ? 'png' : format;

      // Construir URL completa si es una ruta relativa del servidor
      const getFullUrl = (url: string): string => {
        // Si ya es una URL completa (http/https) o data URL, devolverla tal cual
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
          return url;
        }
        // Si es una ruta relativa que empieza con /uploads, construir URL del backend
        if (url.startsWith('/uploads/')) {
          const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
          return `${API_URL}${url}`;
        }
        // Si es una ruta relativa que empieza con /, usar la URL actual
        if (url.startsWith('/')) {
          return `${window.location.origin}${url}`;
        }
        // En cualquier otro caso, devolver tal cual
        return url;
      };

      const imageUrl = getFullUrl(exportComponent.preview);

      // Función auxiliar para descargar un archivo
      const downloadFile = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      // Función para convertir SVG a PNG usando canvas
      const convertSvgToPng = async (svgUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // Usar las dimensiones naturales de la imagen si están disponibles
            // Si no, usar un tamaño por defecto razonable
            const naturalWidth = img.naturalWidth || img.width || 800;
            const naturalHeight = img.naturalHeight || img.height || 600;
            
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('No se pudo obtener el contexto del canvas'));
              return;
            }

            // Fondo transparente
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Error al convertir SVG a PNG'));
              }
            }, 'image/png', 1.0); // Calidad máxima
          };
          
          img.onerror = () => reject(new Error('Error al cargar la imagen SVG'));
          img.src = svgUrl;
        });
      };

      // Función para obtener el blob de la imagen
      const getImageBlob = async (url: string, format: 'png' | 'svg'): Promise<Blob> => {
        if (format === 'svg' && supportsSvg) {
          // Para SVG, obtener el contenido directamente
          if (url.startsWith('data:image/svg+xml')) {
            // Si es data URL, extraer el contenido
            try {
              const base64Match = url.match(/data:image\/svg\+xml[^,]+,(.+)/);
              if (base64Match) {
                const base64Data = base64Match[1];
                // Puede estar codificado en base64 o como URI
                let svgText: string;
                try {
                  svgText = decodeURIComponent(atob(base64Data));
                } catch {
                  // Si falla, intentar directamente como texto
                  svgText = decodeURIComponent(base64Data);
                }
                return new Blob([svgText], { type: 'image/svg+xml' });
              } else {
                // Si no hay base64, puede ser texto plano
                const textMatch = url.match(/data:image\/svg\+xml,(.+)/);
                if (textMatch) {
                  return new Blob([decodeURIComponent(textMatch[1])], { type: 'image/svg+xml' });
                }
              }
            } catch (e) {
              console.warn('Error procesando data URL SVG, intentando fetch:', e);
            }
            // Fallback: intentar como URL normal
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al obtener el archivo SVG');
            return await response.blob();
          } else {
            // Si es URL normal, obtener el contenido
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al obtener el archivo SVG');
            const svgText = await response.text();
            return new Blob([svgText], { type: 'image/svg+xml' });
          }
        } else {
          // Para PNG, convertir si es necesario
          if (supportsSvg) {
            // Si es SVG pero queremos PNG, convertir
            return await convertSvgToPng(url);
          } else {
            // Si ya es PNG u otro formato, obtener directamente
            if (url.startsWith('data:')) {
              // Si es data URL, convertir a blob
              const response = await fetch(url);
              return await response.blob();
            } else {
              // Si es URL normal, obtener directamente
              const response = await fetch(url);
              if (!response.ok) throw new Error('Error al obtener la imagen');
              return await response.blob();
            }
          }
        }
      };

      // Obtener el blob de la imagen
      const imageBlob = await getImageBlob(imageUrl, finalFormat);
      
      // Generar nombre de archivo
      const sanitizedName = exportComponent.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const extension = finalFormat === 'svg' ? 'svg' : 'png';
      const imageFilename = `${sanitizedName}.${extension}`;

      // Descargar la imagen
      downloadFile(imageBlob, imageFilename);

      // Si se solicitan metadatos, crear y descargar archivo JSON
      if (exportOptions.includeMetadata) {
        const metadata = {
          nombre: exportComponent.name,
          descripcion: exportComponent.description,
          categoria: CATEGORY_LABEL[exportComponent.category],
          tags: exportComponent.tags,
          formato: finalFormat.toUpperCase(),
          fechaExportacion: new Date().toISOString(),
        };

        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
          type: 'application/json',
        });
        const metadataFilename = `${sanitizedName}-metadata.json`;
        downloadFile(metadataBlob, metadataFilename);
      }

      // Cerrar el modal después de un breve delay para que el usuario vea que se descargó
      setTimeout(() => {
        setShowExportModal(false);
        setExportComponent(null);
      }, 300);
    } catch (error) {
      console.error('Error al exportar componente:', error);
      alert('Error al exportar el componente. Por favor, intenta de nuevo.');
    }
  }, [exportComponent, exportOptions]);

  const handleNewComponentInputChange = React.useCallback(
    (field: 'name' | 'description' | 'category') =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = event.target.value;
        setNewComponentForm((prev) => ({
          ...prev,
          [field]: field === 'category' ? (value as ComponentCategory) : value,
        }));
      },
    [],
  );

  const handleNewComponentFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setNewComponentPreview(null);
      setNewComponentFileName('');
      setNewComponentFile(null);
      return;
    }

    // Guardar el archivo original
    setNewComponentFile(file);
    setNewComponentFileName(file.name);

    // Crear preview para mostrar
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewComponentPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmitNewComponent = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!newComponentForm.name.trim()) {
        setComponentSubmitError('El nombre del componente es requerido');
        return;
      }

      if (!newComponentPreview || !newComponentFile) {
        setComponentSubmitError('Debes seleccionar una imagen');
        return;
      }

      if (!project?.id) {
        setComponentSubmitError('No se pudo identificar el proyecto. Por favor, recarga la página.');
        return;
      }

      const proyectoId = Number(project.id);
      if (isNaN(proyectoId)) {
        setComponentSubmitError('ID de proyecto inválido.');
        return;
      }

      setIsSubmittingComponent(true);
      setComponentSubmitError(null);

      try {
        // Crear el componente en el backend
        await createComponente({
          nombre: newComponentForm.name.trim(),
          descripcion: newComponentForm.description.trim() || undefined,
          categoria: newComponentForm.category,
          tags: [newComponentForm.category],
          proyectoId: proyectoId,
          archivo: newComponentFile,
        });

        // Recargar componentes después de crear
        const API_URL = (() => {
          const envUrl = process.env.REACT_APP_API_URL;
          if (envUrl && !envUrl.includes(':3000')) {
            return envUrl;
          }
          return 'http://localhost:3001';
        })();
        const getPreviewUrl = (preview: string | null, archivo: string | null): string => {
          if (preview) {
            if (preview.startsWith('/uploads/')) {
              const filename = preview.replace('/uploads/', '');
              return `${API_URL}/api/componentes/imagen/${filename}`;
            }
            if (preview.startsWith('http://') || preview.startsWith('https://') || preview.startsWith('data:')) {
              return preview;
            }
            if (preview.startsWith('/')) {
              return preview;
            }
          }
          if (archivo) {
            if (archivo.startsWith('/uploads/')) {
              const filename = archivo.replace('/uploads/', '');
              return `${API_URL}/api/componentes/imagen/${filename}`;
            }
            return archivo;
          }
          return '/img/kanban-logo.svg';
        };

        const response = await getComponentes(String(proyectoId));
        const componentesMapeados: StoredComponent[] = response.componentes.map((comp: Componente) => ({
          id: comp.id.toString(),
          name: comp.nombre,
          description: comp.descripcion || '',
          category: comp.categoria as ComponentCategory,
          updatedAt: comp.updatedAt ? new Date(comp.updatedAt).toLocaleDateString('es-ES') : 'Sin fecha',
          tags: comp.tags || [],
          preview: getPreviewUrl(comp.preview, comp.archivo),
        }));
        setComponentItems(componentesMapeados);

        // Cerrar modal y resetear estado
        setShowNewComponentModal(false);
        resetNewComponentState();
      } catch (error: any) {
        console.error('Error creando componente:', error);
        setComponentSubmitError(error.message || 'Error al crear el componente. Por favor, intenta de nuevo.');
      } finally {
        setIsSubmittingComponent(false);
      }
    },
    [newComponentForm, newComponentPreview, newComponentFile, project?.id, resetNewComponentState],
  );

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
          title="Components"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10">
            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm shadow-slate-900/10">
              <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Biblioteca</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {project ? project.name : 'Componentes del tablero'}
                </h2>
                <p className="max-w-xl text-sm text-slate-500">
                  Centraliza iconos, logotipos, ilustraciones o fondos reutilizables para compartirlos con otros proyectos. Mantén
                  un repositorio sencillo y siempre accesible desde este espacio.
                </p>
              </header>
              {componentsError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {componentsError}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm shadow-slate-900/10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  onClick={handleOpenNewComponentModal}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  + Nuevo componente
                </button>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre o etiqueta"
                    className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    activeCategory === 'all'
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/20'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                  }`}
                >
                  Todos
                </button>
                {COMPONENT_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      activeCategory === category.id
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Componentes guardados</h3>
                <span className="text-xs text-slate-400">Selecciona un elemento para ver su descripción.</span>
              </header>

              {isLoadingComponents ? (
                <div className="py-12 text-center text-sm text-slate-500">Cargando componentes...</div>
              ) : filteredComponents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">No hay componentes disponibles</div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredComponents.map((component) => (
                  <article
                    key={component.id}
                    className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-900/10 transition hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{component.name}</h4>
                          <p className="mt-1 text-xs text-slate-500">{component.description}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {CATEGORY_LABEL[component.category]}
                        </span>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <img 
                          src={component.preview} 
                          alt={component.name} 
                          className="h-32 w-full rounded-xl object-contain"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            console.error('Error cargando imagen:', component.preview, component);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            // Mostrar un placeholder si falla
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.image-error')) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'image-error flex h-32 items-center justify-center text-xs text-slate-400';
                              errorDiv.textContent = 'Imagen no disponible';
                              parent.appendChild(errorDiv);
                            }
                          }}
                          onLoad={() => {}}
                        />
                      </div>
                      {/* Etiquetas removidas según solicitud */}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{component.updatedAt}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenExportModal(component)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                        >
                          Exportar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteConfirm(component)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                          title="Eliminar componente"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                  ))}
                </div>
              )}
            </section>

            {/* Sección de actividad reciente eliminada según la solicitud */}
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

      {showNewComponentModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-6 space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">Nuevo componente</h2>
              <p className="text-sm text-slate-500">
                Añade una referencia visual o pega el código que acompañará a este componente reutilizable.
              </p>
            </header>

            <form onSubmit={handleSubmitNewComponent} className="space-y-5">
              {componentSubmitError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {componentSubmitError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-slate-600">
                  Nombre del componente
                  <input
                    type="text"
                    required
                    value={newComponentForm.name}
                    onChange={handleNewComponentInputChange('name')}
                    placeholder="Ej. Header principal"
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-600">
                  Categoría
                  <select
                    value={newComponentForm.category}
                    onChange={handleNewComponentInputChange('category')}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {COMPONENT_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Descripción
                <textarea
                  value={newComponentForm.description}
                  onChange={handleNewComponentInputChange('description')}
                  placeholder="Contexto o notas rápidas sobre el componente."
                  className="min-h-[80px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
                <span className="text-sm font-semibold text-slate-600">Imagen de referencia</span>
                {newComponentPreview ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <img src={newComponentPreview} alt="Vista previa" className="h-40 w-full rounded-xl object-contain" />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">Archivo seleccionado: {newComponentFileName}</p>
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600">
                        Cambiar imagen
                        <input type="file" accept="image/*" onChange={handleNewComponentFileChange} className="hidden" />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 transition hover:border-blue-300 hover:text-blue-600">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                          +
                        </span>
                        <span className="font-semibold">Seleccionar archivo</span>
                        <span className="text-xs text-slate-400">PNG, JPG o SVG</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleNewComponentFileChange} className="hidden" />
                    </label>
                    <p className="text-xs text-rose-400">
                      Sube una imagen para poder guardar este recurso en la biblioteca.
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseNewComponentModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newComponentPreview || isSubmittingComponent}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition ${
                    newComponentPreview && !isSubmittingComponent
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'cursor-not-allowed bg-slate-300 text-slate-100 shadow-none'
                  }`}
                >
                  {isSubmittingComponent ? 'Guardando...' : 'Guardar componente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteComponent && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Eliminar componente</h2>
            <p className="mt-2 text-sm text-slate-500">
              ¿Estás seguro de que deseas eliminar el componente <span className="font-semibold text-slate-700">"{deleteComponent.name}"</span>? Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                disabled={isDeleting}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 disabled:opacity-60"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && exportComponent && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Exportar componente</p>
                  <h2 className="text-xl font-semibold text-slate-900">{exportComponent.name}</h2>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {CATEGORY_LABEL[exportComponent.category]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Elige cómo compartir este recurso con otros proyectos. Puedes adjuntar metadatos para mantener el contexto y la
                documentación.
              </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
              <div className="space-y-5">
                <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Detalles de exportación
                  </span>
                  <div className="space-y-4 text-sm text-slate-500">
                    {(() => {
                      const previewLower = exportComponent.preview.toLowerCase();
                      const supportsSvg = 
                        previewLower.endsWith('.svg') || 
                        previewLower.startsWith('data:image/svg+xml') ||
                        previewLower.includes('svg');
                      return (
                        <>
                          <p>Elige el formato en el que quieres descargar este recurso visual.</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleExportFormatToggle('png')}
                              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                                exportOptions.format === 'png'
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                  : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                              }`}
                            >
                              PNG optimizado
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportFormatToggle('svg')}
                              disabled={!supportsSvg}
                              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                                exportOptions.format === 'svg'
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                  : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                              } ${!supportsSvg ? 'cursor-not-allowed opacity-60 hover:border-slate-200 hover:text-slate-500' : ''}`}
                            >
                              SVG original
                            </button>
                          </div>
                          {!supportsSvg && (
                            <p className="text-xs text-rose-400">Esta imagen no dispone de versión vectorial, solo PNG.</p>
                          )}
                          <ul className="space-y-2 text-xs text-slate-400">
                            <li>• PNG mantiene la imagen rasterizada y transparente cuando sea posible.</li>
                            <li>• SVG conserva la edición vectorial (disponible solo si el recurso es vectorial).</li>
                          </ul>
                        </>
                      );
                    })()}
                  </div>
                </section>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeMetadata}
                    onChange={handleExportMetadataToggle}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Incluir metadatos (nombre, descripción y categoría)
                </label>

                <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
                  <p className="font-semibold uppercase tracking-[0.3em] text-slate-400">Resumen</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Exportarás este recurso como imagen{' '}
                    <span className="font-semibold text-slate-700">{exportOptions.format.toUpperCase()}</span>{' '}
                    {exportOptions.includeMetadata ? 'con un archivo de metadatos adicional.' : 'sin información adicional.'}
                  </p>
                </section>
              </div>

              <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <h3 className="text-sm font-semibold text-slate-700">Vista previa</h3>
                <p className="text-xs text-slate-400">Revisa la referencia que acompañará al archivo exportado.</p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <img 
                    src={exportComponent.preview} 
                    alt={exportComponent.name} 
                    className="h-40 w-full rounded-xl object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
                  Última actualización: <span className="font-semibold text-slate-500">{exportComponent.updatedAt}</span>
                </div>
              </aside>
            </div>

            <footer className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseExportModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteExport}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
              >
                Exportar ahora
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentsPage;
