import React, { useState } from 'react';
import { forgotPassword } from '../../services/api';

type ForgotPasswordPageProps = {
  onBackToLogin?: () => void;
  onAccessWithEmail?: () => void;
};

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onBackToLogin,
  onAccessWithEmail,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    
    if (!email.trim()) {
      setSubmitted(false);
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de recuperación. Por favor, intenta de nuevo.');
      setSubmitted(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-[#0b3d91] to-[#1f8ecd] text-slate-900 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden min-h-full items-center justify-center bg-slate-950/25 px-8 py-16 text-slate-100 lg:flex lg:px-12">
        <img
          src="/img/kanban-image.svg"
          alt="Ilustración de tableros Kanban"
          className="w-full max-w-lg drop-shadow-2xl"
        />
      </section>

      <section className="relative flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="absolute right-6 top-6 z-10 sm:right-12 sm:top-12">
          <button
            type="button"
            onClick={onAccessWithEmail}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            Acceder con mi correo
          </button>
        </div>

        <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl shadow-slate-900/15 backdrop-blur">
          <header className="space-y-3 text-center sm:text-left">
            <h2 className="text-3xl font-semibold text-slate-900">¿Olvidaste tu contraseña?</h2>
            <p className="text-sm text-slate-500">
              Ingresa el correo con el que te registraste y te enviaremos instrucciones para restablecerla.
            </p>
          </header>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              Correo electrónico
              <input
                type="email"
                name="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (submitted) {
                    setSubmitted(false);
                  }
                }}
                required
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </p>
            )}

            {submitted && !error && (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Si el correo existe en nuestra base de datos, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || submitted}
            >
              {isLoading ? 'Enviando...' : 'Enviarme instrucciones'}
            </button>
          </form>

          <footer className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 sm:flex-row sm:justify-center">
            <span>¿Recordaste tu contraseña?</span>
            <button
              type="button"
              onClick={onBackToLogin}
              className="font-semibold text-blue-600 hover:text-blue-500 hover:underline"
            >
              Volver a iniciar sesión
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
};

export default ForgotPasswordPage;

