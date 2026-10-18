/**
 * Agência Ninja — Módulo de Automações, Integrações e Exportações
 * Suporte a n8n Webhook, Evolution API, WhatsApp 1-Click e Exportação Excel pt-BR
 */

const NinjaAutomations = (() => {
  "use strict";

  const SETTINGS_KEY = "ninja_scraper_settings_v1";

  const DEFAULT_SETTINGS = {
    n8nWebhookUrl: "https://n8n.seudominio.com.br/webhook/ninja-leads",
    evolutionApiUrl: "http://evolution-api:8080",
    evolutionInstance: "ninja-comercial",
    evolutionApiKey: "",
    waTemplate: "Olá! Sou da Agência Ninja. Estive analisando o perfil da {empresa} no Google e identifiquei excelentes oportunidades para escalar a captação de clientes de vocês com IA e automações. Podemos conversar?",
    useProxy: false,
    proxyUrl: ""
  };

  const getSettings = () => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  };

  const saveSettings = (newSettings) => {
    try {
      const current = getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error("Erro ao salvar configurações:", e);
      return null;
    }
  };

  /**
   * Extrai e formata número de telefone brasileiro para wa.me
   */
  const getWhatsAppNumber = (phoneStr) => {
    if (!phoneStr) return null;
    let digits = String(phoneStr).replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) {
      digits = digits.slice(2);
    }
    // DDD + 9 dígitos (celular)
    if (digits.length === 11 && digits[2] === "9") {
      return `55${digits}`;
    }
    return null;
  };

  /**
   * Gera link direto para o WhatsApp com a mensagem personalizada
   */
  const buildWhatsAppLink = (lead) => {
    const waNumber = getWhatsAppNumber(lead.phone);
    if (!waNumber) return null;

    const settings = getSettings();
    let text = settings.waTemplate || DEFAULT_SETTINGS.waTemplate;
    text = text.replace(/{empresa}/gi, lead.title || "sua empresa")
               .replace(/{categoria}/gi, lead.category || "")
               .replace(/{nota}/gi, lead.review_rating || "5.0")
               .replace(/{cidade}/gi, lead.city || "sua região");

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  };

  /**
   * Dispara um lote de leads para o Webhook do n8n
   */
  const triggerN8nWebhook = async (leads, jobName = "Coleta Agência Ninja") => {
    const settings = getSettings();
    const url = settings.n8nWebhookUrl;
    if (!url || !url.startsWith("http")) {
      throw new Error("URL do Webhook do n8n não configurada. Abra as Configurações.");
    }

    const payload = {
      source: "AgenciaNinja-LeadScraper",
      job_name: jobName,
      timestamp: new Date().toISOString(),
      total_leads: leads.length,
      leads: leads.map(l => ({
        empresa: l.title,
        categoria: l.category,
        telefone: l.phone,
        whatsapp_numero: getWhatsAppNumber(l.phone) || "",
        tem_whatsapp: !!getWhatsAppNumber(l.phone),
        email: l.emails || "",
        website: l.website || "",
        nota: parseFloat(l.review_rating) || 0,
        avaliacoes: parseInt(l.review_count) || 0,
        endereco: l.address || "",
        maps_link: l.link || ""
      }))
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`O n8n retornou status ${res.status}`);
    }

    return true;
  };

  /**
   * Utilitário para forçar download de arquivo no navegador
   */
  const downloadBlob = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const escapeCSV = (val, sep) => {
    const str = String(val ?? "");
    return str.includes(sep) || str.includes('"') || str.includes("\n") || str.includes("\r")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const HEADERS = [
    "Nome da Empresa", "Categoria", "Telefone", "WhatsApp Válido", 
    "E-mails", "Website", "Nota Google", "Total Avaliações", "Endereço", "Link Google Maps"
  ];

  const mapLeadRow = (r) => [
    r.title || "",
    r.category || "",
    r.phone || "",
    getWhatsAppNumber(r.phone) ? "Sim (" + getWhatsAppNumber(r.phone) + ")" : "Não",
    r.emails || "",
    r.website || "",
    r.review_rating ? String(r.review_rating).replace(".", ",") : "",
    r.review_count || "0",
    r.address || "",
    r.link || ""
  ];

  return {
    getSettings,
    saveSettings,
    getWhatsAppNumber,
    buildWhatsAppLink,
    triggerN8nWebhook,

    /**
     * Exporta CSV otimizado para Excel pt-BR (UTF-8 BOM + separador ;)
     */
    exportExcel(filename, leads) {
      const sep = ";";
      const headerLine = HEADERS.map(h => escapeCSV(h, sep)).join(sep);
      const rows = leads.map(l => mapLeadRow(l).map(v => escapeCSV(v, sep)).join(sep));
      const csvContent = "\ufeff" + [headerLine, ...rows].join("\r\n");
      downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, csvContent, "text/csv;charset=utf-8;");
    },

    /**
     * Exporta CSV padrão para Google Sheets (separador vírgula)
     */
    exportGoogleSheets(filename, leads) {
      const sep = ",";
      const headerLine = HEADERS.map(h => escapeCSV(h, sep)).join(sep);
      const rows = leads.map(l => mapLeadRow(l).map(v => escapeCSV(v, sep)).join(sep));
      const csvContent = "\ufeff" + [headerLine, ...rows].join("\r\n");
      downloadBlob(filename.endsWith(".csv") ? filename : `${filename}-sheets.csv`, csvContent, "text/csv;charset=utf-8;");
    },

    /**
     * Copia tabela para área de transferência em formato TSV
     */
    async copyClipboardTSV(leads) {
      const sep = "\t";
      const headerLine = HEADERS.join(sep);
      const rows = leads.map(l => mapLeadRow(l).map(v => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join(sep));
      const tsv = [headerLine, ...rows].join("\n");
      await navigator.clipboard.writeText(tsv);
      return true;
    },

    /**
     * Exporta em JSON estruturado
     */
    exportJSON(filename, leads) {
      const jsonStr = JSON.stringify(leads, null, 2);
      downloadBlob(filename.endsWith(".json") ? filename : `${filename}.json`, jsonStr, "application/json");
    }
  };
})();
