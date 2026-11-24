# Beauty Studio · Sistema web

Sistema de información web para negocios de belleza (servicios, cursos y productos). Proyecto de Ingeniería de Software I, UNI, grupo 3M1-SIS-S.

- **Clienta (móvil):** servicios, cursos y sesiones, horarios ocupados, solicitudes con fotos de referencia, inscripciones, catálogo, carrito, pedido por WhatsApp e historial con código de verificación.
- **Administración (panel):** solicitudes, cotización con anticipo del 10 %, envío de la cotización por WhatsApp (API o manual), comprobantes, confirmación, plazo vencido, reprogramación, atención y saldo, agenda, cursos y sesiones, pedidos con reserva de 48 h, inventario, ventas, gastos, reportes, mensajes y auditoría.

Tecnologías: **Next.js 15 (React 19, TypeScript)**, **Node.js 22**, **PostgreSQL 16** (controlador `pg`), Tailwind CSS 4, `jose` (sesiones firmadas), `bcryptjs`, Vitest.

> **WhatsApp:** el sistema funciona en **modo simulado** (no se conecta a Meta). El cliente de Meta WhatsApp Cloud API y el webhook con verificación de firma están programados, pero **la conexión real está pendiente de probar** con un número de prueba de Meta. El número de Andrea (+505 8619-0898) todavía no se ha verificado para funcionar en modo de coexistencia y no se conecta en esta etapa.

---

## 1. Requisitos (Windows 10/11)

1. **Node.js 22 LTS** — <https://nodejs.org> (instalador .msi, opciones por defecto).
2. **PostgreSQL 16** — <https://www.postgresql.org/download/windows/> (instalador de EDB). Anota la contraseña del usuario `postgres`. Deja el puerto 5432.
3. **Git** — <https://git-scm.com/download/win>.

Comprueba en una terminal (PowerShell):

```powershell
node -v      # v22.x
npm -v
psql --version   # si no lo encuentra, usa «SQL Shell (psql)» del menú Inicio
```

## 2. Crear la base de datos

Abre **SQL Shell (psql)**, entra con el usuario `postgres` y ejecuta:

```sql
CREATE ROLE beauty LOGIN PASSWORD 'beauty';
CREATE DATABASE beautystudio_db OWNER beauty;
CREATE DATABASE beautystudio_test OWNER beauty;   -- solo para las pruebas automáticas
```

(En el VPS se usa otra contraseña, larga y secreta.)

## 3. Instalar y arrancar

En la carpeta del proyecto:

```powershell
copy .env.example .env.local      # revisa los valores; cambia SESSION_SECRET y ADMIN_PASSWORD
npm install
npm run db:crear                  # crea las 30 tablas (db/schema.sql)
npm run db:semilla                # usuario administrador, configuración, servicios y cursos
npm run db:demo                   # opcional: 6 productos de ejemplo y una sesión grupal abierta
npm run build
npm start
```

- Sitio de la clienta: <http://localhost:3000> (ábrelo también desde el teléfono con la IP de la computadora, por ejemplo `http://192.168.1.10:3000`, si están en la misma red Wi-Fi).
- Panel de administración: <http://localhost:3000/panel> — usuario `admin`, contraseña la de `ADMIN_PASSWORD`. Cámbiala en **Configuración**.

Para trabajar en el código con recarga automática: `npm run dev`.

Para empezar de cero (borra todos los datos): `npm run db:reiniciar` y, si quieres, `npm run db:demo`.

## 4. Pruebas automáticas

```powershell
npm test
```

Ejecuta 43 casos (Vitest) contra la base `beautystudio_test`, que se borra y se vuelve a crear en cada corrida. Si usas otra conexión, define `TEST_DATABASE_URL`. Los códigos de los casos (PF-01 a PF-43) son los de la matriz de pruebas del Corte 4.

## 5. Cómo probar WhatsApp en modo simulado

- Al enviar una cotización, el sistema la deja **En cola** y a los 2 segundos simula el aviso **Enviado** de WhatsApp; recién entonces empieza el plazo de 24 horas.
- Un número que **termina en 9999** simula un envío **fallido** (para probar la alerta, la liberación del horario y el envío manual).
- El texto que habría llegado a la clienta (incluido el código de verificación del historial) se ve en el panel, en **Mensajes de WhatsApp → Bandeja simulada**.

## 6. Conexión con Meta WhatsApp Cloud API (pendiente)

Cuando el equipo tenga la cuenta de desarrollador y un número de prueba de Meta (ver la guía del proyecto):

1. En `.env.local`: `WHATSAPP_MODE=cloud`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` y los nombres de las tres plantillas aprobadas.
2. Exponer el servidor local con una dirección HTTPS temporal (por ejemplo, un túnel) y registrar en Meta el webhook `https://<dirección-temporal>/api/whatsapp/webhook` con el mismo `WHATSAPP_VERIFY_TOKEN`, suscrito a los avisos de **messages** (estados).
3. Enviar una cotización a un número de prueba y comprobar en **Mensajes de WhatsApp** los avisos enviado, entregado y leído.

Hasta que eso se haga, la integración real se documenta como **pendiente de prueba**.

## 7. Estructura

```
db/schema.sql                 Modelo de datos físico (30 tablas + costo_unitario en movimiento_inventario)
scripts/db.ts, scripts/demo.ts  Crear tablas, datos iniciales y datos de demostración
src/modulos/                  Lógica por módulo lógico del diseño (Corte 3, figura de componentes):
  clientas.ts                   MOD-01 Identificación y clientas, código de verificación
  catalogo.ts                   MOD-02 Servicios, cursos y sesiones
  agenda.ts                     MOD-03 Agenda y disponibilidad (sin solapamiento)
  solicitudes.ts                MOD-04 Solicitudes, cotización, cancelación, registro directo, reprogramación
  pagos.ts                      MOD-05 Comprobantes, confirmación, plazo vencido, atención y saldo
  whatsapp/                     MOD-06 Mensajería de WhatsApp (plantillas, cliente Cloud API, webhook idempotente)
  pedidos.ts                    MOD-07 Catálogo, carrito y pedidos (reserva de 48 h)
  inventario.ts                 MOD-08 Inventario, ventas y gastos
  reportes.ts                   MOD-09 Panel y reportes
  seguridad.ts                  MOD-10 Sesión de administración, auditoría y notificaciones
  planificador.ts               MOD-11 Planificador de tareas (cada minuto)
src/app/(publico)/            Páginas de la clienta (P01–P18)
src/app/panel/                Páginas del panel (A01–A22) y acciones del servidor
src/app/api/                  Webhook de WhatsApp, archivos privados y planificador externo
pruebas/                      Pruebas automáticas (PF-01 a PF-43)
```

## 8. Subir a GitHub

```powershell
git add -A
git commit -m "Mensaje del cambio"
git remote add origin https://github.com/<usuario>/beauty-studio.git   # solo la primera vez
git push -u origin main
```

`.env.local` y la carpeta `almacenamiento/` no se suben (están en `.gitignore`).
