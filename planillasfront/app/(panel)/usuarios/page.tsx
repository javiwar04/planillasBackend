"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { IconPlus } from "@/components/icons";
import { usePaginado, Paginacion } from "@/components/Paginacion";
import type { Usuario, UsuarioCreate, Rol } from "@/lib/types";

const ROLES: Rol[] = ["ADMIN", "CONTABILIDAD", "CAPTURA", "RRHH", "LECTURA"];
const ROL_DESC: Record<Rol, string> = {
  ADMIN: "Acceso total y gestión de usuarios",
  CONTABILIDAD: "Opera nómina y reportes",
  CAPTURA: "Captura datos",
  RRHH: "Recursos Humanos (incluye desempeño)",
  LECTURA: "Solo consulta",
};
const VACIO: UsuarioCreate = { nombre: "", email: "", rol: "CAPTURA", password: "" };

export default function UsuariosPage() {
  const { usuario: actual } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UsuarioCreate>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPass, setResetPass] = useState("");
  const pag = usePaginado(usuarios);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await api<Usuario[]>("/usuarios?soloActivos=false"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (actual && actual.rol !== "ADMIN") {
    return (
      <div className="card p-10 text-center text-slate-500">
        Esta sección es solo para administradores.
      </div>
    );
  }

  function abrirNuevo() {
    setEditId(null);
    setForm(VACIO);
    setFormError(null);
    setModal(true);
  }

  function abrirEditar(u: Usuario) {
    setEditId(u.usuarioId);
    setForm({ nombre: u.nombre, email: u.email, rol: u.rol, password: "" });
    setFormError(null);
    setModal(true);
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setFormError(null);
    try {
      if (editId) {
        await api(`/usuarios/${editId}`, {
          method: "PUT",
          body: { nombre: form.nombre, email: form.email, rol: form.rol },
        });
      } else {
        await api("/usuarios", {
          method: "POST",
          body: { nombre: form.nombre, email: form.email, rol: form.rol, password: form.password },
        });
      }
      setModal(false);
      toast.success(editId ? "Usuario actualizado." : "Usuario creado.");
      await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function resetear(ev: React.FormEvent) {
    ev.preventDefault();
    if (resetId === null) return;
    try {
      await api(`/usuarios/${resetId}/reset-password`, {
        method: "POST",
        body: { passwordNueva: resetPass },
      });
      setResetId(null);
      setResetPass("");
      toast.success("Contraseña restablecida.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo restablecer.");
    }
  }

  async function desactivar(u: Usuario) {
    if (u.usuarioId === actual?.usuarioId) { toast.error("No puedes desactivar tu propia cuenta."); return; }
    if (!confirm(`¿Desactivar a ${u.nombre}? No podrá iniciar sesión.`)) return;
    try {
      await api(`/usuarios/${u.usuarioId}`, { method: "DELETE" });
      toast.success("Usuario desactivado.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo desactivar.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">Cuentas de acceso al sistema.</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary">
          <IconPlus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Nombre</th>
                <th className="th">Correo</th>
                <th className="th">Rol</th>
                <th className="th">Estado</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : pag.total === 0 ? (
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Sin usuarios.</td></tr>
              ) : (
                pag.visibles.map((u) => (
                  <tr key={u.usuarioId} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">
                      {u.nombre}
                      {u.usuarioId === actual?.usuarioId && <span className="ml-2 text-xs text-slate-400">(tú)</span>}
                    </td>
                    <td className="td text-slate-600">{u.email}</td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-700">{u.rol}</span></td>
                    <td className="td">
                      <span className={`badge ${u.activo ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(u)} className="mr-3 font-medium text-brand-700 hover:underline">Editar</button>
                      <button onClick={() => { setResetId(u.usuarioId); setResetPass(""); }} className="mr-3 font-medium text-slate-600 hover:underline">Contraseña</button>
                      {u.activo && u.usuarioId !== actual?.usuarioId && (
                        <button onClick={() => desactivar(u)} className="font-medium text-red-600 hover:underline">Desactivar</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion {...pag} />
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">{editId ? "Editar usuario" : "Nuevo usuario"}</h2>
            <form onSubmit={guardar} className="space-y-3">
              <label className="block">
                <span className="label">Nombre *</span>
                <input className="input" required value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Correo *</span>
                <input type="email" className="input" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Rol *</span>
                <select className="input" value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="mt-1 block text-xs text-slate-400">{ROL_DESC[form.rol]}</span>
              </label>
              {!editId && (
                <label className="block">
                  <span className="label">Contraseña inicial *</span>
                  <input type="text" className="input" required minLength={8} value={form.password ?? ""}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="mínimo 8 caracteres" />
                  <span className="mt-1 block text-xs text-slate-400">El usuario podrá cambiarla luego.</span>
                </label>
              )}

              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-primary">
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {resetId !== null && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="mb-1 text-lg font-bold text-slate-900">Restablecer contraseña</h2>
            <p className="mb-4 text-sm text-slate-500">
              {usuarios.find((u) => u.usuarioId === resetId)?.nombre}
            </p>
            <form onSubmit={resetear} className="space-y-3">
              <input type="text" className="input" required minLength={8} value={resetPass}
                onChange={(e) => setResetPass(e.target.value)} placeholder="Nueva contraseña (mín. 8)" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setResetId(null)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Restablecer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
