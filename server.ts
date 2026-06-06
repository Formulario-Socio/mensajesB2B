import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Papa from "papaparse";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini clients safely to avoid startup crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      throw new Error("La clave de API de Gemini (GEMINI_API_KEY) no está configurada en los Secretos de AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Endpoint: Copywriting de Alta Conversión con Gemini 3.5
app.post("/api/copywrite", async (req: express.Request, res: express.Response) => {
  try {
    const { lead, brand, service, forcedMode } = req.body;
    if (!lead) {
      return res.status(400).json({ error: "Faltan los datos del lead para redactar la propuesta." });
    }

    const ai = getGemini();

    const leadName = lead.name || "Colega / Licenciado";
    const leadCompany = lead.company || "Empresa Prospecto";
    const leadRole = lead.role || "Director de Operaciones";
    const leadContext = lead.context || "Busca optimizar procesos de capital humano.";
    const selectedBrand = brand || "Conexión Ejecutiva";
    const selectedService = service || "Estudios Socioeconómicos";

    // Representante dinámico
    let repName = "Antonio Pérez";
    if (selectedBrand === "Nomipago") {
      repName = "Bruno Antonio Reyes";
    } else if (selectedBrand === "Recurso Humano") {
      repName = "Christian Antonio Caballero";
    }

    // Regla de determinación del modo operacional
    let mode = "VENTA DIRECTA";
    const empLower = leadCompany.toLowerCase().trim();
    const cleanContext = leadContext.toLowerCase().trim();

    // Determinar si es colega del sector RH / Outsourcing
    const isAllianceCompany = [
      "agencia de empleo", "agencia de rh", "agencia de rrhh", "headhunter", "headhunting",
      "outsourcing", "consultoria de rh", "consultoria rh", "consultoría de rh", "consultoría rh",
      "consultora de rh", "consultora rh", "staffing", "human resources", "recursos humanos",
      "talent sourcing", "soluciones de talento"
    ].some(term => empLower.includes(term));

    // Exclusión total: si el sector/nombre incluye ciertos términos de sectores comerciales directos
    const isExclusionSector = [
      "logistica", "logística", "manufactura", "canceleria", "cancelería", "construccion",
      "construcción", "alimentos", "retail", "tecnologia", "tecnología", "seguridad privada",
      "limpieza"
    ].some(sector => empLower.includes(sector));

    // Si busca vacantes internas o personal propio para su propia plantilla
    const isInternalHiring = [
      "plantilla", "nuestro equipo", "nuestro departamento", "vacante interna", "nuestra oficina",
      "para nosotros", "contratación directa", "incorporar a nuestro", "staff interno", "plantilla propia"
    ].some(kw => cleanContext.includes(kw));

    if (isAllianceCompany && !isExclusionSector && !isInternalHiring) {
      mode = "ALIANZA COMERCIAL";
    }

    // Si el usuario forzó el modo manualmente desde el selector de la UI
    if (forcedMode === "ALIANZA COMERCIAL" || forcedMode === "VENTA DIRECTA") {
      mode = forcedMode;
    }

    const modeDescriptionPrompt = mode === "ALIANZA COMERCIAL" 
      ? `MODO ALIANZA COMERCIAL (Gancho de Maquila o Marca Blanca):
- El lead es un colega del sector (agencia, consultora de RH, headhunter).
- ESTRATEGIA: Propón actuar como su taller operativo o maquilador de confianza en segundo plano (Marca Blanca).
- REGLA DE ORO: NO ofrezcas comisiones bajo ningún motivo.
- ARGUMENTO CORE: Nosotros nos encargamos de todo el trabajo operativo y técnico (de los ${selectedService}), permitiéndoles entregar resultados con su propio logotipo y nombre comercial. Esto les permite acortar sus tiempos de entrega, incrementar su capacidad operativa instantáneamente sin elevar costos fijos ni contratar personal adicional.`
      : `MODO VENTA DIRECTA (Cliente Corporativo Final):
- El lead es el tomador de decisiones de una empresa de un sector productivo regular (logística, construcción, retail, etc.).
- ESTRATEGIA: Venta directa y tradicional dirigida a resolver los dolores de rotación, retrasos de ingreso o riesgos operativos de su plantilla usando ${selectedService}.`;

    const servicesDetailsPrompt = `
- Si el servicio es "Estudios Socioeconómicos":
  * Resultados en un máximo de 72 horas hábiles después de la visita domiciliaria sin sacrificar la calidad.
  * Visitas domiciliarias el mismo día de la postulación.
  * Verificación profunda de trayectorias laborales reales.
  * Validación residencial documentada con fotografías de alta calidad.
  * Reportes modulares personalizados según el perfil del puesto.
  * Cobertura extendida los fines de semana y festivos sin tarifa extra de urgencia.

- Si el servicio es "Pruebas de Polígrafo":
  * Evaluaciones integrales de pre-empleo (ingreso preventivo), permanencia periódica y pruebas específicas de investigación.
  * Programación y aplicación de pruebas al siguiente día hábil de la solicitud.
  * Resultados analíticos en un máximo de 48 horas bajo estándares de la APA.
  * Notificación de dictamen preliminar/alerta de riesgo el mismo día de la sesión.

- Si el servicio es "Evaluaciones de Psicometría":
  * Pruebas virtuales personalizadas según competencias ejecutivas, de honestidad, adaptabilidad y confiabilidad laboral.
  * Reportes dinámicos comparativos con gráficos de inteligencia de perfiles.

- Si el servicio es "Pruebas Antidoping Rápidas":
  * Reactivos rápidos multi-panel de 3, 5 o 7 elementos químicos.
  * Toma de muestras higiénica directamente en sus oficinas, centros de distribución o bases de operación.
  * Resultados confidenciales on-site en tiempo real para agilizar contrataciones urgentes.

- Si el servicio es "Reclutamiento de personal":
  * Entrega de la primera terna de valor calificada en los primeros 5 a 7 días hábiles.
  * Consultores especializados dedicados 100% a tu cuenta.
  * Flexibilidad total: sin volumen inicial mínimo de contratación obligatoria.
  * Opción de implant de un ejecutivo dedicado directamente en tu centro de trabajo para proyectos masivos.`;

    const instructionsPrompt = `Usa tus habilidades de copywriting comercial de élite para armar propuestas de alta conversión y alto impacto dirigidas a este lead. El objetivo es vender los servicios, capturar el interés inmediato de los tomadores de decisiones de forma elegante pero asertiva, enfocándote en el ROI, velocidad de entrega y mitigación de riesgos.

# ROL Y OBJETIVO
Eres el Estratega de Ventas y CRM Manager de las tres marcas independientes: "Conexión Ejecutiva", "Recurso Humano" y "Nomipago". Tu meta es gestionar el ciclo de vida del prospecto en una base de datos centralizada, garantizando que el lead perciba tres ofertas comerciales distintas y logrando el cierre de ventas.

# LÓGICA DE GESTIÓN DE COLUMNAS
Cada vez que proceses un lead, tu salida debe incluir instrucciones para actualizar las columnas en formato estructurado:
1. Proxima_Accion y Tipo_Accion: Define cuándo y cómo contactar nuevamente basándote en la interacción actual.
2. Status_[Marca]: Actualiza el estatus según la etapa del proceso (Pendiente, Contactado, Interesado, Cerrado).
3. Historial_Contacto y Notas_CRM: Registra un resumen ejecutivo de lo ocurrido.
4. Ultima_Marca_Usada: Registra la marca que acaba de impactar al lead para rotar la estrategia.

# INSTRUCCIONES DE OPERACIÓN (Flujo de trabajo)
1. ANÁLISIS: Identifica la marca activa.
2. ESTRATEGIA DE PROSPECCIÓN:
   - Si un lead no responde, sugiere una "Acción de Recuperación" usando una marca distinta a la última usada.
   - Si el estatus es "Pendiente", redacta una propuesta de alto impacto basada en el "Resumen post" de LinkedIn del lead.
3. RECORDATORIOS AUTOMÁTICOS: Si el lead muestra interés, calcula una fecha de seguimiento (ej: 48 horas después) y asígnala.

# REGLAS DE ORO
- Independencia total: El lead nunca debe notar que las marcas pertenecen a la misma entidad.
- Personalización: Usa el "Contexto/Dolor" para que el mensaje no parezca spam.
- Brevedad: Mantén el estilo directo y profesional (estilo: beneficios claros, tiempo de entrega, CTA directo).

INFORMACIÓN DEL LEAD EN MÉXICO:
- Nombre: ${leadName}
- Empresa: ${leadCompany}
- Cargo de decisión: ${leadRole}
- Servicio de interés solicitado: ${selectedService}
- Contexto de dolor o búsqueda: ${leadContext}
- Marca Comercial emisora: ${selectedBrand}
- Representante: ${repName}

MÉTODO DE PROSPECCIÓN DEFINIDO PARA ESTE REGISTRO: ${mode}
${modeDescriptionPrompt}

REGLA DE VARIABILIDAD ABSOLUTA (EVITAR PLAN_G):
Este prospecto puede recibir propuestas consecutivas bajo diferentes marcas de nuestro grupo. Por ende, es CRÍTICO que el mensaje, el título de asunto (subject), las oraciones, el vocabulario y el orden de los argumentos para la marca "${selectedBrand}" sean COMPLETAMENTE DISTINTOS, con ganchos, ganchos de entrada, frases, tonos y enfoques de venta radicalmente únicos. No utilices la misma estructura de plantilla que usarías para las otras marcas.
- Selecciona y enfoca la propuesta según el ADN estratégico de la marca seleccionada:
  * Si la marca es **Conexión Ejecutiva**: El enfoque es de seguridad impecable, validación de confianza profunda, mitigación de riesgos laborales y blindaje legal/corporativo absoluto. El estilo debe ser altamente institucional y ejecutivo.
  * Si la marca es **Nomipago**: El enfoque estratégico debe centrarse en la optimización del flujo de operación de nómina, la alta velocidad de respuesta corporativos, cumplimiento administrativo y rentabilidad operativa. El estilo debe ser ágil, asertivo y enfocado en ahorro/eficiencia.
  * Si la marca es **Recurso Humano**: El enfoque es la adquisición experta de talento calificado ("headhunting" directo), reclutamiento ágil, rapidez crítica para cubrir vacantes y de alta adaptabilidad. El estilo debe ser enérgico, cercano, orientado al dinamismo del capital humano.

CONCATENACIÓN DE SECCIONES REQUERIDAS (Solo genera las propiedades solicitadas en el JSON):

1. ASUNTO:
- Genera una línea de asunto de altísimo impacto, persuasiva y magnética que logre aperturas inmediatas en frío. Centrado en el beneficio corporativo (ej: ahorros, agilidad o seguridad operativa) específico al sector o necesidad del lead.
- El asunto de "${selectedBrand}" debe ser exclusivo, directo y absolutamente distinto a las formulaciones de otras marcas.
- REGLA CRÍTICA DE ASUNTO: NUNCA uses un solo asterisco (*) o corchete especial en el asunto. Mantén la tipografía limpia y profesional.

2. CUERPO DEL CORREO:
- Saludo: Debes usar un saludo profesional directo exclusivamente de estos disponibles:
  * "Hola buen día [Nombre]"
  * "Hola buen día Lic. [Nombre], que tengas buen día"
  * "Hola buen día Lic. [Nombre]."
- PROHIBICIÓN ABSOLUTA DE SALUDOS ROBÓTICOS: Queda estrictamente PROHIBIDO usar "Hola, [Nombre]" (con coma después de Hola), "¿Cómo estás?", "Espero te encuentres bien", "Paso por aquí para", o saludos similares.
- Línea de Beneficio Inicial (Apertura de Impacto): Comienza de inmediato atacando el dolor de negocio del cliente o haciendo alusión a sumarte como un brazo estratégico que resuelve su problema. NUNCA comiences presentándote ("Mi nombre es... de la empresa...") o diciendo lo que vendes. Esto reduce drásticamente la retención.
- ESPACIADO DE PÁRRAFOS (REGLA MANDATORIA): Estructura el cuerpo del correo de manera legible usando de 3 a 4 párrafos bien definidos, separados estrictamente por dos saltos de línea (\\n\\n) para darles un espaciado visual ultra limpio, aireado y profesional en pantalla.
- PALABRAS EN NEGRITAS: Utiliza doble asterisco (**) para poner en negritas estrictamente los nombres de los servicios clave como **Estudios Socioeconómicos**, **Reclutamiento de personal**, **Pruebas de Polígrafo**, **Evaluaciones de Psicometría**, **Pruebas Antidoping Rápidas**, u otros términos clave de impacto y beneficios críticos. No abuses de ellas, úsalas de forma estratégica para guiar la lectura escaneable.
- VIÑETAS DE BENEFICIOS: Los valores agregados y ventajas comerciales deben presentarse obligatoriamente en forma de viñetas claras e independientes, separadas cada una por un salto de línea y utilizando guiones normales (-) al inicio de cada línea. Por ejemplo:
- **Resultados garantizados** en un máximo de...
- **Cobertura total** para tus visitas domiciliarias...
Elige e integra inteligentemente de 3 a 4 valores del servicio solicitados de:
  ${servicesDetailsPrompt}
- Limitación de Mención de Marca: El nombre de la marca comercial ("${selectedBrand}") solo puede aparecer una vez integrada en los párrafos argumentales.
- Cierre y Llamado a la Acción (CTA) Altamente Efectivo (MANDATORIO): Debe impulsar la conversación de negocios de forma directa y asertiva. Concluye el correo obligatoriamente con una pregunta de impacto súper directa. Ejemplos obligatorios de cierre:
  * "¿Qué día y en qué teléfono te puedo contactar para darte más detalles del servicio?"
  * "¿Puedo tener una llamada de 15 minutos y explicarte nuestros beneficios?"
  * "¿Qué día de esta semana tendrías 10 minutos libres para que te llame brevemente y evaluemos si esto te ayuda en tu plantilla actual?"
- PROHIBICIÓN ABSOLUTA DE FIRMAS O DESPEDIDAS: Queda TERMINANTEMENTE PROHIBIDO, BAJO CUALQUIER CIRCUNSTANCIA, incluir firmas, nombres, despedidas tipo "Atentamente,", "Saludos cordiales,", "Te saluda...", nombres de representantes, o "El equipo de...". El correo electrónico debe terminar EXACTAMENTE en el carácter de cierre de interrogación del llamado a la acción anterior. NADA DE TEXTO ADICIONAL DESPUÉS DEL CTA. Es una orden estrictamente obligatoria.

3. WHATSAPP:
- Genera un mensaje altamente persuasivo, diseñado para enganche inmediato y optimizado para pantallas móviles mexicanas (muy escaneable).
- Ve directo al grano con un saludo ágil, conciso y de alto impacto.
- Ofrece el valor práctico y un llamado a la acción con una pregunta directa muy persuasiva para agilizar la respuesta al instante:
  * "¿Qué día y en qué teléfono te puedo contactar para darte más detalles?"
  * "¿Podemos tener una llamada rápida de 15 minutos esta semana para platicar de los beneficios?"
- PROHIBICIÓN ABSOLUTA DE FIRMAS EN WHATSAPP: Queda estrictamente PROHIBIDO firmar, poner nombres, o añadir despedidas al final del mensaje de WhatsApp. El mensaje debe terminar EXACTAMENTE con la pregunta del llamado a la acción.
- En el WhatsApp SÍ puedes usar el carácter asterisco (*) para poner palabras en negrita (ejemplo: *Estudios Socioeconómicos*), adaptándose perfectamente al marcado nativo de WhatsApp.

Por favor, regresa tu resultado siguiendo estrictamente el siguiente esquema de JSON.`;

    // Intentaremos con gemini-3.5-flash con reintentos; si falla por alta demanda, usaremos un modelo alterno menos saturado
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let responseText = "";
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      const maxRetries = modelName === "gemini-3.5-flash" ? 3 : 1;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[IA] Generando propuesta con modelo ${modelName} (Intento ${attempt}/${maxRetries})...`);
          const aiResponse = await ai.models.generateContent({
            model: modelName,
            contents: instructionsPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  subject: { 
                    type: Type.STRING, 
                    description: "Línea de asunto de alto impacto para apertura, atractiva y limpia (libre de asteriscos)." 
                  },
                  emailBody: { 
                    type: Type.STRING, 
                    description: "Cuerpo del correo listo para enviar, estructurado según las reglas, libre de asteriscos (*), utilizando guiones (-) para las viñetas." 
                  },
                  whatsappMessage: { 
                    type: Type.STRING, 
                    description: "Variante de mensaje de WhatsApp ultra conciso con formato y negritas usando asteriscos (*), firmado por el representante asignado." 
                  },
                  strategyUsed: { 
                    type: Type.STRING, 
                    description: "La estrategia B2B aplicada: 'ALIANZA COMERCIAL' o 'VENTA DIRECTA'." 
                  },
                  actualizacion_crm: {
                    type: Type.OBJECT,
                    description: "Instrucciones de actualización para la bitácora CRM.",
                    properties: {
                      Status_Marca_Activa: { type: Type.STRING },
                      Ultima_Marca_Usada: { type: Type.STRING },
                      Proxima_Accion: { type: Type.STRING },
                      Tipo_Accion: { type: Type.STRING },
                      Notas_CRM: { type: Type.STRING }
                    }
                  },
                  alerta_recordatorio: {
                    type: Type.STRING,
                    description: "Texto breve para el usuario sobre la urgencia del seguimiento."
                  }
                },
                required: ["subject", "emailBody", "whatsappMessage", "strategyUsed", "actualizacion_crm", "alerta_recordatorio"]
              }
            }
          });
          
          if (aiResponse && aiResponse.text) {
            responseText = aiResponse.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[IA] Intento fallido con ${modelName}. Error: ${err.message || err}`);
          
          if (attempt < maxRetries) {
            const waitTime = attempt * 1200; // 1.2s, 2.4s...
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (responseText) {
        break;
      }
    }

    if (!responseText) {
      throw lastError || new Error("Todos los intentos con los modelos de IA fallaron debido a congestión temporal.");
    }

    const data = JSON.parse(responseText.trim());
    return res.json({ 
      success: true, 
      subject: data.subject, 
      emailBody: data.emailBody, 
      whatsappMessage: data.whatsappMessage, 
      strategyUsed: data.strategyUsed,
      crmUpdate: data.actualizacion_crm,
      reminderAlert: data.alerta_recordatorio
    });

  } catch (error: any) {
    console.error("Gemini Copywriting Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Error al redactar la propuesta comercial con Gemini AI." 
    });
  }
});

