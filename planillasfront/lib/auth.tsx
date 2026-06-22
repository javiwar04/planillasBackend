"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setSession, clearSession, getStoredUser, getToken } from "./api";
import type { LoginResponse, Usuario } from "./types";

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Restaura la sesión guardada al montar.
  useEffect(() => {
    if (getToken()) setUsuario(getStoredUser<Usuario>());
    setCargando(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setSession(res.token, res.usuario);
    setUsuario(res.usuario);
  }

  function logout() {
    clearSession();
    setUsuario(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
