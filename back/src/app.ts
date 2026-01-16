/**
 * Configuración principal de la aplicación Express: middleware de seguridad, CORS, compresión, logging y rutas.
 * Orquesta todos los middlewares y endpoints de la API, con manejo centralizado de errores.
 */
import express, { Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import authRoutes from './routes/auth.routes';
import tareaRoutes from './routes/tarea.routes';
import proyectoRoutes from './routes/proyecto.routes';
import actividadRoutes from './routes/actividad.routes';
import comentarioRoutes from './routes/comentario.routes';
import archivoRoutes from './routes/archivo.routes';
import etiquetaRoutes from './routes/etiqueta.routes';
import estadisticasRoutes from './routes/estadisticas.routes';
import releaseRoutes from './routes/release.routes';
import sprintRoutes from './routes/sprint.routes';
import componentRoutes from './routes/component.routes';
import { servirImagenComponente } from './controllers/component.controller';
import healthRoutes from './routes/health.routes';
import githubRoutes from './routes/github.routes';
import githubTokenRoutes from './routes/github-token.routes';
import repositorioRoutes from './routes/repositorio.routes';
import notificacionRoutes from './routes/notificacion.routes';
import issueRoutes from './routes/issue.routes';
import { getProjectCommits } from './controllers/github.controller';
import { authenticateToken, requireAnyRole } from './middleware/auth.middleware';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { env } from './config/env';
import { standardRateLimiter } from './middleware/rate-limit.middleware';
import { SERVER_CONSTANTS } from './utils/constants';

const app: Express = express();

app.set('trust proxy', 1);

// Request logging (debe ir antes de las rutas)
app.use(requestLogger);

app.use(helmet({
  contentSecurityPolicy: env.isProduction ? undefined : false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir que las imágenes se carguen desde otros orígenes
  crossOriginEmbedderPolicy: false, // Desactivar para permitir carga de imágenes
}));

// Compression respuestas HTTP
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: SERVER_CONSTANTS.COMPRESSION_LEVEL,
  threshold: SERVER_CONSTANTS.COMPRESSION_THRESHOLD_BYTES,
}));

// Configuración CORS optimizada
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (env.isDevelopment || env.corsOrigin.includes('*')) {
      return callback(null, true);
    }
    if (!origin || env.corsOrigin.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Servir archivos estáticos con headers CORS para imágenes
// IMPORTANTE: Las imágenes estáticas no requieren credentials, así que podemos usar '*' si es necesario
app.use('/uploads', (req, res, next) => {
  // Agregar headers CORS para permitir que el frontend cargue las imágenes
  const origin = req.headers.origin;
  
  // Determinar el origen permitido
  if (env.isDevelopment || env.corsOrigin.includes('*')) {
    // En desarrollo o si está permitido cualquier origen, usar el origen del request o '*'
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  } else if (origin && env.corsOrigin.includes(origin)) {
    // En producción, usar el origen específico si está en la lista permitida
    res.header('Access-Control-Allow-Origin', origin);
  } else if (env.corsOrigin.length > 0) {
    // Si hay orígenes específicos configurados, usar el primero
    res.header('Access-Control-Allow-Origin', env.corsOrigin[0]);
  } else {
    // Fallback: permitir cualquier origen
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  // NO usar credentials para archivos estáticos (no es necesario y causa problemas con '*')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}, express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    // Asegurar que las imágenes tengan el tipo MIME correcto
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// Parsing de JSON y URL encoded (pero NO para multipart/form-data que multer maneja)
// IMPORTANTE: express.json() y express.urlencoded() deben ir ANTES de las rutas
// pero deben saltarse multipart/form-data para que multer lo maneje
const jsonParser = express.json({ limit: '25mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '25mb' });

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  // No parsear el body si es multipart/form-data (multer lo maneja)
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  jsonParser(req, res, (err) => {
    if (err) return next(err);
    urlencodedParser(req, res, next);
  });
});

// Rate limiting global (aplicado a todas las rutas excepto las que tienen su propio rate limiter)
// Desactivado en modo desarrollo para evitar errores 429 durante desarrollo
if (process.env.NODE_ENV === 'production') {
  app.use('/api', standardRateLimiter);
}

// En producción, servir el frontend construido
if (env.isProduction) {
  const frontendBuildPath = path.join(process.cwd(), '..', 'front', 'build');
  app.use(express.static(frontendBuildPath));
}

// Ruta de prueba (en desarrollo)
if (env.isDevelopment) {
  app.get('/', (_req, res) => {
    res.json({ 
      message: 'API Kanban funcionando correctamente',
      version: '1.0.0'
    });
  });
}

// Health check (sin rate limiting)
app.use('/health', healthRoutes);

// Rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/actividad', actividadRoutes);
app.use('/api/comentarios', comentarioRoutes);
app.use('/api/archivos', archivoRoutes);
app.use('/api/etiquetas', etiquetaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/sprints', sprintRoutes);

// Log de rutas de releases (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  console.log('✅ Rutas de releases montadas en /api/releases');
  console.log('  GET    /api/releases/page/:proyectoId');
  console.log('  POST   /api/releases/timeline/:proyectoId/calcular-fechas');
  console.log('  GET    /api/releases');
  console.log('  POST   /api/releases');
  console.log('  GET    /api/releases/:id');
  console.log('  PUT    /api/releases/:id');
  console.log('  DELETE /api/releases/:id');
  console.log('✅ Rutas de sprints montadas en /api/sprints');
  console.log('  POST   /api/sprints');
  console.log('  PUT    /api/sprints/:id');
  console.log('  DELETE /api/sprints/:id');
}

// Registrar la ruta de imágenes de componentes ANTES del router para asegurar que se capture correctamente
// Esta ruta debe ir ANTES de app.use('/api/componentes', componentRoutes) para que Express la capture primero
app.get('/api/componentes/imagen/:filename', servirImagenComponente);

app.use('/api/componentes', componentRoutes);
app.use('/api/repositorios', repositorioRoutes);
app.use('/api/notificacion', notificacionRoutes);
app.use('/api/issues', issueRoutes);

// Rutas de GitHub: las más específicas PRIMERO para evitar conflictos
// Registrar la ruta de commits directamente PRIMERO (antes de cualquier otra ruta de GitHub)
app.get('/api/github/projects/:projectId/commits', 
  authenticateToken,
  requireAnyRole,
  getProjectCommits
);

// Luego las otras rutas de GitHub
app.use('/api/github/tokens', githubTokenRoutes);
app.use('/api/github', githubRoutes);

// En producción, servir index.html para todas las rutas que no sean de la API (SPA routing)
// Debe ir antes del notFoundHandler para que las rutas del frontend funcionen
if (env.isProduction) {
  const frontendBuildPath = path.join(process.cwd(), '..', 'front', 'build');
  app.get('*', (req, res, next) => {
    // Si es una ruta de la API, continuar al siguiente middleware
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Si el archivo existe, servirlo
    res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}

// Middleware de manejo de errores (debe ir después de todas las rutas)
// Manejar rutas no encontradas (404) - solo para rutas de API
app.use(notFoundHandler);

// Manejar errores no capturados
app.use(errorHandler);

export default app;

