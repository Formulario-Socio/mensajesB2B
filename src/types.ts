export interface Lead {
  id: string;
  name: string;
  company: string;
  role: string;
  service: string;
  email: string;
  whatsapp: string;
  context: string;
  status: "Pendiente" | "Contactado" | "Revisado";
  history: string;
  lastBrandUsed?: string;
  lastChannelUsed?: "Correo" | "WhatsApp" | "Revisado";
  contactedToday?: boolean;
  date: string;
}

export interface FavoriteTemplate {
  id: string;
  leadName: string;
  company: string;
  service: string;
  brand: string;
  mode: "ALIANZA COMERCIAL" | "VENTA DIRECTA";
  subject: string;
  emailBody: string;
  whatsappMessage: string;
  savedAt: string;
}

export const INITIAL_LEADS: Lead[] = [
  {
    id: "lead-1",
    name: "Sofía Martínez",
    company: "Corporativo Soriana",
    role: "Directora de Talent Acquisition",
    service: "Estudios Socioeconómicos",
    email: "sofia.martinez@soriana.com.mx",
    whatsapp: "5512345678",
    context: "Buscamos un proveedor confiable para homologar las visitas domiciliarias de 120 cajeras y supervisores de tienda en Nuevo León. Obligatorio entregar reportes completos en menos de 72 horas.",
    status: "Pendiente",
    history: "",
    date: "2026-05-18"
  },
  {
    id: "lead-2",
    name: "Carlos Mendoza",
    company: "Capital Humano Integral S.C.",
    role: "Headhunter Principal",
    service: "Pruebas de Polígrafo",
    email: "carlos.mendoza@capitalintegral.mx",
    whatsapp: "5587654321",
    context: "Nuestros clientes corporativos del sector logística nos están exigiendo polígrafos obligatorios para guardias y operadores de patio. Buscamos un socio operativo de marca blanca que actúe en segundo plano para realizar las pruebas.",
    status: "Pendiente",
    history: "",
    date: "2026-05-23"
  },
  {
    id: "lead-3",
    name: "Rafael Ortiz",
    company: "Fletemex Logística S.A.",
    role: "Gerente de Operaciones",
    service: "Pruebas Antidoping Rápidas",
    email: "r.ortiz@fletemex.com.mx",
    whatsapp: "8123456789",
    context: "Urge proveedor para realizar reactivos de orina múltiples a operadores en las instalaciones de nuestro CEDIS Tepotzotlán antes de salir a ruta. Deseamos resultados on-site inmediatos.",
    status: "Pendiente",
    history: "",
    date: "2026-05-25"
  },
  {
    id: "lead-4",
    name: "Daniel Garza",
    company: "RH Solutions México",
    role: "Coordinador de Selección",
    service: "Estudios Socioeconómicos",
    email: "dgarza@rhsolutions.com.mx",
    whatsapp: "3312345678",
    context: "Delegar por completo los estudios socioeconómicos de nuestros clientes sin que ellos sepan que subcontratamos. Necesitamos un maquilador rápido y formal que opere bajo nuestra marca.",
    status: "Pendiente",
    history: "",
    date: "2026-05-28"
  },
  {
    id: "lead-5",
    name: "Alejandra Ruiz",
    company: "Cemex México",
    role: "Gerente Regional de Capital Humano",
    service: "Reclutamiento de personal",
    email: "alejandra.ruiz@cemex.com",
    whatsapp: "5599887766",
    context: "Tenemos un incremento de volumen crítico para perfiles operativos de obra civil de urgencia. Necesitamos recibir una terna validada en los primeros 5 días hábiles hábiles de arranque.",
    status: "Pendiente",
    history: "",
    date: "2026-05-31"
  },
  {
    id: "lead-6",
    name: "Fernando Arroyo",
    company: "Optima Consultores B2B",
    role: "Asociado Director",
    service: "Evaluaciones de Psicometría",
    email: "f.arroyo@optimab2b.mx",
    whatsapp: "5511223344",
    context: "Queremos evaluar psicométricamente a un grupo de candidatos a gerencias comerciales con foco en valores de honestidad y toma de decisiones corporativas bajo presión.",
    status: "Pendiente",
    history: "",
    date: "2026-06-02"
  }
];

export const MAPPED_EMAILS: Record<string, string> = {
  "Conexión Ejecutiva": "antonio@conexion-ejecutiva.com",
  "Recurso Humano": "angeles@recurso.mx",
  "Nomipago": "comercial@nomipago.mx"
};

export const MAPPED_PHONES: Record<string, string> = {
  "Conexión Ejecutiva": "5552528474",
  "Recurso Humano": "5586385094",
  "Nomipago": ""
};

export const MAPPED_LOGOS: Record<string, string> = {
  "Conexión Ejecutiva": "https://assets.zyrosite.com/mv0jx9EpjqtvVQwL/logo-conexion-ejecutiva-84xrFITDnFmwdUj0.webp",
  "Recurso Humano": "https://assets.zyrosite.com/mv0jx9EpjqtvVQwL/logo-recurso-humano-Yg2l1O8NW6H1Ok4r.webp",
  "Nomipago": "https://assets.zyrosite.com/mv0jx9EpjqtvVQwL/logo-nomipago-xJIve4m4PMtAmyvE.webp"
};
