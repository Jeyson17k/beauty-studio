import Link from "next/link";
import Image from "next/image";
import { cursosActivos, serviciosActivos } from "@/modulos/catalogo";
import { InsigniaSeccion, PildorasNumeradas } from "@/componentes/publico";

export const dynamic = "force-dynamic";

// P01 Inicio. Estructura inspirada en el video de referencia (portada con «Conmigo podrás», áreas clave con fotos,
// secciones numeradas y listas en píldoras), con los colores y el contenido de Beauty Studio.
export default async function Inicio() {
  const [servicios, cursos] = await Promise.all([serviciosActivos(), cursosActivos()]);
  const areas = [
    { titulo: "Maquillaje", img: "/img/area_maquillaje.jpg" },
    { titulo: "Peinado", img: "/img/area_peinado.jpg" },
    { titulo: "Cursos", img: "/img/area_cursos_v2.jpg" },
    { titulo: "Productos", img: "/img/area_productos.jpg" },
  ];
  return (
    <div className="relative isolate">
      {/* Fondo de toda la página de inicio: foto del salón de Andrea, oscurecida. Ocupa solo esta página
          (no cubre el pie) y se queda quieta al deslizar gracias al contenedor «sticky». */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-negro-950">
        <div className="sticky top-0 h-dvh w-full overflow-hidden">
          <Image src="/img/fondo_salon.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-45 blur-[2px]" />
        </div>
      </div>

      {/* ---------- Portada ---------- */}
      <section className="relative overflow-hidden text-white">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-negro-950/90 via-negro-950/65 to-negro-950/40" />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-oro-400/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-oro-500/10 blur-3xl" />
        <div className="contenedor relative grid items-center gap-10 py-10 md:grid-cols-[1.15fr_0.85fr] md:py-16 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-oro-300">Andrea Paola · Los Cedros, León</p>
            <h1 className="titulo-grande mt-4 text-[2.6rem] sm:text-5xl lg:text-6xl">
              Maquillaje y peinado <span className="texto-oro">para tu momento especial</span>
            </h1>
            <p className="mt-6 font-titulo text-lg uppercase tracking-[0.2em] text-white/80">Conmigo podrás:</p>
            <ul className="mt-3 grid gap-2 sm:max-w-md">
              {[
                ["Solicitar", "tu cita en minutos"],
                ["Recibir", "tu cotización por WhatsApp"],
                ["Apartar", "tu fecha con el 10 %"],
                ["Aprender", "con cursos de maquillaje"],
              ].map(([v, r], i) => (
                <li
                  key={v}
                  className={`pildora-flecha flex items-center gap-3 px-6 py-2.5 text-sm ${
                    i === 0 ? "oro-degradado text-negro-950" : "bg-white/[0.08] text-white/90"
                  }`}
                >
                  <span className="w-24 font-titulo text-base font-bold uppercase tracking-[0.14em]">{v}</span>
                  <span className={i === 0 ? "font-medium" : "text-white/70"}>{r}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/solicitar/servicio" className="btn oro-degradado px-7 py-3 text-sm uppercase tracking-wider text-negro-950 hover:brightness-105">
                Solicitar cotización
              </Link>
              <Link href="/disponibilidad" className="btn border border-white/25 px-7 py-3 text-sm uppercase tracking-wider text-white hover:border-oro-300 hover:text-oro-200">
                Ver horarios ocupados
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[340px] md:max-w-[420px]">
            <div aria-hidden className="absolute -inset-3 rounded-[48%_48%_32px_32px] border border-oro-300/40" />
            <div className="relative overflow-hidden rounded-[46%_46%_28px_28px] border-2 border-oro-300/70 bg-negro-900">
              {/* Foto de Andrea con su certificado (recortada a 3:4 para no ocupar tanto alto): el texto va debajo */}
              <Image src="/img/hero_andrea_v3.jpg" alt="Andrea Paola con su certificado" width={720} height={1280} priority className="block aspect-[3/4] w-full object-cover object-[center_32%]" />
              <div className="bg-negro-900 px-5 pb-5 pt-3 text-center">
                <p className="font-titulo text-xl font-semibold uppercase tracking-[0.14em]">Agenda abierta</p>
                <p className="text-sm text-white/70">Graduaciones, bodas, sesiones de fotos y eventos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Áreas clave ---------- */}
      <section className="bg-negro-900/80 py-12 text-white md:py-16">
        <div className="contenedor">
          <div className="flex items-end gap-4">
            <span className="texto-oro font-titulo text-7xl font-bold leading-none md:text-8xl">4</span>
            <div>
              <h2 className="titulo-grande text-2xl md:text-4xl">Formas de consentirte</h2>
              <p className="font-titulo text-sm uppercase tracking-[0.2em] text-oro-300">Todo en un solo lugar</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {areas.map((a) => (
              <div key={a.titulo} className="relative block overflow-hidden rounded-2xl">
                <Image src={a.img} alt="" width={600} height={800} className="h-48 w-full object-cover md:h-72" />
                <div className="absolute inset-0 bg-gradient-to-t from-negro-950/85 via-negro-950/10 to-transparent" />
                <span className="cinta oro-degradado absolute bottom-4 left-0 py-1.5 pl-4 pr-7 font-titulo text-sm font-semibold uppercase tracking-[0.16em] text-negro-950 md:text-base">
                  {a.titulo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 1. Servicios ---------- */}
      <section className="bg-crema-50/90 py-12 md:py-16">
        <div className="contenedor">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <InsigniaSeccion numero={1} titulo="Servicios de belleza" claro />
            <Link href="/servicios" className="text-sm font-semibold text-oro-700 hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {servicios.slice(0, 4).map((s) => (
              <Link key={s.id} href={`/servicios/${s.id}`} className="group tarjeta overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
                {s.imagen_url && <Image src={s.imagen_url} alt={s.nombre} width={800} height={800} className="aspect-square w-full object-cover" />}
                <div className="p-3 md:p-4">
                  <p className="font-titulo text-base font-semibold uppercase tracking-wide md:text-lg">{s.nombre}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gris-600 md:text-sm">{s.descripcion}</p>
                  <p className="mt-3 text-sm font-semibold text-oro-700 group-hover:underline">Solicitar →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 2. Cursos ---------- */}
      <section className="bg-negro-950/80 py-12 text-white md:py-16">
        <div className="contenedor grid items-center gap-10 md:grid-cols-2">
          <div>
            <InsigniaSeccion numero={2} titulo="Cursos de maquillaje" />
            <h2 className="titulo-grande mt-6 text-3xl md:text-4xl">
              Aprende con <span className="texto-oro">Andrea</span>
            </h2>
            <p className="mt-3 text-sm text-white/70">Sesiones de 3 horas. En las clases grupales cada participante se inscribe y paga por separado.</p>
            <div className="mt-6">
              <PildorasNumeradas
                items={
                  cursos.length
                    ? cursos.slice(0, 4).map((c) => (
                        <span key={c.id}>
                          {c.nombre} <span className="opacity-60">· {c.modalidad === "grupal" ? "grupal" : "individual"}</span>
                        </span>
                      ))
                    : ["Pronto abriremos nuevos cursos"]
                }
              />
            </div>
            <Link href="/cursos" className="btn oro-degradado mt-7 px-7 py-3 text-sm uppercase tracking-wider text-negro-950">
              Ver cursos y cupos
            </Link>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-negro-800/60 p-3 shadow-2xl">
              <div className="grid grid-cols-2 gap-3">
                <Image src="/img/curso_certificado.jpg" alt="Alumna con su certificado junto a Andrea" width={800} height={1000} className="aspect-[4/5] w-full rounded-2xl object-cover" />
                <Image src="/img/curso_sesion.jpg" alt="Andrea maquillando a una alumna" width={800} height={1000} className="mt-8 aspect-[4/5] w-full rounded-2xl object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 3. Cómo funciona ---------- */}
      <section className="bg-crema-100/90 py-12 md:py-16">
        <div className="contenedor grid gap-10 md:grid-cols-[1fr_0.8fr] md:items-center">
          <div>
            <InsigniaSeccion numero={3} titulo="¿Cómo funciona?" claro />
            <div className="mt-8">
              <PildorasNumeradas
                oscuro={false}
                items={[
                  "Envías tu solicitud con la fecha, la hora y, si quieres, fotos de referencia.",
                  "Andrea la revisa y te envía la cotización por WhatsApp.",
                  "Pagas el anticipo del 10 % dentro de 24 horas y envías el comprobante por WhatsApp.",
                  "Andrea verifica el pago y confirma tu cita. El saldo se paga el día de la atención.",
                ]}
              />
            </div>
          </div>
          <div className="tarjeta overflow-hidden">
            <Image src="/img/andrea_agenda.jpg" alt="Andrea Paola" width={1000} height={750} className="aspect-[4/3] w-full object-cover" />
            <div className="p-5">
              <p className="font-titulo text-xl font-semibold uppercase tracking-wide">Revisa la agenda</p>
              <p className="mt-1 text-sm text-gris-600">Mira qué horarios ya están apartados o confirmados antes de elegir tu fecha.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/disponibilidad" className="btn-primario flex-1">
                  Ver disponibilidad
                </Link>
                <Link href="/solicitar/servicio" className="btn-borde flex-1">
                  Solicitar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 4. Catálogo ---------- */}
      <section className="relative overflow-hidden bg-negro-950 text-white">
        <Image src="/img/banner.jpg" alt="" fill className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-negro-950 via-negro-950/80 to-transparent" />
        <div className="contenedor relative py-14 md:py-20">
          <InsigniaSeccion numero={4} titulo="Productos de belleza" />
          <h2 className="titulo-grande mt-6 max-w-xl text-3xl md:text-4xl">Lo que Andrea usa, ahora para ti</h2>
          <p className="mt-3 max-w-md text-sm text-white/70">Arma tu pedido y envíaselo por WhatsApp. Retiro en el local o delivery.</p>
          <Link href="/catalogo" className="btn oro-degradado mt-7 px-7 py-3 text-sm uppercase tracking-wider text-negro-950">
            Ver catálogo
          </Link>
        </div>
      </section>
    </div>
  );
}