// 2. Endpoint: Jalar Leads directamente desde Google Sheets (Sincronización en Directo)
app.get("/api/sheets-leads", async (req: express.Request, res: express.Response) => {
  try {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1BtkBKm9gFnIAa0lGPLgx8HYfEzPYVFVaICR0aqtsAA0/gviz/tq?tqx=out:csv&sheet=Lead";
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      throw new Error(`Error de conexión con Google Sheets: ${response.statusText}`);
    }
    const csvText = await response.text();

    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parseResult.data as Record<string, any>[];

    const mappedLeads = rows.map((row, index) => {
      const keys = Object.keys(row);
      const findValue = (needle: string, defaultVal: string = "") => {
        const key = keys.find(k => k.toLowerCase().trim() === needle.toLowerCase());
        return key ? row[key] : defaultVal;
      };

      const name = findValue("nombre de quien publica") || findValue("nombre") || "Sin Nombre";
      const company = findValue("empresa") || "No especificada";
      const role = findValue("cargo o rol") || findValue("cargo") || "No Definido";
      const service = findValue("tipo de servicio relacionado") || findValue("tipo servicio") || "Estudios Socioeconómicos";
      const email = findValue("email") || "";
      const whatsapp = findValue("telefono whatsapp") || findValue("whatsapp") || findValue("teléfono whatsapp") || "";
      const context = findValue("resumen post") || findValue("resumen") || "Sin detalles.";
      const statusRaw = findValue("estatus") || "Pendiente";
      const history = findValue("historial contacto") || findValue("historial") || "";
      const lastBrandUsed = findValue("última marca usada") || findValue("ultima marca usada") || "Ninguna";
      const fechaDia = findValue("fecha dia") || findValue("fecha") || "";

      let status: "Pendiente" | "Contactado" | "Revisado" = "Pendiente";
      if (statusRaw.trim() === "Revisado" || statusRaw.trim() === "Evaluado") {
        status = "Revisado";
      } else if (history.trim() !== "") {
        status = "Contactado";
      }

      const todayStr = "16/05/2026";
      const contactedToday = history.includes(todayStr) || history.includes(new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" }));

      return {
        id: `row-${index + 2}`,
        name: name.toString().trim(),
        company: company.toString().trim(),
        role: role.toString().trim(),
        service: service.toString().trim(),
        email: email.toString().trim(),
        whatsapp: whatsapp.toString().trim(),
        context: context.toString().trim(),
        status,
        history: history.toString().trim(),
        lastBrandUsed: lastBrandUsed.toString().trim(),
        contactedToday,
        fechaDia: fechaDia.toString().trim()
      };
    });

    // Filtramos filas que estén totalmente vacías o sin nombre y empresa
    const validLeads = mappedLeads.filter(l => l.name !== "Sin Nombre" || l.company !== "No especificada");

    return res.json({ success: true, leads: validLeads });
  } catch (error: any) {
    console.error("Sheets Lead Sync Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Error al sincronizar prospectos de Google Sheets" 
    });
  }
});

// Serve Vite-compiled client code and listen
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Centro de Comando B2B] Servidor ejecutándose en puerto ${PORT}`);
  });
}

startServer();
