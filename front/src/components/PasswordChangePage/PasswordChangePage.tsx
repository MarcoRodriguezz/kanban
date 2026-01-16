import React, { useState } from 'react';
import { resetPassword } from '../../services/api';

type PasswordChangePageProps = {
  onBackToLogin?: () => void;
  resetToken?: string;
};

const PasswordChangePage: React.FC<PasswordChangePageProps> = ({ onBackToLogin, resetToken }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      return;
    }

    if (!resetToken) {
      setError('Token de reset no válido. Por favor, solicita un nuevo enlace de recuperación.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(resetToken, password, confirmPassword);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const isMismatch = password !== '' && confirmPassword !== '' && password !== confirmPassword;

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
            <h2 className="text-3xl font-semibold text-slate-900">Crea tu nueva contraseña</h2>
            <p className="text-sm text-slate-500">
              Ingresa una contraseña segura y confírmala para finalizar el proceso.
            </p>
          </header>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              Nueva contraseña
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              Confirmar contraseña
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              />
            </label>

            {isMismatch && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                Las contraseñas no coinciden. Intenta nuevamente.
              </p>
            )}

            {error && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </p>
            )}

            {submitted && !isMismatch && !error && (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                ¡Listo! Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={password === '' || confirmPassword === '' || isLoading || submitted}
            >
              {isLoading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>

          <footer className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 sm:flex-row sm:justify-center">
            <span>¿Todo listo?</span>
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

export default PasswordChangePage;

