import React, { useState, useEffect } from 'react';
import { login, LoginCredentials } from '../../services/api';

type LoginPageProps = {
  onForgotPassword?: () => void;
  onLogin?: () => void;
};

const LoginPage: React.FC<LoginPageProps> = ({ onForgotPassword, onLogin }) => {
  // Cargar email recordado si existe
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('rememberedEmail') || '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('rememberedEmail');
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validación básica antes de enviar
    if (!email.trim()) {
      setError('El email es requerido');
      setIsLoading(false);
      return;
    }
    
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const credentials: LoginCredentials = {
        email: email.trim(),
        contraseña: password,
      };

      const response = await login(credentials);
      
      // Verificar que la respuesta tenga el token
      if (!response || !response.token) {
        throw new Error('La respuesta del servidor no contiene un token válido');
      }
      
      // Guardar el token
      localStorage.setItem('token', response.token);
      
      // Si el usuario quiere que lo recordemos, guardar el email
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email.trim());
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Llamar al callback de login exitoso ANTES de disparar el evento
      // Esto evita que el listener de tokenChanged se ejecute antes de que onLogin termine
      if (onLogin) {
        try {
          await onLogin();
        } catch (error) {
          console.error('Error en onLogin callback:', error);
          throw error; // Re-lanzar el error para que se maneje en el catch del handleSubmit
        }
      }
      
      // Disparar evento personalizado DESPUÉS de que onLogin termine
      // para notificar a otros componentes que el token cambió
      // Solo si onLogin se completó exitosamente
      window.dispatchEvent(new Event('tokenChanged'));
    } catch (err: any) {
      console.error('Error completo en login:', err);
      console.error('Stack trace:', err.stack);
      
      // Mejorar el mensaje de error
      let errorMessage = 'Error al iniciar sesión. Verifica tus credenciales.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.error) {
        errorMessage = err.error;
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica que el servidor esté funcionando.';
      }
      
      setError(errorMessage);
      
      // Si es un error de rate limiting, iniciar el contador regresivo
      if (err.isRateLimit && err.retryAfter) {
        setRetryAfter(err.retryAfter);
      } else {
        setRetryAfter(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para el contador regresivo
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter]);

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-[#0b3d91] to-[#1f8ecd] text-slate-900 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden min-h-full items-center justify-center bg-slate-950/25 px-8 py-16 text-slate-100 lg:flex lg:px-12">
        <img
          src="/img/kanban-image.svg"
          alt="Ilustración de tableros Kanban"
          className="w-full max-w-lg drop-shadow-2xl"
        />
      </section>

      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl shadow-slate-900/15 backdrop-blur">
          <header className="space-y-3 text-center sm:text-left">
            <h2 className="text-3xl font-semibold text-slate-900">Inicia sesión</h2>
          </header>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {error}
                    {retryAfter !== null && retryAfter > 0 && (
                      <div className="mt-2 font-semibold">
                        Tiempo restante: <span className="text-rose-800">{retryAfter}</span> segundo{retryAfter !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              Correo electrónico
              <input
                type="email"
                name="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                  setRetryAfter(null);
                }}
                required
                disabled={isLoading}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              Contraseña
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                  setRetryAfter(null);
                }}
                required
                minLength={6}
                disabled={isLoading}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </label>

            <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/40"
                />
                Recordarme
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="font-semibold text-blue-600 hover:text-blue-500 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || (retryAfter !== null && retryAfter > 0)}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Iniciando sesión...' : retryAfter !== null && retryAfter > 0 ? `Espera ${retryAfter}s...` : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;

