Backend del proyecto Kanban 

### Requisitos previos
- Node.js (versión compatible)
- MySQL (base de datos)
- npm o yarn

<details>
  <summary>Instalación</summary>

```bash
npm run setup 
```

O manualmente:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Configura las variables de entorno y arranca con `npm run dev`
</details>
<details>
  <summary>Características</summary>
- Base de datos MySQL con Prisma ORM
- Autenticación JWT
- Recuperación de contraseña por email
- Validación con Zod
- Roles de usuario (Administrador, Gestor de Proyecto, Empleado)
</details>
<details>
  <summary>Roles y Permisos</summary>

### Usuario empleado:
- Ver tablero y tareas
- Cambiar estados, columnas
- Tiene tareas asignadas 
- Puede loguearse 
ejemplo: empleado1@kanban.com //   contraseña: empleado123

### Admin/Gestor:
Acciones de usuario empleado +
- Configurar flujos de trabajo
- Crear/borrar tableros
- Gestionar usuarios y permisos
- Configurar automatizaciones
- Tiene logs de actividad
ejemplo: admin@kanban.com //   contraseña: admin123
ejemplo: carlos.garcia@kanban.com //   contraseña: empleado123

### Proyecto:
- Estadísticas simples (tareas completadas por semana)
</details>
<details>
  <summary>Scripts</summary>

- `npm run setup`: Instalación completa (dependencias + Prisma + migraciones)
- `npm run dev`: Desarrollo con nodemon (usa ts-node, no requiere compilación)
- `npm run build`: Compilar TypeScript para producción (con source maps)
- `npm run build:dev`: Compilar TypeScript sin source maps (más rápido)
- `npm run clean`: Eliminar carpeta dist/ (útil para liberar espacio)
- `npm start`: Ejecutar en producción (requiere `npm run build` primero)
- `npm run prisma:generate`: Generar cliente Prisma
- `npm run prisma:migrate`: Ejecutar migraciones
- `npm run prisma:studio`: Abrir Prisma Studio
- `npm run prisma:seed`: Ejecutar seed de base de datos
</details>
<details>
  <summary>Estructura del Proyecto</summary>

El proyecto sigue una estructura organizada:

- **`docs/`** - Documentación adicional (optimizaciones, guías de prueba, referencias)
- **`scripts/`** - Scripts de utilidad (corrección MySQL)
- **`src/`** - Código fuente principal
  - **`src/templates/emails/`** - Templates de email HTML simples
- **`prisma/`** - Configuración y migraciones de base de datos
- **`dist/`** - Build de producción (generado)
- **`uploads/`** - Archivos subidos por usuarios
- **`tsconfig/`** - Configuración de TypeScript para producción

**Archivos de configuración:**
- **`tsconfig.json`** - Configuración base de TypeScript (raíz)

Ver `ESTRUCTURA_PROYECTO.md` para más detalles.
</details>
<details>
  <summary>Variables de Entorno</summary>

Copia el archivo `.env.example` a `.env` y configura las variables:

```env
# Requeridas
DATABASE_URL=mysql://user:password@localhost:3306/database
JWT_SECRET=secret-key

# Opcionales
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production|development
CORS_ORIGIN=http://localhost:3000,https://tu-dominio.com

# Email (opcionales - si no se configuran, se usa Ethereal Email en desarrollo)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-contraseña-app
EMAIL_FROM=noreply@kanban.local
EMAIL_FROM_NAME=Sistema Kanban
FRONTEND_URL=http://localhost:3000
```

**Importante**: 
- El servidor valida que las variables críticas (`DATABASE_URL`, `JWT_SECRET`) estén presentes al iniciar.
- En producción, `JWT_SECRET` debe tener al menos 16 caracteres.
- Si no configuras las variables de email, se usará Ethereal Email (servicio de prueba) en desarrollo. Los emails no se enviarán realmente, solo se generarán URLs de preview.

</details>
<details>
  <summary>Token github</summary>

**GitHub Integration:**

Para acceder a repositorios privados de GitHub, necesitas configurar un token de acceso personal (PAT).

**Cómo obtener un token:**

1. Ve a **GitHub** → **Settings** → **Developer settings** → **Personal access tokens**
2. **Fine-grained tokens** (recomendado):
   - Click en **Fine-grained tokens** → **Generate new token**
   - Selecciona los repositorios que necesitas
   - Permisos: **Contents: Read-only** (para leer commits)
3. **Classic tokens** (alternativa):
   - Click en **Tokens (classic)** → **Generate new token (classic)**
   - Scope: **`repo`** (para repos privados) o **`public_repo`** (solo públicos)
4. **Copia el token inmediatamente** (solo se muestra una vez, comienza con `ghp_`)

**Configuración:**

- **Desarrollo**: Añade a `.env` → `GITHUB_TOKEN=ghp_...`
- **Producción**: Usa la interfaz de administración (se cifra automáticamente en BD)

**Permisos necesarios:**

- **Repos públicos**: Token opcional
- **Repos privados**: Fine-grained PAT con `Contents: Read-only` o Classic PAT con scope `repo`

**Seguridad:** Nunca subas tokens al repositorio. Usa mínimos permisos necesarios.

📚 Más detalles: [`GITHUB_TOKENS.md`](./GITHUB_TOKENS.md) | [`GITHUB_INTEGRATION.md`](./GITHUB_INTEGRATION.md)
</details>