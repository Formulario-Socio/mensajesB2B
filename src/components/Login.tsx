import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { Lock, Mail, Sparkles, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, ingresa tu correo y contraseña.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        if (authError.message === "Invalid login credentials") {
          throw new Error("Credenciales inválidas. Por favor verifica tu correo y contraseña.");
        }
        throw authError;
      }

      if (data.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Ocurrió un error al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg relative overflow-hidden px-4">
      {/* Decorative premium gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-gradient-to-tr from-brand-blue/15 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-gradient-to-bl from-brand-blue/10 to-transparent blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-brand-surface rounded-2xl border border-brand-muted/15 shadow-2xl shadow-brand-blue/5 p-8 relative z-10 animate-fade-in">
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue mb-4 border border-brand-blue/20 glow-indigo">
            <Lock className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="h-2 w-2 rounded-full bg-brand-blue animate-pulse"></span>
            <h2 className="text-2xl font-black font-display text-brand-text uppercase tracking-tight">
              Control de Acceso
            </h2>
          </div>
          <p className="text-[10px] text-brand-muted font-mono uppercase tracking-widest mt-1 text-center">
            Centro de Comando B2B • Acceso Privado
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs md:text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error de autenticación</p>
              <p className="mt-0.5 text-red-650">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-brand-muted pointer-events-none">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full pl-10 pr-4 py-3 bg-brand-bg rounded-xl border border-brand-muted/15 text-brand-text text-sm placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-brand-muted pointer-events-none">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-brand-bg rounded-xl border border-brand-muted/15 text-brand-text text-sm placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-muted hover:text-brand-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-xl font-bold text-sm tracking-wide uppercase shadow-lg shadow-brand-blue/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Entrar al Centro de Comando</span>
              </>
            )}
          </button>
        </form>

        {/* Security Help Footer */}
        <div className="mt-8 pt-6 border-t border-brand-muted/10 text-center">
          <p className="text-[11px] text-slate-550 leading-relaxed max-w-xs mx-auto">
            Esta base de datos cuenta con seguridad **Row Level Security (RLS)** y cifrado SSL. Tus credenciales son administradas directamente por Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
