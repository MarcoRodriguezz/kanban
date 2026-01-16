/**
 * Punto de entrada del servidor Express.
 * Importa la aplicación configurada desde app.ts y la inicia.
 */
import app from './src/app';
import { env } from './src/config/env';

const PORT = env.port || 3001;

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${env.nodeEnv}`);
  console.log(`CORS origin: ${env.corsOrigin}`);
});