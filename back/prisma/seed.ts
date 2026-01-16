import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Limpiar la URL de comillas si las tiene (dotenv a veces las agrega)
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL || '';
  return url.replace(/^["']|["']$/g, '');
};

// Crear el adapter de MariaDB para MySQL (compatible con MySQL)
const createAdapter = () => {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username || undefined,
    password: url.password || undefined,
    database: url.pathname.slice(1), // Remover el '/' inicial
    // Configuración del pool de conexiones
    connectionLimit: 10, // Número máximo de conexiones en el pool
  });
};

// Crear PrismaClient con el adapter (requerido para Prisma 7 con engineType = "binary")
const prisma = new PrismaClient({
  adapter: createAdapter(),
});

const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🌱 Iniciando seed de datos de prueba...\n');
  
  // Verificar que DATABASE_URL esté configurada
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada. Por favor, crea un archivo .env con DATABASE_URL=mysql://...');
  }
  
  // Probar conexión antes de empezar
  try {
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida\n');
  } catch (error: any) {
    throw new Error(`No se pudo conectar a la base de datos: ${error.message}`);
  }

  // Limpiar datos existentes (opcional - comentar si no quieres borrar datos)
  console.log(' Limpiando datos existentes...');
  // Orden importante: eliminar primero las entidades que tienen referencias a otras
  // 1. Eliminar relaciones many-to-many primero
  await prisma.tareaEtiqueta.deleteMany();
  await prisma.tareaRelease.deleteMany();
  // 2. Eliminar entidades que referencian tareas
  await prisma.comentario.deleteMany();
  await prisma.archivo.deleteMany();
  // 3. Eliminar logs de actividad (referencian usuarioId)
  await prisma.logActividad.deleteMany();
  // 4. Eliminar tareas (referencian proyectoId, usuarioId y creadoPorId)
  await prisma.tarea.deleteMany();
  // 5. Eliminar sprints y releases (referencian proyectoId)
  await prisma.sprint.deleteMany();
  await prisma.release.deleteMany();
  // 6. Eliminar componentes (referencian proyectoId y creadoPorId)
  await prisma.componente.deleteMany().catch(() => {
    // Ignorar si la tabla no existe o está vacía
  });
  // 7. Eliminar repositorios GitHub (referencian proyectoId)
  await prisma.repositorioGitHub.deleteMany().catch(() => {
    // Ignorar si la tabla no existe o está vacía
  });
  // 8. Eliminar GitHubTokens (referencian proyectoId y creadoPorId)
  await prisma.gitHubToken.deleteMany().catch(() => {
    // Ignorar si la tabla no existe o está vacía
  });
  // 9. Eliminar proyectos (referencian creadoPorId y gestorId)
  await prisma.proyecto.deleteMany();
  // 10. Eliminar etiquetas (sin dependencias críticas)
  await prisma.etiqueta.deleteMany();
  // 11. Eliminar usuarios al final (pueden ser referenciados por otras tablas)
  await prisma.usuario.deleteMany();

  // Crear usuarios
  console.log('👥 Creando usuarios...');
  const admin = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Administrador Principal',
      email: 'admin@kanban.com',
      contraseña: await bcrypt.hash('admin123', BCRYPT_ROUNDS),
      rol: 'Administrador',
    },
  });

  const gestor1 = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Carlos García',
      email: 'carlos.garcia@kanban.com',
      contraseña: await bcrypt.hash('empleado123', BCRYPT_ROUNDS),
      rol: 'Empleado',
    },
  });

  const gestor2 = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Ana Martínez',
      email: 'ana.martinez@kanban.com',
      contraseña: await bcrypt.hash('empleado123', BCRYPT_ROUNDS),
      rol: 'Empleado',
    },
  });

  const empleado1 = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Juan Pérez',
      email: 'empleado1@kanban.com',
      contraseña: await bcrypt.hash('empleado123', BCRYPT_ROUNDS),
      rol: 'Empleado',
    },
  });

  const empleado2 = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Laura Sánchez',
      email: 'empleado2@kanban.com',
      contraseña: await bcrypt.hash('empleado123', BCRYPT_ROUNDS),
      rol: 'Empleado',
    },
  });

  const empleado3 = await prisma.usuario.create({
    data: {
      nombreCompleto: 'Pedro López',
      email: 'empleado3@kanban.com',
      contraseña: await bcrypt.hash('empleado123', BCRYPT_ROUNDS),
      rol: 'Empleado',
    },
  });

  console.log(` Creados ${6} usuarios`);

  // Crear proyectos
  console.log(' Creando proyectos...');
  const proyecto1 = await prisma.proyecto.create({
    data: {
      nombre: 'Sistema de Gestión Kanban',
      descripcion: 'Desarrollo de un sistema completo de gestión de proyectos con metodología Kanban',
      responsable: 'Carlos García',
      equipo: 'Equipo Desarrollo Web',
      fecha_inicio: new Date('2024-01-15'),
      fecha_fin: new Date('2024-06-30'),
      creadoPorId: admin.id,
      gestorId: gestor1.id,
    },
  });

  const proyecto2 = await prisma.proyecto.create({
    data: {
      nombre: 'Migración a Cloud',
      descripcion: 'Migración de infraestructura local a servicios cloud',
      responsable: 'Administrador Principal',
      equipo: 'Equipo DevOps',
      fecha_inicio: new Date('2024-02-01'),
      fecha_fin: new Date('2024-05-15'),
      creadoPorId: admin.id, // El administrador es el creador
      gestorId: admin.id, // El administrador es el gestor (para que haya un administrador en el proyecto)
    },
  });

  const proyecto3 = await prisma.proyecto.create({
    data: {
      nombre: 'App Móvil',
      descripcion: 'Desarrollo de aplicación móvil multiplataforma',
      responsable: 'Carlos García',
      equipo: 'Equipo Mobile',
      fecha_inicio: new Date('2024-03-01'),
      fecha_fin: null,
      creadoPorId: admin.id,
      gestorId: gestor1.id,
    },
  });

  console.log(` Creados ${3} proyectos`);

  // Crear etiquetas
  console.log(' Creando etiquetas...');
  const etiquetaUrgente = await prisma.etiqueta.create({
    data: {
      nombre: 'Urgente',
      color: '#FF0000',
    },
  });

  const etiquetaBug = await prisma.etiqueta.create({
    data: {
      nombre: 'Bug',
      color: '#FF6B6B',
    },
  });

  const etiquetaFeature = await prisma.etiqueta.create({
    data: {
      nombre: 'Feature',
      color: '#4ECDC4',
    },
  });

  const etiquetaMejora = await prisma.etiqueta.create({
    data: {
      nombre: 'Mejora',
      color: '#95E1D3',
    },
  });

  await prisma.etiqueta.create({
    data: {
      nombre: 'Documentación',
      color: '#F38181',
    },
  });

  console.log(` Creadas ${5} etiquetas`);

  // Crear tareas
  console.log(' Creando tareas...');
  const tarea1 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar base de datos',
      descripcion: 'Configurar la conexión a MySQL y ejecutar migraciones iniciales',
      estado: 'Completado',
      prioridad: 'Alta',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-01-16'),
      fecha_limite: new Date('2024-01-20'),
      proyectoId: proyecto1.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea2 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar autenticación JWT',
      descripcion: 'Crear sistema de autenticación con tokens JWT y middleware de seguridad',
      estado: 'Completado',
      prioridad: 'Alta',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-01-18'),
      fecha_limite: new Date('2024-01-25'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea3 = await prisma.tarea.create({
    data: {
      titulo: 'Crear API de tareas',
      descripcion: 'Desarrollar endpoints CRUD para gestión de tareas',
      estado: 'En_progreso',
      prioridad: 'Alta',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-01-20'),
      fecha_limite: new Date('2024-02-05'),
      proyectoId: proyecto1.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea4 = await prisma.tarea.create({
    data: {
      titulo: 'Diseñar interfaz de usuario',
      descripcion: 'Crear mockups y diseño UI/UX para el tablero Kanban',
      estado: 'En_revision',
      prioridad: 'Media',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-01-22'),
      fecha_limite: new Date('2024-02-10'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea5 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar servidor de producción',
      descripcion: 'Preparar entorno de producción en AWS',
      estado: 'Pendiente',
      prioridad: 'Alta',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-02-05'),
      fecha_limite: new Date('2024-02-20'),
      proyectoId: proyecto2.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor2.id,
    },
  });

  const tarea6 = await prisma.tarea.create({
    data: {
      titulo: 'Migrar base de datos',
      descripcion: 'Migrar datos de servidor local a RDS',
      estado: 'Pendiente',
      prioridad: 'Alta',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-02-08'),
      fecha_limite: new Date('2024-02-25'),
      proyectoId: proyecto2.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor2.id,
    },
  });

  const tarea7 = await prisma.tarea.create({
    data: {
      titulo: 'Corregir bug en login',
      descripcion: 'El login falla cuando el email tiene mayúsculas',
      estado: 'En_progreso',
      prioridad: 'Urgente',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-01-25'),
      fecha_limite: new Date('2024-01-27'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: admin.id,
    },
  });

  const tarea8 = await prisma.tarea.create({
    data: {
      titulo: 'Diseñar pantalla de inicio',
      descripcion: 'Crear diseño para la pantalla principal de la app móvil',
      estado: 'Pendiente',
      prioridad: 'Media',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-03-05'),
      fecha_limite: new Date('2024-03-15'),
      proyectoId: proyecto3.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  // Agregar más tareas para poblar mejor los perfiles de usuario
  const tarea9 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar sistema de notificaciones',
      descripcion: 'Desarrollar sistema de notificaciones en tiempo real para usuarios',
      estado: 'En_progreso',
      prioridad: 'Alta',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-01-28'),
      fecha_limite: new Date('2024-02-15'),
      proyectoId: proyecto1.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea10 = await prisma.tarea.create({
    data: {
      titulo: 'Optimizar consultas de base de datos',
      descripcion: 'Revisar y optimizar las consultas SQL para mejorar el rendimiento',
      estado: 'Completado',
      prioridad: 'Media',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-01-10'),
      fecha_limite: new Date('2024-01-25'),
      proyectoId: proyecto1.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea11 = await prisma.tarea.create({
    data: {
      titulo: 'Crear tests unitarios para API',
      descripcion: 'Implementar suite de tests unitarios para los endpoints principales',
      estado: 'En_revision',
      prioridad: 'Alta',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-02-01'),
      fecha_limite: new Date('2024-02-20'),
      proyectoId: proyecto1.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea12 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar dashboard de estadísticas',
      descripcion: 'Crear panel de control con gráficos y métricas del proyecto',
      estado: 'Pendiente',
      prioridad: 'Media',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-02-12'),
      fecha_limite: new Date('2024-03-01'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea13 = await prisma.tarea.create({
    data: {
      titulo: 'Diseñar sistema de permisos',
      descripcion: 'Crear sistema de roles y permisos para diferentes tipos de usuarios',
      estado: 'Completado',
      prioridad: 'Alta',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-01-15'),
      fecha_limite: new Date('2024-01-30'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea14 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar exportación de reportes',
      descripcion: 'Agregar funcionalidad para exportar reportes en PDF y Excel',
      estado: 'En_progreso',
      prioridad: 'Media',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-02-20'),
      fecha_limite: new Date('2024-03-10'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea15 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar CI/CD pipeline',
      descripcion: 'Configurar pipeline de integración y despliegue continuo',
      estado: 'En_revision',
      prioridad: 'Alta',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-02-10'),
      fecha_limite: new Date('2024-02-28'),
      proyectoId: proyecto2.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor2.id,
    },
  });

  const tarea16 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar autenticación OAuth',
      descripcion: 'Agregar soporte para login con Google y GitHub',
      estado: 'Completado',
      prioridad: 'Media',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-01-22'),
      fecha_limite: new Date('2024-02-05'),
      proyectoId: proyecto1.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea17 = await prisma.tarea.create({
    data: {
      titulo: 'Crear documentación de API',
      descripcion: 'Generar documentación completa de la API usando Swagger',
      estado: 'Pendiente',
      prioridad: 'Baja',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-02-25'),
      fecha_limite: new Date('2024-03-20'),
      proyectoId: proyecto1.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea18 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar monitoreo y alertas',
      descripcion: 'Implementar sistema de monitoreo con Prometheus y alertas',
      estado: 'En_progreso',
      prioridad: 'Alta',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-02-15'),
      fecha_limite: new Date('2024-03-05'),
      proyectoId: proyecto2.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor2.id,
    },
  });

  // Tareas para gestores (también pueden tener tareas asignadas)
  const tarea19 = await prisma.tarea.create({
    data: {
      titulo: 'Revisar arquitectura del sistema',
      descripcion: 'Revisar y aprobar la arquitectura propuesta para el proyecto',
      estado: 'Completado',
      prioridad: 'Alta',
      asignado_a: 'Carlos García',
      fecha_creacion: new Date('2024-01-12'),
      fecha_limite: new Date('2024-01-20'),
      proyectoId: proyecto1.id,
      usuarioId: gestor1.id,
      creadoPorId: admin.id,
    },
  });

  const tarea20 = await prisma.tarea.create({
    data: {
      titulo: 'Planificar roadmap del proyecto',
      descripcion: 'Definir el roadmap y las fases del proyecto para los próximos meses',
      estado: 'En_progreso',
      prioridad: 'Alta',
      asignado_a: 'Carlos García',
      fecha_creacion: new Date('2024-02-01'),
      fecha_limite: new Date('2024-02-15'),
      proyectoId: proyecto1.id,
      usuarioId: gestor1.id,
      creadoPorId: admin.id,
    },
  });

  const tarea21 = await prisma.tarea.create({
    data: {
      titulo: 'Evaluar proveedores de cloud',
      descripcion: 'Comparar y evaluar diferentes proveedores de servicios cloud',
      estado: 'Completado',
      prioridad: 'Media',
      asignado_a: 'Ana Martínez',
      fecha_creacion: new Date('2024-01-20'),
      fecha_limite: new Date('2024-02-01'),
      proyectoId: proyecto2.id,
      usuarioId: gestor2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea22 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar políticas de seguridad',
      descripcion: 'Definir y documentar políticas de seguridad para la migración',
      estado: 'En_revision',
      prioridad: 'Alta',
      asignado_a: 'Ana Martínez',
      fecha_creacion: new Date('2024-02-05'),
      fecha_limite: new Date('2024-02-18'),
      proyectoId: proyecto2.id,
      usuarioId: gestor2.id,
      creadoPorId: gestor1.id,
    },
  });

  // Más tareas para empleado1
  const tarea23 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar búsqueda avanzada',
      descripcion: 'Agregar funcionalidad de búsqueda con filtros múltiples',
      estado: 'Pendiente',
      prioridad: 'Media',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-02-18'),
      fecha_limite: new Date('2024-03-05'),
      proyectoId: proyecto1.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea24 = await prisma.tarea.create({
    data: {
      titulo: 'Crear componentes reutilizables',
      descripcion: 'Desarrollar biblioteca de componentes UI reutilizables',
      estado: 'En_progreso',
      prioridad: 'Media',
      asignado_a: 'Juan Pérez',
      fecha_creacion: new Date('2024-02-22'),
      fecha_limite: new Date('2024-03-12'),
      proyectoId: proyecto3.id,
      usuarioId: empleado1.id,
      creadoPorId: gestor1.id,
    },
  });

  // Más tareas para empleado2
  const tarea25 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar sistema de comentarios',
      descripcion: 'Desarrollar funcionalidad de comentarios en tiempo real',
      estado: 'Completado',
      prioridad: 'Alta',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-01-25'),
      fecha_limite: new Date('2024-02-08'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea26 = await prisma.tarea.create({
    data: {
      titulo: 'Optimizar rendimiento del frontend',
      descripcion: 'Mejorar el rendimiento de la aplicación React',
      estado: 'Pendiente',
      prioridad: 'Media',
      asignado_a: 'Laura Sánchez',
      fecha_creacion: new Date('2024-02-28'),
      fecha_limite: new Date('2024-03-18'),
      proyectoId: proyecto1.id,
      usuarioId: empleado2.id,
      creadoPorId: gestor1.id,
    },
  });

  // Más tareas para empleado3
  const tarea27 = await prisma.tarea.create({
    data: {
      titulo: 'Implementar caché de datos',
      descripcion: 'Agregar sistema de caché para mejorar el rendimiento',
      estado: 'Completado',
      prioridad: 'Media',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-01-30'),
      fecha_limite: new Date('2024-02-12'),
      proyectoId: proyecto1.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor1.id,
    },
  });

  const tarea28 = await prisma.tarea.create({
    data: {
      titulo: 'Configurar backup automático',
      descripcion: 'Implementar sistema de respaldo automático de la base de datos',
      estado: 'En_progreso',
      prioridad: 'Alta',
      asignado_a: 'Pedro López',
      fecha_creacion: new Date('2024-02-20'),
      fecha_limite: new Date('2024-03-08'),
      proyectoId: proyecto2.id,
      usuarioId: empleado3.id,
      creadoPorId: gestor2.id,
    },
  });

  console.log(` Creadas ${28} tareas`);

  // Asignar etiquetas a tareas
  console.log(' Asignando etiquetas a tareas...');
  await prisma.tareaEtiqueta.createMany({
    data: [
      { tareaId: tarea1.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea2.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea3.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea4.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea5.id, etiquetaId: etiquetaUrgente.id },
      { tareaId: tarea6.id, etiquetaId: etiquetaUrgente.id },
      { tareaId: tarea7.id, etiquetaId: etiquetaBug.id },
      { tareaId: tarea8.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea9.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea10.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea11.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea12.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea13.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea14.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea15.id, etiquetaId: etiquetaUrgente.id },
      { tareaId: tarea16.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea17.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea18.id, etiquetaId: etiquetaUrgente.id },
      { tareaId: tarea19.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea20.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea21.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea22.id, etiquetaId: etiquetaUrgente.id },
      { tareaId: tarea23.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea24.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea25.id, etiquetaId: etiquetaFeature.id },
      { tareaId: tarea26.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea27.id, etiquetaId: etiquetaMejora.id },
      { tareaId: tarea28.id, etiquetaId: etiquetaUrgente.id },
    ],
  });

  console.log(` Etiquetas asignadas`);

  // Crear comentarios
  console.log(' Creando comentarios...');
  const comentario1 = await prisma.comentario.create({
    data: {
      contenido: 'Base de datos configurada correctamente. Todas las migraciones ejecutadas sin errores.',
      tareaId: tarea1.id,
      usuarioId: empleado1.id,
    },
  });

  await prisma.comentario.create({
    data: {
      contenido: 'Autenticación implementada. Pendiente revisar seguridad de tokens.',
      tareaId: tarea2.id,
      usuarioId: empleado2.id,
    },
  });

  await prisma.comentario.create({
    data: {
      contenido: 'Necesito más información sobre los requerimientos de la API.',
      tareaId: tarea3.id,
      usuarioId: empleado3.id,
    },
  });

  await prisma.comentario.create({
    data: {
      contenido: 'Bug identificado y en proceso de corrección.',
      tareaId: tarea7.id,
      usuarioId: empleado2.id,
    },
  });

  console.log(` Creados ${4} comentarios`);

  // Crear archivos
  console.log(' Creando archivos...');
  await prisma.archivo.create({
    data: {
      nombre: 'diagrama-bd.png',
      url: '/uploads/diagrama-bd.png',
      tipo: 'image/png',
      tamaño: 245760,
      tareaId: tarea1.id,
    },
  });

  await prisma.archivo.create({
    data: {
      nombre: 'mockup-ui.pdf',
      url: '/uploads/mockup-ui.pdf',
      tipo: 'application/pdf',
      tamaño: 1024000,
      tareaId: tarea4.id,
    },
  });

  await prisma.archivo.create({
    data: {
      nombre: 'bug-report.md',
      url: '/uploads/bug-report.md',
      tipo: 'text/markdown',
      tamaño: 5120,
      tareaId: tarea7.id,
    },
  });

  console.log(` Creados ${3} archivos`);

  // Crear logs de actividad
  console.log(' Creando logs de actividad...');
  await prisma.logActividad.createMany({
    data: [
      {
        accion: 'crear',
        entidad: 'Tarea',
        entidadId: tarea1.id,
        descripcion: `Tarea "Configurar base de datos" creada por ${gestor1.nombreCompleto} en el proyecto "${proyecto1.nombre}"`,
        usuarioId: gestor1.id,
      },
      {
        accion: 'cambiar_estado',
        entidad: 'Tarea',
        entidadId: tarea1.id,
        campo: 'estado',
        valorAnterior: 'Pendiente',
        valorNuevo: 'Completado',
        descripcion: `Estado de la tarea "Configurar base de datos" cambiado a Completado por ${empleado1.nombreCompleto}`,
        usuarioId: empleado1.id,
      },
      {
        accion: 'crear',
        entidad: 'Tarea',
        entidadId: tarea2.id,
        descripcion: `Tarea "Implementar autenticación JWT" creada por ${gestor1.nombreCompleto} en el proyecto "${proyecto1.nombre}"`,
        usuarioId: gestor1.id,
      },
      {
        accion: 'cambiar_estado',
        entidad: 'Tarea',
        entidadId: tarea2.id,
        campo: 'estado',
        valorAnterior: 'En_progreso',
        valorNuevo: 'Completado',
        descripcion: `Estado de la tarea "Implementar autenticación JWT" cambiado a Completado por ${empleado2.nombreCompleto}`,
        usuarioId: empleado2.id,
      },
      {
        accion: 'crear',
        entidad: 'Proyecto',
        entidadId: proyecto1.id,
        descripcion: `Proyecto "${proyecto1.nombre}" creado por ${admin.nombreCompleto}`,
        usuarioId: admin.id,
      },
      {
        accion: 'crear',
        entidad: 'Comentario',
        entidadId: comentario1.id,
        descripcion: `Comentario agregado a la tarea "Configurar base de datos" por ${empleado1.nombreCompleto}`,
        usuarioId: empleado1.id,
      },
    ],
  });

  console.log(` Creados ${6} logs de actividad`);

  // Crear sprints
  console.log(' Creando sprints...');
  const sprint1 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Alpha - Fundación',
      descripcion: 'Sprint inicial para establecer la base del proyecto',
      fecha_inicio: new Date('2025-04-15'),
      fecha_fin: new Date('2025-04-29'),
      estado: 'Completado',
      proyectoId: proyecto1.id,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Beta - Autenticación',
      descripcion: 'Desarrollo del sistema de autenticación y seguridad',
      fecha_inicio: new Date('2025-04-29'),
      fecha_fin: new Date('2025-05-13'),
      estado: 'Completado',
      proyectoId: proyecto1.id,
    },
  });

  const sprint3 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Gamma - API Core',
      descripcion: 'Desarrollo de las APIs principales del sistema',
      fecha_inicio: new Date('2025-05-13'),
      fecha_fin: new Date('2025-05-27'),
      estado: 'En_progreso',
      proyectoId: proyecto1.id,
    },
  });

  const sprint4 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Delta - UI/UX',
      descripcion: 'Diseño e implementación de la interfaz de usuario',
      fecha_inicio: new Date('2025-05-27'),
      fecha_fin: new Date('2025-06-10'),
      estado: 'Pendiente',
      proyectoId: proyecto1.id,
    },
  });

  const sprint5 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Cloud Migration',
      descripcion: 'Migración de servicios a la nube',
      fecha_inicio: new Date('2025-05-01'),
      fecha_fin: new Date('2025-05-15'),
      estado: 'En_progreso',
      proyectoId: proyecto2.id,
    },
  });

  const sprint6 = await prisma.sprint.create({
    data: {
      nombre: 'Sprint Mobile Foundation',
      descripcion: 'Configuración inicial del proyecto móvil',
      fecha_inicio: new Date('2025-06-01'),
      fecha_fin: new Date('2025-06-15'),
      estado: 'Pendiente',
      proyectoId: proyecto3.id,
    },
  });

  console.log(` Creados ${6} sprints`);

  // Crear releases
  console.log(' Creando releases...');
  const release1 = await prisma.release.create({
    data: {
      nombre: 'Versión 1.0 - Lanzamiento Inicial',
      descripcion: 'Primera versión del sistema con funcionalidades básicas de gestión de tareas y proyectos',
      fecha_inicio: new Date('2025-04-15'),
      fecha_lanzamiento: new Date('2025-06-15'),
      estado: 'En_progreso',
      proyectoId: proyecto1.id,
    },
  });

  await prisma.release.create({
    data: {
      nombre: 'Versión 1.5 - Mejoras de Rendimiento',
      descripcion: 'Optimización de consultas y mejoras en el rendimiento general del sistema',
      fecha_inicio: new Date('2025-06-15'),
      fecha_lanzamiento: new Date('2025-07-15'),
      estado: 'Sin_lanzar',
      proyectoId: proyecto1.id,
    },
  });

  const release3 = await prisma.release.create({
    data: {
      nombre: 'Versión 2.0 - Integración Cloud',
      descripcion: 'Integración completa con servicios cloud y migración de infraestructura',
      fecha_inicio: new Date('2025-05-01'),
      fecha_lanzamiento: new Date('2025-08-15'),
      estado: 'En_progreso',
      proyectoId: proyecto2.id,
    },
  });

  const release4 = await prisma.release.create({
    data: {
      nombre: 'Versión 0.5 - MVP Móvil',
      descripcion: 'Versión mínima viable de la aplicación móvil con funcionalidades básicas',
      fecha_inicio: new Date('2025-06-01'),
      fecha_lanzamiento: new Date('2025-07-30'),
      estado: 'Sin_lanzar',
      proyectoId: proyecto3.id,
    },
  });

  await prisma.release.create({
    data: {
      nombre: 'Versión 1.2 - Panel de Analítica',
      descripcion: 'Nuevo panel de analítica avanzada y automatización de reportes',
      fecha_inicio: new Date('2025-07-15'),
      fecha_lanzamiento: new Date('2025-08-30'),
      estado: 'Sin_lanzar',
      proyectoId: proyecto1.id,
    },
  });

  await prisma.release.create({
    data: {
      nombre: 'Versión 0.9 - Beta Cloud',
      descripcion: 'Versión beta de la migración cloud para pruebas internas',
      fecha_inicio: new Date('2025-07-01'),
      fecha_lanzamiento: new Date('2025-07-20'),
      estado: 'En_progreso',
      proyectoId: proyecto2.id,
    },
  });

  console.log(` Creados ${6} releases`);

  // Asignar tareas a sprints
  console.log(' Asignando tareas a sprints...');
  await prisma.tarea.update({
    where: { id: tarea1.id },
    data: { sprintId: sprint1.id },
  });

  await prisma.tarea.update({
    where: { id: tarea2.id },
    data: { sprintId: sprint1.id },
  });

  await prisma.tarea.update({
    where: { id: tarea3.id },
    data: { sprintId: sprint3.id },
  });

  await prisma.tarea.update({
    where: { id: tarea4.id },
    data: { sprintId: sprint4.id },
  });

  await prisma.tarea.update({
    where: { id: tarea5.id },
    data: { sprintId: sprint5.id },
  });

  await prisma.tarea.update({
    where: { id: tarea6.id },
    data: { sprintId: sprint5.id },
  });

  await prisma.tarea.update({
    where: { id: tarea7.id },
    data: { sprintId: sprint2.id },
  });

  await prisma.tarea.update({
    where: { id: tarea8.id },
    data: { sprintId: sprint6.id },
  });

  console.log(` Tareas asignadas a sprints`);

  // Asignar tareas a releases
  console.log(' Asignando tareas a releases...');
  await prisma.tareaRelease.createMany({
    data: [
      { tareaId: tarea1.id, releaseId: release1.id },
      { tareaId: tarea2.id, releaseId: release1.id },
      { tareaId: tarea3.id, releaseId: release1.id },
      { tareaId: tarea4.id, releaseId: release1.id },
      { tareaId: tarea7.id, releaseId: release1.id },
      { tareaId: tarea5.id, releaseId: release3.id },
      { tareaId: tarea6.id, releaseId: release3.id },
      { tareaId: tarea8.id, releaseId: release4.id },
    ],
  });

  console.log(` Tareas asignadas a releases`);

  console.log('\n Seed completado exitosamente!');
  console.log('\n Resumen:');
  console.log(`   - ${6} usuarios creados`);
  console.log(`   - ${3} proyectos creados`);
  console.log(`   - ${28} tareas creadas`);
  console.log(`   - ${5} etiquetas creadas`);
  console.log(`   - ${4} comentarios creados`);
  console.log(`   - ${3} archivos creados`);
  console.log(`   - ${6} logs de actividad creados`);
  console.log(`   - ${6} sprints creados`);
  console.log(`   - ${6} releases creados`);
  console.log('\n Distribución de tareas por usuario:');
  console.log('   - Juan Pérez (empleado1): 8 tareas');
  console.log('   - Laura Sánchez (empleado2): 7 tareas');
  console.log('   - Pedro López (empleado3): 7 tareas');
  console.log('   - Carlos García (gestor1): 2 tareas');
  console.log('   - Ana Martínez (gestor2): 2 tareas');
  console.log('\n Credenciales de prueba:');
  console.log('   Admin: admin@kanban.com / admin123');
  console.log('   Empleado (gestor proyecto 1): carlos.garcia@kanban.com / empleado123');
  console.log('   Empleado (gestor proyecto 2): ana.martinez@kanban.com / empleado123');
  console.log('   Empleado: empleado1@kanban.com / empleado123');
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR durante el seed:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(e.message || e);
    if (e.stack) {
      console.error('\nStack trace:');
      console.error(e.stack);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('\n💡 Verifica que:');
    console.error('   1. El archivo .env existe y tiene DATABASE_URL configurada');
    console.error('   2. La base de datos esté creada');
    console.error('   3. Las migraciones estén aplicadas (npm run prisma:migrate)');
    console.error('   4. El servidor MySQL esté corriendo');
    console.error('   5. Las credenciales en DATABASE_URL sean correctas\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

