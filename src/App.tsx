import React, { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Building, 
  User, 
  RefreshCw, 
  Sliders, 
  Briefcase, 
  Shuffle, 
  Check, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  Star, 
  Trash, 
  Copy, 
  Mail, 
  Phone, 
  Info, 
  AlertTriangle,
  Flame,
  FileText,
  UserCheck,
  Building2,
  Bookmark,
  TrendingUp,
  Award,
  ChevronUp,
  ChevronDown,
  Database,
  Bell,
  LogOut
} from "lucide-react";
import { Lead, FavoriteTemplate, INITIAL_LEADS, MAPPED_EMAILS, MAPPED_PHONES, MAPPED_LOGOS } from "./types";
import { supabase } from "./supabaseClient";
import Login from "./components/Login";


// Helper to title case names while excluding specific prepositions
const toProperName = (text: string) => {
  if (!text) return "";
  const lowercaseWords = new Set(["de", "del", "la", "las", "el", "los", "a", "en", "y", "o", "con", "para", "por"]);
  
  // Split by keeping whitespace intact using regex capturing group
  return text.split(/(\s+)/).map((word, index) => {
    // If it's a whitespace group, keep it as is
    if (/^\s+$/.test(word)) return word;
    
    const lowercaseWord = word.toLowerCase();
    // Exclude specific words, unless it's the first word (index 0)
    if (index > 0 && lowercaseWords.has(lowercaseWord)) {
      return lowercaseWord;
    }
    if (word.length > 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word;
  }).join("");
};

// Helper to parse standard **bold** delimiters
const parseBoldText = (text: string) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-extrabold text-brand-text bg-brand-soft/75 px-1 py-0.5 rounded border border-brand-blue/30">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

// Helper to render formatted email body with paragraph spacing, standard HTML lists, and bolds
const renderFormattedEmail = (text: string) => {
  if (!text) return null;
  
  // Split by double newlines for paragraph spacing
  const paragraphs = text.split(/\r?\n\r?\n/);
  return (
    <div className="space-y-4 font-sans text-xs md:text-sm text-slate-700 leading-relaxed">
      {paragraphs.map((para, paraIdx) => {
        const trimmedPara = para.trim();
        if (!trimmedPara) return null;
        
        // check if this paragraph is composed of bullet lines
        const lines = trimmedPara.split(/\r?\n/);
        const hasBullets = lines.some(l => l.trim().startsWith("-"));
        
        if (hasBullets) {
          return (
            <ul key={paraIdx} className="list-disc pl-5 space-y-2 my-4">
              {lines.map((line, lineIdx) => {
                const trimmedLine = line.trim();
                const cleanLine = trimmedLine.startsWith("-") 
                  ? trimmedLine.substring(1).trim() 
                  : trimmedLine;
                
                if (!cleanLine) return null;
                return (
                  <li key={lineIdx} className="leading-relaxed">
                    {parseBoldText(cleanLine)}
                  </li>
                );
              })}
            </ul>
          );
        }
        
        return (
          <p key={paraIdx} className="leading-relaxed text-slate-700">
            {lines.map((line, lineIdx) => (
              <span key={lineIdx}>
                {parseBoldText(line)}
                {lineIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
};

const getStatusForBrand = (lead: Lead, brandName: string): "Pendiente" | "Contactado" | "Revisado" => {
  if (!lead) return "Pendiente";
  
  const cleanHistory = (lead.history || "").toLowerCase();
  const cleanBrand = brandName.toLowerCase();
  
  // Dividimos el historial en entradas individuales
  const entries = cleanHistory.split(";");
  
  const hasRevisadoEntry = entries.some(entry => {
    return entry.includes("revisado") && entry.includes(cleanBrand);
  });
  
  if (hasRevisadoEntry) {
    return "Revisado";
  }
  
  // Revisamos si tiene contacto por correo o whatsapp para esa marca
  const hasContactEntry = entries.some(entry => {
    const isContactType = entry.includes("correo") || entry.includes("whatsapp");
    return isContactType && entry.includes(cleanBrand);
  });
  
  if (hasContactEntry) {
    return "Contactado";
  }
  
  return "Pendiente";
};

export default function App() {
  // --- Persistent State ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [favorites, setFavorites] = useState<FavoriteTemplate[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "today" | "pending_ce" | "pending_rh" | "pending_np" | "alianzas" | "favorites">("all");
  
  // --- Sorting CRM states ---
  const [sortField, setSortField] = useState<string>("date");
  const [sortAsc, setSortAsc] = useState<boolean>(false); // default desc to show newest first!

  // --- Copywriting Generation Form State ---
  const [selectedBrand, setSelectedBrand] = useState<string>("Conexión Ejecutiva");
  const [selectedService, setSelectedService] = useState<string>("Estudios Socioeconómicos");
  const [forcedStrategy, setForcedStrategy] = useState<"AUTO" | "ALIANZA COMERCIAL" | "VENTA DIRECTA">("AUTO");

  // --- Active Proposals Outputs ---
  const [generatedSubject, setGeneratedSubject] = useState<string>("");
  const [generatedEmailBody, setGeneratedEmailBody] = useState<string>("");
  const [generatedWhatsapp, setGeneratedWhatsapp] = useState<string>("");
  const [appliedStrategy, setAppliedStrategy] = useState<string>("");
  const [crmInstructions, setCrmInstructions] = useState<any>(null);
  const [crmAlert, setCrmAlert] = useState<string>("");

  // --- UI Control States ---
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");
  const [activePreviewTab, setActivePreviewTab] = useState<"correo" | "whatsapp">("correo");

  // --- New Lead Form States ---
  const [isAddingLead, setIsAddingLead] = useState<boolean>(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadRole, setNewLeadRole] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadService, setNewLeadService] = useState("Estudios Socioeconómicos");
  const [newLeadContext, setNewLeadContext] = useState("");

  const [session, setSession] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // --- Fetch Leads from Supabase ---
  const fetchLeadsFromSupabase = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedLeads: Lead[] = data.map((l: any) => ({
          id: l.id.toString(),
          name: l.name || "",
          company: l.company || "",
          role: l.role || "",
          service: l.service || "",
          email: l.email || "",
          whatsapp: l.whatsapp || "",
          context: l.context || "",
          status: l.status || "Pendiente",
          history: l.history || "",
          lastBrandUsed: l.last_brand_used || "",
          lastChannelUsed: l.last_channel_used || undefined,
          contactedToday: l.contacted_today || false,
          date: l.date || new Date().toISOString().split("T")[0]
        }));
        setLeads(mappedLeads);
        if (mappedLeads.length > 0 && !activeLeadId) {
          setActiveLeadId(mappedLeads[0].id);
        }
      }
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      triggerToast(`⚠️ Error al cargar prospectos: ${err.message}`);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // --- Fetch Favorites from Supabase ---
  const fetchFavoritesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedFavs: FavoriteTemplate[] = data.map((f: any) => ({
          id: f.id.toString(),
          leadName: f.lead_name || "",
          company: f.company || "",
          service: f.service || "",
          brand: f.brand || "",
          mode: f.mode || "VENTA DIRECTA",
          subject: f.subject || "",
          emailBody: f.email_body || "",
          whatsappMessage: f.whatsapp_message || "",
          savedAt: f.saved_at || ""
        }));
        setFavorites(mappedFavs);
      }
    } catch (err: any) {
      console.error("Error fetching favorites:", err);
    }
  };

  // --- Sync Google Sheets to Supabase ---
  const fetchLeadsFromSheets = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sheets-leads");
      if (!response.ok) {
        throw new Error("No se pudo conectar con el servidor para jalar los leads.");
      }
      const data = await response.json();
      if (!data.success || !data.leads) {
        throw new Error(data.error || "La base regresó un formato no soportado.");
      }

      // Fetch existing leads to avoid duplicate imports
      const { data: existingLeads, error: fetchErr } = await supabase
        .from("leads")
        .select("name, company");

      if (fetchErr) throw fetchErr;

      const existingKeys = new Set(
        (existingLeads || []).map((l: any) => `${l.name.toLowerCase().trim()}-${l.company.toLowerCase().trim()}`)
      );

      const newLeads = data.leads.filter((l: any) => {
        const key = `${l.name.toLowerCase().trim()}-${l.company.toLowerCase().trim()}`;
        return !existingKeys.has(key);
      });

      if (newLeads.length === 0) {
        triggerToast("📊 Sincronización completa: no hay leads nuevos en Google Sheets.");
        await fetchLeadsFromSupabase(true);
        return;
      }

      const dbInserts = newLeads.map((l: any) => ({
        name: l.name,
        company: l.company,
        role: l.role,
        service: l.service,
        email: l.email,
        whatsapp: l.whatsapp,
        context: l.context,
        status: l.status,
        history: l.history,
        last_brand_used: l.lastBrandUsed || "",
        last_channel_used: l.lastChannelUsed || null,
        contacted_today: l.contactedToday || false,
        date: l.date || new Date().toISOString().split("T")[0]
      }));

      const { error: insertErr } = await supabase.from("leads").insert(dbInserts);
      if (insertErr) throw insertErr;

      triggerToast(`📊 Se importaron ${newLeads.length} leads nuevos desde Google Sheets a Supabase.`);
      await fetchLeadsFromSupabase(true);
    } catch (error: any) {
      console.error("Sheets sync error:", error);
      triggerToast(`⚠️ Error al sincronizar: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Auth Session Lifecycle ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchLeadsFromSupabase();
        fetchFavoritesFromSupabase();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchLeadsFromSupabase();
        fetchFavoritesFromSupabase();
      } else {
        setLeads([]);
        setFavorites([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    triggerToast("Sesión cerrada de forma segura.");
  };

  const activeLead = leads.find(l => l.id === activeLeadId);

  // --- Helper to trigger automated notifications ---
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  // --- Mode Detector ---
  const determineAutomaticMode = (companyName: string, postContext: string): "ALIANZA COMERCIAL" | "VENTA DIRECTA" => {
    const empLower = companyName.toLowerCase().trim();
    const cleanContext = postContext.toLowerCase().trim();

    // Regla de Exclusión Total (Venta Directa Obligatoria)
    const exclusionSectors = [
      "logistica", "logística", "manufactura", "canceleria", "cancelería", "construccion",
      "construcción", "alimentos", "retail", "tecnologia", "tecnología", "seguridad privada",
      "limpieza", "tamex"
    ];
    const isExclusion = exclusionSectors.some(sector => empLower.includes(sector));
    if (isExclusion) return "VENTA DIRECTA";

    // Análisis de contratación directa o plantilla propia
    const internalKeywords = [
      "plantilla", "nuestro equipo", "nuestro departamento", "vacante interna", "nuestra oficina",
      "para nosotros", "contratación directa", "incorporar a nuestro", "staff interno", "plantilla propia"
    ];
    const isInternal = internalKeywords.some(kw => cleanContext.includes(kw));
    if (isInternal) return "VENTA DIRECTA";

    // Criterio de Alianza Comercial
    const allianceSectors = [
      "agencia de empleo", "agencia de rh", "agencia de rrhh", "headhunter", "headhunting",
      "outsourcing", "consultoria de rh", "consultoria rh", "consultoría de rh", "consultoría rh",
      "consultora de rh", "consultora rh", "staffing", "human resources", "recursos humanos",
      "talent sourcing", "soluciones de talento", "consultor"
    ];
    const isRHPartner = allianceSectors.some(sector => empLower.includes(sector));
    if (isRHPartner) return "ALIANZA COMERCIAL";

    return "VENTA DIRECTA";
  };

  const currentMode = activeLead 
    ? (forcedStrategy === "AUTO" ? determineAutomaticMode(activeLead.company, activeLead.context) : forcedStrategy)
    : "VENTA DIRECTA";

  // --- Dynamically select correct default fields upon leading selection ---
  useEffect(() => {
    if (activeLead) {
      setSelectedService(activeLead.service);
      setForcedStrategy("AUTO");
      setGeneratedSubject("");
      setGeneratedEmailBody("");
      setGeneratedWhatsapp("");
      setAppliedStrategy("");
      setCrmInstructions(null);
      setCrmAlert("");
      setGenerationError("");
    }
  }, [activeLeadId]);

  // --- Call Gemini API for dynamic premium copywriting ---
  const handleGenerateCopywriting = async () => {
    if (!activeLead) {
      triggerToast("⚠️ Selecciona o agrega un lead primero.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/copywrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lead: {
            name: activeLead.name,
            company: activeLead.company,
            role: activeLead.role,
            context: activeLead.context
          },
          brand: selectedBrand,
          service: selectedService,
          forcedMode: forcedStrategy === "AUTO" ? "" : forcedStrategy
        })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "El servidor de IA falló al redactar el documento.");
      }

      if (res.success) {
        setGeneratedSubject(res.subject);
        setGeneratedEmailBody(res.emailBody);
        setGeneratedWhatsapp(res.whatsappMessage);
        setAppliedStrategy(res.strategyUsed);
        setCrmInstructions(res.crmUpdate);
        setCrmAlert(res.reminderAlert);
        triggerToast("✨ Propuesta B2B premium generada con éxito.");
      } else {
        throw new Error(res.error || "Fricción al generar contenido.");
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "No se pudo comunicar con el motor server-side de Gemini.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadCompany || !newLeadContext) {
      triggerToast("⚠️ Completa el Nombre, la Empresa y el Contexto.");
      return;
    }

    const nLeadDb = {
      name: newLeadName,
      company: newLeadCompany,
      role: newLeadRole || "Director de Operaciones",
      email: newLeadEmail || "contacto@empresa.mx",
      whatsapp: newLeadPhone || "5500000000",
      service: newLeadService,
      context: newLeadContext,
      status: "Pendiente",
      history: "",
      date: new Date().toISOString().split("T")[0],
      contacted_today: false,
      last_brand_used: "",
      last_channel_used: null
    };

    try {
      const { data, error } = await supabase.from("leads").insert([nLeadDb]).select();
      if (error) throw error;

      triggerToast("📂 Nuevo prospecto agregado al pipeline de Supabase.");
      await fetchLeadsFromSupabase(true);

      if (data && data[0]) {
        setActiveLeadId(data[0].id.toString());
      }

      // Reset Form Fields
      setNewLeadName("");
      setNewLeadCompany("");
      setNewLeadRole("");
      setNewLeadEmail("");
      setNewLeadPhone("");
      setNewLeadContext("");
      setIsAddingLead(false);
    } catch (err: any) {
      console.error("Error creating lead:", err);
      triggerToast(`⚠️ Error al guardar: ${err.message}`);
    }
  };

  // --- Action Handlers for Output ---
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`📋 ${label} copiado al portapapeles.`);
  };

  const handleLaunchDesktopOutlook = () => {
    if (!activeLead) return;
    const email = activeLead.email || "";
    if (!email) {
      triggerToast("⚠️ Este prospecto no tiene un correo registrado.");
      return;
    }

    const fromEmail = MAPPED_EMAILS[selectedBrand] || "antonio@conexion-ejecutiva.com";
    const cleanBodyForMailto = generatedEmailBody.replace(/\*\*/g, "");
    const bodyEncoded = encodeURIComponent(cleanBodyForMailto.replace(/\r?\n/g, "\r\n"));
    const subjectEncoded = encodeURIComponent(generatedSubject);
    
    // mailto formulation
    const mailtoUrl = `mailto:${email}?from=${encodeURIComponent(fromEmail)}&subject=${subjectEncoded}&body=${bodyEncoded}`;
    window.location.href = mailtoUrl;
    triggerToast(`📧 Redactando correo de forma segura desde ${fromEmail}...`);
  };

  const handleLaunchWhatsApp = () => {
    if (!activeLead) return;
    const phone = (activeLead.whatsapp || "").replace(/[^0-9]/g, "");
    if (!phone) {
      triggerToast("⚠️ Este prospecto no tiene número de WhatsApp registrado.");
      return;
    }

    const finalPhone = phone.length === 10 ? `52${phone}` : phone;
    const textEncoded = encodeURIComponent(generatedWhatsapp);
    const waUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${textEncoded}`;
    
    // Use programmatic anchor trigger to bypass strict sandbox/iframe popup blocks
    const link = document.createElement("a");
    link.href = waUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast("💬 Redactando contacto directo en WhatsApp...");
  };

  // --- Save Copy As Favorite ---
  const handleSaveAsFavorite = async () => {
    if (!activeLead || !generatedSubject || !generatedEmailBody) {
      triggerToast("⚠️ Primero genera una propuesta con IA.");
      return;
    }

    const isDuplicate = favorites.some(
      fav => fav.subject === generatedSubject && fav.emailBody === generatedEmailBody
    );

    if (isDuplicate) {
      triggerToast("💡 Esta propuesta ya está guardada en Exitos.");
      return;
    }

    const newFavDb = {
      lead_name: activeLead.name,
      company: activeLead.company,
      service: selectedService,
      brand: selectedBrand,
      mode: currentMode as "ALIANZA COMERCIAL" | "VENTA DIRECTA",
      subject: generatedSubject,
      email_body: generatedEmailBody,
      whatsapp_message: generatedWhatsapp,
      saved_at: new Date().toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    };

    try {
      const { error } = await supabase.from("favorites").insert([newFavDb]);
      if (error) throw error;

      triggerToast("⭐ Propuesta guardada en el catálogo de Éxitos de Supabase!");
      await fetchFavoritesFromSupabase();
    } catch (err: any) {
      console.error("Error saving favorite:", err);
      triggerToast(`⚠️ Error al guardar favorito: ${err.message}`);
    }
  };

  // --- Quick Mark as Sent (Directly from Table) ---
  const handleQuickMarkAsSent = async (targetLead: Lead, channel: "Correo" | "WhatsApp", e: React.MouseEvent) => {
    e.stopPropagation();
    
    const todayStr = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit"
    });

    const currentEntry = `[${todayStr} - ${channel} - ${selectedBrand}]; `;
    const updatedHistory = (targetLead.history || "") + currentEntry;

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status: "Contactado",
          last_brand_used: selectedBrand,
          last_channel_used: channel,
          contacted_today: true,
          history: updatedHistory
        })
        .eq("id", targetLead.id);

      if (error) throw error;

      triggerToast(`✔️ Registrado envío rápido por ${channel} a ${targetLead.name} (${selectedBrand}).`);
      await fetchLeadsFromSupabase(true);
    } catch (err: any) {
      console.error("Error quick marking as sent:", err);
      triggerToast(`⚠️ Error al registrar envío rápido: ${err.message}`);
    }
  };

  // --- Mark as Sent / Contacted ---
  const handleMarkAsSent = async (channel: "Correo" | "WhatsApp") => {
    if (!activeLead) return;

    const todayStr = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit"
    });

    const currentEntry = `[${todayStr} - ${channel} - ${selectedBrand}]; `;
    const updatedHistory = (activeLead.history || "") + currentEntry;

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status: "Contactado",
          last_brand_used: selectedBrand,
          last_channel_used: channel,
          contacted_today: true,
          history: updatedHistory
        })
        .eq("id", activeLead.id);

      if (error) throw error;

      triggerToast(`✔️ Registrado envío por ${channel} con la marca ${selectedBrand}.`);
      await fetchLeadsFromSupabase(true);
    } catch (err: any) {
      console.error("Error marking as sent:", err);
      triggerToast(`⚠️ Error al registrar envío: ${err.message}`);
    }
  };

  // --- Mark as Reviewed / Fully Tramitado ---
  const handleMarkAsReviewed = async () => {
    if (!activeLead) return;

    const todayStr = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit"
    });

    const currentEntry = `[${todayStr} - Revisado - ${selectedBrand}]; `;
    const updatedHistory = (activeLead.history || "") + currentEntry;
    const newStatus = activeLead.status === "Pendiente" ? "Contactado" : activeLead.status;

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status: newStatus,
          last_brand_used: selectedBrand,
          last_channel_used: "Revisado",
          contacted_today: true,
          history: updatedHistory
        })
        .eq("id", activeLead.id);

      if (error) throw error;

      triggerToast(`✅ Prospecto marcado como 'Revisado' para la marca ${selectedBrand}.`);
      await fetchLeadsFromSupabase(true);
    } catch (err: any) {
      console.error("Error marking as reviewed:", err);
      triggerToast(`⚠️ Error al marcar como revisado: ${err.message}`);
    }
  };

  // --- Delete Lead ---
  const handleDeleteLead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de eliminar este prospecto? Se eliminará permanentemente de Supabase.")) {
      try {
        const { error } = await supabase.from("leads").delete().eq("id", id);
        if (error) throw error;

        triggerToast("🗑️ Lead eliminado permanentemente de Supabase.");
        await fetchLeadsFromSupabase(true);
        if (activeLeadId === id) {
          setActiveLeadId("");
        }
      } catch (err: any) {
        console.error("Error deleting lead:", err);
        triggerToast(`⚠️ Error al eliminar: ${err.message}`);
      }
    }
  };

  // --- Delete Favorite Template ---
  const handleDeleteFavorite = async (id: string) => {
    if (confirm("¿Deseas quitar esta plantilla de tus favoritos?")) {
      try {
        const { error } = await supabase.from("favorites").delete().eq("id", id);
        if (error) throw error;

        triggerToast("🗑️ Plantilla eliminada de Exitos.");
        await fetchFavoritesFromSupabase();
      } catch (err: any) {
        console.error("Error deleting favorite:", err);
        triggerToast(`⚠️ Error al eliminar favorito: ${err.message}`);
      }
    }
  };

  // --- Retrieve Representative Manager Name ---
  const getRepresentativeName = (brand: string) => {
    if (brand === "Nomipago") return "Bruno Antonio Reyes";
    if (brand === "Recurso Humano") return "Christian Antonio Caballero";
    return "Antonio Pérez";
  };

  // --- Counter Calculations for Interactive KPIs ---
  const totalLeads = leads.length;
  const contactedTodayCount = leads.filter(l => l.contactedToday).length;

  const getPendingForBrand = (brandName: string): number => {
    return leads.filter(l => {
      return getStatusForBrand(l, brandName) === "Pendiente";
    }).length;
  };

  const pendingCE = getPendingForBrand("Conexión Ejecutiva");
  const pendingRH = getPendingForBrand("Recurso Humano");
  const pendingNP = getPendingForBrand("Nomipago");

  const allianceCount = leads.filter(l => determineAutomaticMode(l.company, l.context) === "ALIANZA COMERCIAL").length;
  const alliancePercentage = totalLeads > 0 ? Math.round((allianceCount / totalLeads) * 100) : 0;

  // --- Query Filter for Lead Pipeline ---
  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      l.name.toLowerCase().includes(term) || 
      l.company.toLowerCase().includes(term) || 
      l.role.toLowerCase().includes(term) || 
      l.service.toLowerCase().includes(term);

    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "today") return l.contactedToday && matchesSearch;
    if (activeFilter === "alianzas") {
      return determineAutomaticMode(l.company, l.context) === "ALIANZA COMERCIAL" && matchesSearch;
    }
    if (activeFilter === "pending_ce") {
      return getStatusForBrand(l, "Conexión Ejecutiva") === "Pendiente" && matchesSearch;
    }
    if (activeFilter === "pending_rh") {
      return getStatusForBrand(l, "Recurso Humano") === "Pendiente" && matchesSearch;
    }
    if (activeFilter === "pending_np") {
      return getStatusForBrand(l, "Nomipago") === "Pendiente" && matchesSearch;
    }
    return matchesSearch;
  });

  // --- Dynamic Sorting Logic ---
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // default: strings list is asc. date is desc (newer first)
      setSortAsc(field !== "date");
    }
  };

  const getFormattedDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const parts = dateString.split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const monthIndex = parseInt(month, 10) - 1;
        const monthLabel = months[monthIndex] || month;
        return `${day}-${monthLabel}-${year.slice(2)}`;
      }
    } catch (e) {}
    return dateString;
  };

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "company") {
      comparison = a.company.localeCompare(b.company);
    } else if (sortField === "role") {
      comparison = (a.role || "").localeCompare(b.role || "");
    } else if (sortField === "service") {
      comparison = a.service.localeCompare(b.service);
    } else if (sortField === "status") {
      const statusA = getStatusForBrand(a, selectedBrand);
      const statusB = getStatusForBrand(b, selectedBrand);
      comparison = statusA.localeCompare(statusB);
    } else if (sortField === "date") {
      comparison = (a.date || "").localeCompare(b.date || "");
    }
    return sortAsc ? comparison : -comparison;
  });

  const renderSortHeader = (label: string, field: string) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className="py-3 px-4 cursor-pointer hover:bg-slate-200/60 hover:text-slate-900 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isSorted ? (
              sortAsc ? (
                <ChevronUp className="h-3.5 w-3.5 text-indigo-600 font-bold" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-indigo-600 font-bold" />
              )
            ) : (
              <span className="text-slate-455 font-normal text-[10px]">⇅</span>
            )}
          </span>
        </div>
      </th>
    );
  };

  if (!session) {
    return (
      <Login 
        onLoginSuccess={() => {
          fetchLeadsFromSupabase();
          fetchFavoritesFromSupabase();
        }} 
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg text-brand-text font-sans antialiased relative">
      
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-brand-surface text-brand-text py-3 px-5 rounded-lg shadow-xl shadow-brand-blue/10 border border-brand-muted/20 flex items-center gap-3 animate-fade-in transition-all">
          <div className="h-2 w-2 rounded-full bg-brand-blue animate-pulse glow-indigo"></div>
          <span className="text-sm font-medium tracking-wide font-display">{toastMessage}</span>
        </div>
      )}

      {/* Primary Control Header */}
      <header className="bg-brand-surface text-brand-text py-4 px-6 md:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm border-b border-brand-muted/20">
        <div className="flex items-center gap-3">
          <img 
            src={MAPPED_LOGOS[selectedBrand] || "https://assets.zyrosite.com/mv0jx9EpjqtvVQwL/logo-conexion-ejecutiva-84xrFITDnFmwdUj0.webp"} 
            alt={selectedBrand} 
            className="h-10 md:h-12 w-auto object-contain bg-white p-1 rounded-lg border border-slate-200 shadow-sm"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-blue animate-pulse glow-indigo"></span>
              <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase font-display bg-gradient-to-r from-brand-text via-brand-blue to-brand-text bg-clip-text text-transparent">
                Centro de envío de correos
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-1 uppercase">
              Centro de envío de correos de Prospección México • v2.4 (React 19)
            </p>
          </div>
        </div>
        
        {/* Motivational Quote & Logout */}
        <div className="flex items-center gap-6 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="hidden md:flex flex-col items-end text-right">
            <p className="text-xs font-medium text-brand-text/90 italic border-r-2 border-brand-blue pr-3 py-1">
              "No vendas productos, vende soluciones a problemas."
            </p>
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted mt-1 pr-3">
              — Zig Ziglar
            </span>
          </div>
          
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-650 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-250 hover:border-red-200 cursor-pointer"
            title="Cerrar sesión de forma segura"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Dashboard KPI Panels */}
      <section className="bg-brand-surface border-b border-brand-muted/20 px-6 md:px-8 py-3.5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <button 
            type="button"
            onClick={() => setActiveFilter("all")} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "all" 
                ? "bg-brand-blue border-brand-blue text-white shadow-md glow-indigo ring-1 ring-brand-blue" 
                : "bg-brand-surface hover:bg-brand-soft border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "all" ? "text-brand-soft" : "text-brand-muted"}`}>Leads Totales</span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "all" ? "text-white" : "text-brand-text"}`}>{totalLeads}</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveFilter("today")} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "today" 
                ? "bg-brand-yellow border-brand-yellow text-brand-text shadow-md glow-emerald ring-1 ring-brand-yellow" 
                : "bg-brand-surface hover:bg-brand-soft/70 border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "today" ? "text-brand-text/70" : "text-yellow-600"}`}>
              Contactados Hoy
            </span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "today" ? "text-brand-text" : "text-brand-text"}`}>{contactedTodayCount}</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setActiveFilter("pending_ce");
              setSelectedBrand("Conexión Ejecutiva");
            }} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "pending_ce" 
                ? "bg-[#02A4F4] border-[#02A4F4] text-white shadow-md ring-1 ring-[#02A4F4]" 
                : "bg-brand-surface hover:bg-[#02A4F4]/10 border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "pending_ce" ? "text-white/80" : "text-brand-muted"}`}>Conexión Ejecutiva</span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "pending_ce" ? "text-white" : "text-brand-text"}`}>{pendingCE}</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setActiveFilter("pending_rh");
              setSelectedBrand("Recurso Humano");
            }} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "pending_rh" 
                ? "bg-[#F2AA45] border-[#F2AA45] text-brand-text shadow-md ring-1 ring-[#F2AA45]" 
                : "bg-brand-surface hover:bg-[#F2AA45]/10 border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "pending_rh" ? "text-brand-text/70" : "text-brand-muted"}`}>Recurso Humano</span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "pending_rh" ? "text-brand-text" : "text-brand-text"}`}>{pendingRH}</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setActiveFilter("pending_np");
              setSelectedBrand("Nomipago");
            }} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "pending_np" 
                ? "bg-brand-red border-brand-red text-white shadow-md ring-1 ring-brand-red" 
                : "bg-brand-surface hover:bg-brand-red/10 border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "pending_np" ? "text-white/80" : "text-brand-muted"}`}>Nomipago</span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "pending_np" ? "text-white" : "text-brand-text"}`}>{pendingNP}</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveFilter("alianzas")} 
            className={`flex flex-col px-4 py-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === "alianzas" 
                ? "bg-brand-blue-hover border-brand-blue-hover text-white shadow-md ring-1 ring-brand-blue-hover" 
                : "bg-brand-surface hover:bg-brand-soft border-brand-muted/20 text-brand-text"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === "alianzas" ? "text-white/80" : "text-brand-muted"}`}>Proporción Alianza</span>
            <span className={`text-xl md:text-2xl font-black font-display mt-0.5 ${activeFilter === "alianzas" ? "text-white" : "text-brand-text"}`}>{alliancePercentage}%</span>
          </button>

        </div>
      </section>

      {/* Main Core Section Layout */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form & Control Hub (grid-col-4) */}
        <section className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Active Proposal Controller panel */}
          <div className="bg-brand-surface rounded-lg border border-brand-muted/20 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-brand-soft/30 text-brand-text px-5 py-3 flex justify-between items-center border-b border-brand-muted/20">
              <span className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest">
                <Sliders className="h-4 w-4 text-brand-blue" /> Control de Prospección
              </span>
              <span className={`text-[9px] px-2.5 py-0.5 font-extrabold uppercase rounded-full tracking-wider ${
                currentMode === "ALIANZA COMERCIAL" 
                  ? "bg-brand-red text-white shadow-sm border border-brand-red/80" 
                  : "bg-[#2ECC71] text-white shadow-sm border border-emerald-600"
              }`}>
                {currentMode === "ALIANZA COMERCIAL" ? "Alianza" : "Venta Directa"}
              </span>
            </div>

            {leads.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm">No existen prospectos registrados en tu pipeline.</p>
                <button 
                  type="button" 
                  onClick={() => setIsAddingLead(true)} 
                  className="mt-3 text-xs text-indigo-600 font-bold hover:underline"
                >
                  Agregar Prospecto Nuevo
                </button>
              </div>
            ) : !activeLead ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-sm">Selecciona un prospecto de la tabla de abajo para iniciar.</p>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                
                {/* Active Lead Summary Card */}
                <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-3.5 text-xs flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Contacto</span>
                    <span className="font-semibold text-slate-900">{activeLead.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Empresa</span>
                    <span className="font-extrabold text-indigo-900 tracking-tight">{activeLead.company}</span>
                  </div>

                  {activeLead.role && (
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Cargo</span>
                      <span className="text-slate-700">{activeLead.role}</span>
                    </div>
                  )}

                  {activeLead.email && (
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Correo</span>
                      <span className="text-slate-700 font-mono text-[11px] selection:bg-indigo-100 select-all">{activeLead.email}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Teléfono (WhatsApp)</span>
                    {activeLead.whatsapp ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-700 font-mono text-[11px] selection:bg-indigo-100 select-all">{activeLead.whatsapp}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const newPhone = prompt("Editar teléfono (10 dígitos):", activeLead.whatsapp);
                            if (newPhone !== null) {
                              const cleaned = newPhone.replace(/\D/g, "");
                              if (cleaned.length === 10 || cleaned === "") {
                                try {
                                  const { error } = await supabase
                                    .from("leads")
                                    .update({ whatsapp: cleaned })
                                    .eq("id", activeLead.id);
                                  if (error) throw error;
                                  triggerToast("📞 Teléfono actualizado con éxito.");
                                  await fetchLeadsFromSupabase(true);
                                } catch (err: any) {
                                  console.error("Error updating phone:", err);
                                  triggerToast(`⚠️ Error al actualizar teléfono: ${err.message}`);
                                }
                              } else {
                                alert("Por favor ingresa un teléfono válido de 10 dígitos.");
                              }
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] underline ml-1 cursor-pointer"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const newPhone = prompt("Ingresa el teléfono del lead (10 dígitos):");
                          if (newPhone) {
                            const cleaned = newPhone.replace(/\D/g, "");
                            if (cleaned.length === 10) {
                              try {
                                const { error } = await supabase
                                  .from("leads")
                                  .update({ whatsapp: cleaned })
                                  .eq("id", activeLead.id);
                                if (error) throw error;
                                triggerToast("📞 Teléfono agregado con éxito.");
                                await fetchLeadsFromSupabase(true);
                              } catch (err: any) {
                                console.error("Error adding phone:", err);
                                triggerToast(`⚠️ Error al agregar teléfono: ${err.message}`);
                              }
                            } else {
                              alert("Por favor ingresa un teléfono válido de 10 dígitos.");
                            }
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 font-semibold text-[10px] flex items-center gap-1 cursor-pointer bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50 transition-colors"
                      >
                        <Plus className="h-2.5 w-2.5 text-rose-500" /> Agregar Teléfono
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Servicio Sugerido</span>
                    <span className="text-slate-800 font-medium">{activeLead.service}</span>
                  </div>

                  <div className="flex flex-col gap-1 mt-1">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Contexto / Dolor Detectado</span>
                    <p className="text-brand-text italic bg-brand-soft p-2.5 rounded border border-brand-muted/20 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar font-sans text-[11px]">
                      "{activeLead.context}"
                    </p>
                  </div>
                </div>

                {/* Brand Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Marca Emisora de Campaña</label>
                  <select 
                    value={selectedBrand} 
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Conexión Ejecutiva">Conexión Ejecutiva (Antonio Pérez)</option>
                    <option value="Recurso Humano">Recurso Humano (Christian Antonio Caballero)</option>
                    <option value="Nomipago">Nomipago (Bruno Antonio Reyes)</option>
                  </select>


                </div>

                {/* Service Overriding */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtro de Servicio Especializado</label>
                  <select 
                    value={selectedService} 
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Estudios Socioeconómicos">Estudios Socioeconómicos</option>
                    <option value="Reclutamiento de personal">Reclutamiento de personal</option>
                    <option value="Pruebas de Polígrafo">Pruebas de Polígrafo</option>
                    <option value="Evaluaciones de Psicometría">Evaluaciones de Psicometría</option>
                    <option value="Pruebas Antidoping Rápidas">Pruebas Antidoping Rápidas</option>
                  </select>
                </div>

                {/* Direct Strategy Override Switcher */}
                <div className="flex flex-col gap-1 pb-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estrategia Operacional</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button 
                      type="button"
                      onClick={() => setForcedStrategy("AUTO")}
                      className={`text-[9px] uppercase font-bold py-1.5 rounded-md text-center cursor-pointer transition-colors ${
                        forcedStrategy === "AUTO" 
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Automático
                    </button>
                    <button 
                      type="button"
                      onClick={() => setForcedStrategy("ALIANZA COMERCIAL")}
                      className={`text-[9px] uppercase font-bold py-1.5 rounded-md text-center cursor-pointer transition-colors ${
                        forcedStrategy === "ALIANZA COMERCIAL" 
                          ? "bg-red-600 text-white shadow-sm" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Alianza
                    </button>
                    <button 
                      type="button"
                      onClick={() => setForcedStrategy("VENTA DIRECTA")}
                      className={`text-[9px] uppercase font-bold py-1.5 rounded-md text-center cursor-pointer transition-colors ${
                        forcedStrategy === "VENTA DIRECTA" 
                          ? "bg-emerald-600 text-white shadow-sm" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Venta Directa
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 pl-1 leading-snug italic">
                    {forcedStrategy === "AUTO" 
                      ? `Inteligencia de IA sugiere: "${currentMode}" basado en el tipo de negocio.`
                      : `Forzado manual a: "${forcedStrategy}" para esta propuesta corporativa.`
                    }
                  </p>
                </div>

                {generationError && (
                  <div className="bg-amber-50 text-amber-900 text-xs p-3 rounded-lg border border-amber-200 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="leading-snug">{generationError}</p>
                  </div>
                )}

                {/* Principal CTA Generation */}
                <button
                  type="button"
                  onClick={handleGenerateCopywriting}
                  disabled={isGenerating}
                  className={`relative w-full text-xs font-bold text-white uppercase py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md transform hover:-translate-y-0.5 active:translate-y-0 ${
                    isGenerating 
                      ? "bg-slate-400 cursor-not-allowed" 
                      : "bg-brand-blue hover:bg-brand-blue-hover"
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      Redactando Propuesta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-indigo-300" />
                      Generar Mensaje con IA
                    </>
                  )}
                </button>

              </div>
            )}
          </div>

          {/* Quick Creator of New Leads */}
          <div className="bg-brand-surface rounded-lg border border-brand-muted/20 shadow-sm overflow-hidden text-xs">
            <button 
              type="button"
              onClick={() => setIsAddingLead(!isAddingLead)}
              className="w-full bg-brand-soft/40 hover:bg-brand-soft flex justify-between items-center px-4 py-3 border-b border-brand-muted/20 cursor-pointer font-bold text-brand-text"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-500" /> Agregar Prospecto Manual
              </span>
              <span className="text-[10px] text-indigo-600 font-black tracking-widest uppercase">
                {isAddingLead ? "Cerrar" : "Ampliar"}
              </span>
            </button>

            {isAddingLead && (
              <form onSubmit={handleCreateLead} className="p-4 flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre del Lead</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Sofia Martínez"
                      value={newLeadName}
                      onChange={(e) => setNewLeadName(toProperName(e.target.value))}
                      className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Soriana"
                      value={newLeadCompany}
                      onChange={(e) => setNewLeadCompany(toProperName(e.target.value))}
                      className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cargo / Rol</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Gerente de RH"
                      value={newLeadRole}
                      onChange={(e) => setNewLeadRole(toProperName(e.target.value))}
                      className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto WhatsApp</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 5512345678"
                      value={newLeadPhone}
                      onChange={(e) => setNewLeadPhone(e.target.value)}
                      className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo Corporativo</label>
                  <input 
                    type="email" 
                    placeholder="ejemplo@soriana.com.mx"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Servicio de Interés</label>
                  <select 
                    value={newLeadService} 
                    onChange={(e) => setNewLeadService(e.target.value)}
                    className="border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Estudios Socioeconómicos">Estudios Socioeconómicos</option>
                    <option value="Reclutamiento de personal">Reclutamiento de personal</option>
                    <option value="Pruebas de Polígrafo">Pruebas de Polígrafo</option>
                    <option value="Evaluaciones de Psicometría">Evaluaciones de Psicometría</option>
                    <option value="Pruebas Antidoping Rápidas">Pruebas Antidoping Rápidas</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resumen / Contexto / Dolor del Post</label>
                  <textarea 
                    rows={3}
                    placeholder="Copia aquí el dolor post de la empresa o contexto de su búsqueda..."
                    value={newLeadContext}
                    onChange={(e) => setNewLeadContext(e.target.value)}
                    className="border border-brand-muted/20 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue resize-none"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-bold py-2 rounded uppercase text-[10px] tracking-wider transition-colors"
                >
                  Guardar y Seleccionar
                </button>
              </form>
            )}
          </div>

        </section>

        {/* Right Column: Proposals Generated Outputs (grid-col-8) */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Main Workspace Preview Wrapper */}
          <div className="bg-brand-surface rounded-lg border border-brand-muted/20 shadow-sm flex flex-col min-h-[580px]">
            
            {/* Header Tabs for Correo vs WhatsApp vs Exitos */}
            <div className="bg-brand-soft/40 border-b border-brand-muted/20 px-5 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter(activeFilter === "favorites" ? "all" : activeFilter);
                    setActivePreviewTab("correo");
                  }}
                  className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                    activePreviewTab === "correo" && activeFilter !== "favorites"
                      ? "bg-brand-blue text-white border-brand-blue shadow-md"
                      : "bg-brand-surface hover:bg-brand-soft text-brand-muted border-brand-muted/20 shadow-sm"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5 text-blue-400" /> Correo Ejecutivo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter(activeFilter === "favorites" ? "all" : activeFilter);
                    setActivePreviewTab("whatsapp");
                  }}
                  className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                    activePreviewTab === "whatsapp" && activeFilter !== "favorites"
                      ? "bg-[#075E54] text-white border-teal-800"
                      : "bg-brand-surface hover:bg-brand-soft text-brand-muted border-brand-muted/20 shadow-sm"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Directo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("favorites");
                  }}
                  className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                    activeFilter === "favorites"
                      ? "bg-brand-yellow text-brand-text border-brand-yellow shadow-md"
                      : "bg-brand-surface hover:bg-brand-soft text-brand-muted border-brand-muted/20 shadow-sm"
                  }`}
                >
                  <Star className="h-3.5 w-3.5 text-brand-text fill-brand-text" /> Catálogo de Éxitos ({favorites.length})
                </button>
              </div>

              {/* Status Header info */}
              {activeLead && activeFilter !== "favorites" && (
                <div className="text-[10px] text-brand-muted flex items-center gap-2 font-mono">
                  <span>Modo: <strong className="text-brand-text uppercase">{currentMode}</strong></span>
                  <span>•</span>
                  <span>Marca: <strong className="text-brand-text">{selectedBrand}</strong></span>
                </div>
              )}
            </div>

            {/* PREVIEW CONTAINER BODIES */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              
              {activeFilter === "favorites" ? (
                /* SECTION: EXITO FAVORITES BOARD */
                <div className="flex-1 flex flex-col gap-4">
                  <div className="border-b border-indigo-100 pb-2">
                    <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-500 fill-amber-300" /> Copys de Alto Rendimiento Guardados
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Este catálogo alimenta de forma implícita el aprendizaje empírico de tus futuras propuestas comerciales.
                    </p>
                  </div>

                  {favorites.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                      <Bookmark className="h-12 w-12 text-slate-200 mb-2" />
                      <p className="text-sm">Aún no has guardado ninguna propuesta como favorita.</p>
                      <p className="text-xs mt-1 text-slate-400">Haz clic en "Like & Guardar" cuando generes una propuesta excelente.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                      {favorites.map((fav) => (
                        <div key={fav.id} className="border border-brand-muted/20 bg-brand-surface rounded-lg p-4 flex flex-col gap-3 relative hover:shadow-md transition-shadow">
                          <button 
                            type="button" 
                            onClick={() => handleDeleteFavorite(fav.id)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-red-500 cursor-pointer p-1"
                            title="Descartar favorito"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex flex-col gap-0.5 text-[10px] font-mono text-slate-500">
                            <div>Lead: <strong className="text-slate-800">{fav.leadName}</strong> ({fav.company})</div>
                            <div>Servicio: <strong className="text-slate-700">{fav.service}</strong></div>
                            <div>Marca: <strong className="text-slate-700">{fav.brand}</strong> • {fav.mode}</div>
                          </div>

                          <div className="text-xs text-slate-800 border-t border-slate-200 pt-2.5">
                            <div className="font-extrabold text-slate-900 border-b pb-1 mb-1 bg-slate-100/70 p-1 rounded">Asunto: {fav.subject}</div>
                            <div className="max-h-24 overflow-y-auto w-full custom-scrollbar leading-relaxed font-sans pr-1 italic text-[11px] whitespace-pre-wrap">
                              {fav.emailBody}
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-400 flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded">
                            <span>{fav.savedAt}</span>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => handleCopy(fav.emailBody, "Propuesta completa")}
                                className="text-indigo-600 hover:underline font-bold"
                              >
                                Copiar Correo
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleCopy(fav.whatsappMessage, "Formato WhatsApp")}
                                className="text-emerald-600 hover:underline font-bold"
                              >
                                Copiar WA
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activePreviewTab === "correo" ? (
                /* SECTION: EMAIL BODY PREVIEW TEMPLATE */
                <div className="flex-1 flex flex-col gap-4">
                  
                  {/* Line of Business Subject */}
                  <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-250 p-3 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Línea de Asunto Comercial
                    </span>
                    <div className="flex justify-between items-center gap-3">
                      <p className="text-xs md:text-sm font-extrabold tracking-tight text-slate-800 font-display">
                        {generatedSubject || "Asunto de alto impacto para apertura..."}
                      </p>
                      {generatedSubject && (
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedSubject, "Asunto")}
                          className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                          title="Copiar exclusivamente el Asunto"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Main Editorial Editor Reader */}
                  <div className="flex-1 flex flex-col border border-brand-muted/20 rounded-lg overflow-hidden min-h-[300px] bg-brand-surface">
                    <div className="bg-brand-soft/40 border-b border-brand-muted/20 px-4 py-2 flex justify-between items-center text-[10px] font-mono text-brand-muted">
                      <span>De: {MAPPED_EMAILS[selectedBrand]}</span>
                      <span>Para: {activeLead?.email || "contacto@empresa.mx"}</span>
                    </div>

                    <div className="p-5 flex-1 relative overflow-y-auto max-h-[360px] custom-scrollbar text-xs leading-relaxed text-slate-705 pr-2">
                      {generatedEmailBody ? (
                        renderFormattedEmail(generatedEmailBody)
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-sans p-6 text-center">
                          <Mail className="h-10 w-10 text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-500">Buzón de propuesta vacío</p>
                          <p className="text-xs mt-1">Haz clic en "Generar Mensaje con IA" a la izquierda para redactar una propuesta ejecutiva mexicana de alta tasa de apertura en frío.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attachment Box simulator */}
                  {generatedEmailBody && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-3 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-red-150 border border-red-200 flex items-center justify-center font-black text-red-700 font-display text-[9px]">
                          PDF
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            Presentación de {selectedService} - {selectedBrand}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Auto-vinculado para: {activeLead?.company || "Prospecto"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 italic">
                        Inserto automático
                      </span>
                    </div>
                  )}

                </div>
              ) : (
                /* SECTION: WHATSAPP SMART BUBBLE SIMULATOR */
                <div className="flex-1 flex flex-col gap-4">
                  
                  <div className="flex-1 bg-[#E5DDD5] border border-slate-300 rounded-lg shadow-inner overflow-hidden flex flex-col min-h-[380px] relative">
                    
                    {/* Simulated Mobile Header */}
                    <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold font-display">
                          {activeLead?.name.slice(0, 2).toUpperCase() || "WA"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white tracking-wide">
                            {activeLead?.name || "Lic. Ricardo Valenzuela"}
                          </p>
                          <p className="text-[9px] text-slate-200 font-medium">
                            En línea • {activeLead?.company || "Empresa"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-[10px] px-2.5 py-0.5 roundedbg-black/10 text-emerald-200 font-mono tracking-widest uppercase">
                        SOPORTE DE NEGRITAS *
                      </div>
                    </div>

                    {/* Chat Bubbles Feed */}
                    <div className="flex-1 p-5 flex flex-col justify-end overflow-y-auto max-h-[300px] custom-scrollbar">
                      
                      {generatedWhatsapp ? (
                        <div className="bg-[#DCF8C6] border border-black/5 rounded-lg p-4 shadow-sm text-xs text-slate-850 max-w-[85%] self-end relative leading-relaxed whitespace-pre-wrap font-sans">
                          {generatedWhatsapp}
                          <span className="text-[9px] text-slate-400 block text-right mt-1.5 font-mono">
                            {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-450 p-6 text-center font-sans">
                          <MessageSquare className="h-10 w-10 text-slate-350 mb-2" />
                          <p className="text-sm font-bold">Sin mensaje de WhatsApp</p>
                          <p className="text-[11px] max-w-sm mt-1">
                            Genera la propuesta con la IA a la izquierda para formatear el mensaje con negritas y emojis optimizados para WhatsApp.
                          </p>
                        </div>
                      )}

                    </div>

                    {/* Simulated visual footer label */}
                    <div className="absolute bottom-2 left-4 text-[9px] font-black text-slate-400 tracking-widest uppercase">
                      Voz Móvil de {getRepresentativeName(selectedBrand)}
                    </div>
                  </div>

                </div>
              )}

              {/* ACTION BUTTONS TOOLBAR */}
              {generatedSubject && activeFilter !== "favorites" && (
                <div className="border-t border-slate-200 pt-5 mt-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 -mx-6 -mb-6 p-5 rounded-b-lg">
                  
                  {/* Left Controls: Bookmarking & Reviews */}
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveAsFavorite}
                      className="bg-white hover:bg-amber-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-250 cursor-pointer flex items-center justify-center gap-2 hover:border-amber-400 transition-all shadow-sm"
                      title="Guardar propuesta en Éxitos"
                    >
                      <Star className="h-4 w-4 text-amber-500 fill-amber-400" /> Like & Guardar
                    </button>

                    <button
                      type="button"
                      onClick={handleMarkAsReviewed}
                      className="bg-white hover:bg-slate-150 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-250 cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm"
                      title="Marcar este prospecto como tramitado"
                    >
                      <CheckCircle className="h-4 w-4 text-slate-500" /> Revisado
                    </button>
                  </div>

                  {/* Right Controls: Desktop Dispatchers */}
                  <div className="flex gap-2.5 flex-1 sm:flex-initial">
                    {activePreviewTab === "correo" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedEmailBody, "Cuerpo del Correo")}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-250 cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 transition-colors"
                        >
                          <Copy className="h-4 w-4" /> Copiar Cuerpo
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleLaunchDesktopOutlook();
                            handleMarkAsSent("Correo");
                          }}
                          className="bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                          <Mail className="h-4 w-4 text-indigo-300" /> Abrir Outlook y Enviar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedWhatsapp, "Mensaje de WhatsApp")}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-250 cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 transition-colors"
                        >
                          <Copy className="h-4 w-4" /> Copiar Mensaje
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleLaunchWhatsApp();
                            handleMarkAsSent("WhatsApp");
                          }}
                          className="bg-[#25D366] hover:bg-[#1ebd59] text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                          <Phone className="h-4 w-4" /> Abrir WhatsApp Web
                        </button>
                      </>
                    )}
                  </div>
                  
                </div>
              )}
              
              {/* CRM Instructions Suggestion Panel */}
              {crmInstructions && (
                <div className="mt-4 border border-brand-blue/30 bg-brand-soft/20 rounded-lg p-4 animate-fade-in text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-display uppercase tracking-widest text-brand-blue font-bold mb-1 border-b border-brand-blue/20 pb-2">
                    <Database className="h-4 w-4" /> Recomendaciones CRM del Estratega AI
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-brand-muted text-[10px] font-mono">Próxima Acción / Tipo:</span>
                      <strong className="text-brand-text">{crmInstructions?.Proxima_Accion || "N/A"} - {crmInstructions?.Tipo_Accion || "N/A"}</strong>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-brand-muted text-[10px] font-mono">Última Marca Sugerida:</span>
                      <strong className="text-brand-text">{crmInstructions?.Ultima_Marca_Usada || "N/A"}</strong>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-brand-muted text-[10px] font-mono">Notas de Bitácora sugeridas:</span>
                    <p className="text-brand-text/90 italic bg-brand-surface p-2 rounded border border-brand-muted/10 leading-relaxed font-sans text-[11px]">
                      {crmInstructions?.Notas_CRM || ""}
                    </p>
                  </div>
                  
                  {crmAlert && (
                    <div className="mt-2 bg-brand-yellow/10 border-l-2 border-brand-yellow px-3 py-2 text-brand-text flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-brand-yellow" />
                      <span className="font-medium text-[10px]">{crmAlert}</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </section>
      </main>

      {/* FOOTER SECTION: Pipeline database structure (Lead table) */}
      <footer className="bg-brand-surface border-t border-brand-muted/20 px-6 md:px-8 py-5 flex flex-col gap-4 shadow-inner mt-4">
        
        {/* Pipeline Title, Filters and Searches */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 font-display flex items-center gap-2">
              <Building className="h-4.5 w-4.5 text-indigo-500" /> Base Operativa de Prospectos (CRM)
            </h2>
            <p className="text-[11px] text-slate-500">
              Registros cargados de forma interactiva y ordenados de más recientes a antiguos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
            {/* Search inputs */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por candidato, empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-brand-surface hover:bg-brand-soft border border-brand-muted/30 rounded-lg py-2 pl-9 pr-4 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Sync with Google Sheets Button */}
            <button
              type="button"
              onClick={() => fetchLeadsFromSheets()}
              disabled={isSyncing}
              className={`text-xs px-3.5 py-2 rounded-lg font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isSyncing
                  ? "bg-brand-surface text-brand-muted border-brand-muted/20 cursor-not-allowed"
                  : "bg-brand-soft hover:bg-brand-soft/70 text-brand-blue border-brand-blue/30"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Sheets"}
            </button>

            {/* Clear Status Button filters */}
            {activeFilter !== "all" && activeFilter !== "favorites" && (
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                Resetear Filtros
              </button>
            )}
          </div>
        </div>

        {/* Dynamic CRM Grid Table of Leads */}
        <div className="border border-brand-muted/20 rounded-lg overflow-x-auto bg-brand-surface">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-brand-soft/40 border-b border-brand-muted/20 text-brand-muted font-display uppercase tracking-wider text-[9px] font-extrabold select-none">
                <th className="py-3 px-4 text-center">Canal</th>
                {renderSortHeader("Nombre / Publicador", "name")}
                {renderSortHeader("Empresa / Corporativo", "company")}
                {renderSortHeader("Cargo / Decisor", "role")}
                {renderSortHeader("Servicio de Interés", "service")}
                {renderSortHeader("Estatus Actual", "status")}
                {renderSortHeader("Fecha", "date")}
                <th className="py-3 px-4">Último Impacto</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-[11px]">
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-450 italic">
                    No se encontraron prospectos aplicando el filtro de búsqueda.
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => {
                  const isSelected = lead.id === activeLeadId;
                  const isAllianceType = determineAutomaticMode(lead.company, lead.context) === "ALIANZA COMERCIAL";

                  return (
                    <tr 
                      key={lead.id}
                      onClick={() => {
                        setActiveLeadId(lead.id);
                        triggerToast(`🎯 Seleccionado: ${lead.name}. Elige marca, servicio y haz clic en "Generar Mensaje con IA" abajo.`);
                      }}
                      className={`hover:bg-brand-soft/20 cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-brand-soft border-l-4 border-l-brand-blue font-medium" 
                          : ""
                      }`}
                    >
                      {/* Interactive Visual Canal Circle Indicator */}
                      <td className="py-3 px-4 text-center">
                        <span 
                          className={`inline-block h-3.5 w-3.5 rounded-full border shadow-sm ${
                            getStatusForBrand(lead, selectedBrand) === "Revisado"
                              ? "bg-slate-400 border-slate-500"
                              : getStatusForBrand(lead, selectedBrand) === "Contactado"
                              ? "bg-amber-400 border-amber-500 ring-2 ring-amber-300/35"
                              : "bg-[#2ECC71] border-emerald-500"
                          }`}
                          title={
                            getStatusForBrand(lead, selectedBrand) === "Revisado"
                              ? `Lead completamente tramitado para ${selectedBrand}`
                              : getStatusForBrand(lead, selectedBrand) === "Contactado"
                              ? `Contactado previamente por la marca ${selectedBrand}`
                              : `Prospecto fresco libre para contactar con ${selectedBrand}`
                          }
                        />
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {lead.name}
                      </td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900">{lead.company}</span>
                          {isAllianceType && (
                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border border-red-200">
                              Alianza Co.
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {lead.role}
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium text-[10px]">
                          {lead.service}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold">
                        <span className={`inline-block px-2.2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                          getStatusForBrand(lead, selectedBrand) === "Revisado"
                            ? "bg-slate-200/80 text-slate-600"
                            : getStatusForBrand(lead, selectedBrand) === "Contactado"
                            ? "bg-amber-100 text-amber-800 border border-amber-300/60"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300/60"
                        }`}>
                          {getStatusForBrand(lead, selectedBrand) === "Revisado" ? "Tramitado" : getStatusForBrand(lead, selectedBrand)}
                        </span>
                      </td>

                      {/* Display Lead Date (antiquity tracker) */}
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-550 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{getFormattedDate(lead.date)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                        {lead.lastBrandUsed ? (
                          <span>
                            {lead.lastBrandUsed} • <strong className="text-slate-700">{lead.lastChannelUsed}</strong>
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Sin contactos previos</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {getStatusForBrand(lead, selectedBrand) === "Pendiente" && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => handleQuickMarkAsSent(lead, "Correo", e)}
                                className="text-slate-400 hover:text-brand-blue p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                                title={`Marcar enviado por Correo (${selectedBrand})`}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleQuickMarkAsSent(lead, "WhatsApp", e)}
                                className="text-slate-400 hover:text-[#25D366] p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                                title={`Marcar enviado por WhatsApp (${selectedBrand})`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLeadId(lead.id);
                              triggerToast(`🎯 Prospecto seleccionado. Elige marca, servicio y haz clic en "Generar Mensaje con IA" abajo.`);
                            }}
                            className={`px-2.5 py-1 rounded font-bold uppercase text-[9px] transition-colors cursor-pointer border ${
                              isSelected 
                                ? "bg-brand-blue hover:bg-brand-blue-hover text-white border-brand-blue border-b-2" 
                                : "bg-brand-surface hover:bg-brand-soft text-brand-blue border-brand-blue/30"
                            }`}
                          >
                            {isSelected ? "Seleccionado" : "Seleccionar"}
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => handleDeleteLead(lead.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 cursor-pointer"
                            title="Eliminar lead"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Global Warning Gold Rules */}
        <div className="bg-brand-surface border border-brand-muted/20 text-brand-text rounded-lg p-3.5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <div className="text-[10px] text-brand-muted">
            Regla Estratégica Mexicana de Oro: <strong className="text-brand-red uppercase tracking-widest font-bold ml-1.5">Cero Comisiones | Marca Blanca</strong>
          </div>
          <div className="text-[10px] text-brand-muted font-mono flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-blue animate-pulse glow-indigo"></span> Conexión Ejecutiva • Nomipago • Recurso Humano
          </div>
        </div>

      </footer>

    </div>
  );
}
