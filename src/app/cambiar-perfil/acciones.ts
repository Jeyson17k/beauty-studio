"use server";
// Cambio de perfil de Andrea entre el panel de administración y la página de las clientas.
// Cada cambio, en cualquiera de los dos sentidos, pide la contraseña.
import { redirect } from "next/navigation";
import { aResultado } from "@/lib/errores";
import { pool } from "@/lib/db";
import { abrirPerfilClienta, abrirSesionAdmin, cerrarPerfilClienta, cerrarSesionAdmin, olvidarClienta, sesionAdmin, sesionPerfilClienta } from "@/lib/sesion";
import { auditar, validarCredenciales } from "@/modulos/seguridad";
import type { EstadoForm } from "@/componentes/Formulario";

export async function accionCambiarPerfil(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const aClienta = String(fd.get("destino")) === "clienta";
  try {
    const actual = aClienta ? await sesionAdmin() : await sesionPerfilClienta();
    if (!actual) return { ok: false, error: "Tu sesión terminó. Vuelve a iniciar sesión en el panel." };
    const s = await validarCredenciales(actual.usuario, String(fd.get("password") ?? ""));
    if (!s) {
      await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
      return { ok: false, error: "La contraseña no es correcta." };
    }
    await auditar(pool, s.uid, aClienta ? "Cambiar a perfil de clienta" : "Cambiar a perfil de administradora", "usuario_admin", s.uid);
    await olvidarClienta(); // la clienta que estaba identificada no se mezcla con el otro perfil
    if (aClienta) {
      await cerrarSesionAdmin(); // mientras ve la página como clienta, no queda abierta la sesión del panel
      await abrirPerfilClienta(s);
    } else {
      await cerrarPerfilClienta();
      await abrirSesionAdmin(s);
    }
  } catch (e) {
    return aResultado(e);
  }
  redirect(aClienta ? "/" : "/panel");
}
