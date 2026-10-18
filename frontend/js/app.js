/**
 * Agência Ninja — Lead Scraper Dashboard Master Controller
 * Gerenciamento reativo de estado, fila de buscas, filtros e disparos n8n
 */

(() => {
  "use strict";

  // Estado Central da Aplicação
  const state = {
    jobs: [],
    stats: {},
    activeJobId: null,
    leads: [],
    filteredLeads: [],
    geo: null,
    radius: 15,
    depth: 15,
    currentSource: "gmaps",
    g123Pages: 1,
    isSubmitting: false,
    pollTimer: null,
    isDemo: false
  };

  const G123_JOBS_KEY = "ninja_g123_jobs_v1";

  const loadG123Jobs = () => {
    try {
      return JSON.parse(localStorage.getItem(G123_JOBS_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const saveG123Jobs = (jobs) => {
    try {
      localStorage.setItem(G123_JOBS_KEY, JSON.stringify(jobs));
    } catch {}
  };

  const loadG123Leads = (jobId) => {
    try {
      return JSON.parse(localStorage.getItem(`ninja_g123_leads_${jobId}`) || "[]");
    } catch {
      return [];
    }
  };

  const saveG123Leads = (jobId, leads) => {
    try {
      localStorage.setItem(`ninja_g123_leads_${jobId}`, JSON.stringify(leads));
    } catch {}
  };

  const SYNONYMS_MAP = {
    dentista: ["odontologia", "clínica odontológica", "cirurgião dentista"],
    dentistas: ["odontologia", "clínica odontológica", "cirurgião dentista"],
    odontologia: ["dentista", "clínica odontológica", "cirurgião dentista"],
    "clínica odontológica": ["dentista", "odontologia", "ortodontia"],
    médico: ["clínica médica", "consultório médico"],
    médicos: ["clínica médica", "consultório médico"],
    advogado: ["advocacia", "escritório de advocacia"],
    advogados: ["advocacia", "escritório de advocacia"],
    imobiliária: ["imóveis", "corretor de imóveis"],
    imobiliárias: ["imóveis", "corretor de imóveis"],
    estética: ["clínica de estética", "estética e beleza"],
    fisioterapia: ["clínica de fisioterapia", "fisioterapeuta"],
    academia: ["fitness", "musculação"],
    restaurante: ["gastronomia", "lanchonete"]
  };

  const getZoomForRadius = (km) => {
    if (km <= 5) return 14;
    if (km <= 10) return 13;
    if (km <= 20) return 12;
    if (km <= 35) return 11;
    return 10;
  };

  const getFormattedExportName = (job) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `dia-${day}-${month}-${year}`;

    if (!job) return `Leads-Ninja-${dateStr}`;

    const formatSegment = (str) => {
      return (str || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .split(/[\s,_\-\/]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("_");
    };

    // Caso seja busca do Guia Comercial G123
    if (job.source === "g123" || String(job.id).startsWith("g123")) {
      const cleanNiche = formatSegment(job.term || "Geral");
      const cleanCity = formatSegment(job.cityName || "Regional");
      return `Leads-G123-${cleanNiche}-${cleanCity}-${dateStr}`;
    }

    let niche = "Leads";
    let city = "";

    const match = job.name.match(/Ninja\s*·\s*([^(\n]+)(?:\(([^)]+)\))?/i);
    if (match) {
      niche = match[1].trim();
      if (match[2]) city = match[2].trim();
    } else if (job.keywords && job.keywords[0]) {
      const parts = job.keywords[0].split(/\s+em\s+/i);
      niche = parts[0] || "Leads";
      if (parts[1]) city = parts[1];
    } else {
      niche = job.name || "Leads";
    }

    const cleanNiche = formatSegment(niche) || "Empresas";
    const cleanCity = city ? formatSegment(city) : "";

    if (cleanCity) {
      return `Leads-${cleanNiche}-${cleanCity}-${dateStr}`;
    }
    return `Leads-${cleanNiche}-${dateStr}`;
  };

  const DEMO_JOBS = [
    {
      id: "demo-1",
      name: "Ninja · Clínicas Odontológicas (Curitiba)",
      date: new Date(Date.now() - 3600000).toISOString(),
      status: "ok",
      keywords: ["Clínicas Odontológicas em Curitiba PR"],
      depth: 5,
      email: true
    },
    {
      id: "demo-2",
      name: "Ninja · Imobiliárias de Alto Padrão (São Paulo)",
      date: new Date(Date.now() - 7200000).toISOString(),
      status: "ok",
      keywords: ["Imobiliárias em Jardins, São Paulo"],
      depth: 10,
      email: true
    },
    {
      id: "demo-3",
      name: "Ninja · Estética Avançada (Florianópolis)",
      date: new Date().toISOString(),
      status: "working",
      keywords: ["Clínicas de Estética em Florianópolis"],
      depth: 5,
      email: false
    }
  ];

  const DEMO_LEADS_MAP = {
    "demo-1": [
      {
        title: "Oral Unic Implantes & Estética Curitiba",
        category: "Clínica Odontológica",
        phone: "(41) 99123-4567",
        emails: "contato@oralunic.com.br",
        website: "https://oralunic.com.br",
        review_rating: "4.9",
        review_count: "214",
        address: "Av. do Batel, 1500 - Batel, Curitiba - PR",
        link: "https://maps.google.com"
      },
      {
        title: "Dr. Felipe Becker - Odontologia Integrada",
        category: "Dentista",
        phone: "(41) 98877-6655",
        emails: "agendamento@drfelipebecker.com.br",
        website: "https://drfelipebecker.com.br",
        review_rating: "5.0",
        review_count: "89",
        address: "Rua Comendador Araújo, 499 - Centro, Curitiba - PR",
        link: "https://maps.google.com"
      },
      {
        title: "Studio Oral Prime - Lentes e Alinhadores",
        category: "Clínica Odontológica",
        phone: "(41) 99988-1122",
        emails: "recepcao@oralprimecuritiba.com",
        website: "https://oralprimecuritiba.com",
        review_rating: "4.8",
        review_count: "152",
        address: "Rua Padre Anchieta, 2050 - Bigorrilho, Curitiba - PR",
        link: "https://maps.google.com"
      },
      {
        title: "Clínica Sorriso & Arte Batel",
        category: "Ortodontista",
        phone: "(41) 98456-7890",
        emails: "contato@sorrisoeart.com.br",
        website: "https://sorrisoeart.com.br",
        review_rating: "4.7",
        review_count: "67",
        address: "Alameda Dr. Carlos de Carvalho, 1200 - Batel, Curitiba - PR",
        link: "https://maps.google.com"
      },
      {
        title: "Harmonia Dental & Facial",
        category: "Clínica Odontológica",
        phone: "(41) 99234-5678",
        emails: "atendimento@harmoniadental.com.br",
        website: "https://harmoniadental.com.br",
        review_rating: "4.9",
        review_count: "112",
        address: "Av. Cândido de Abreu, 526 - Centro Cívico, Curitiba - PR",
        link: "https://maps.google.com"
      }
    ],
    "demo-2": [
      {
        title: "Bela Imóveis Jardins - Mansões & Coberturas",
        category: "Imobiliária",
        phone: "(11) 98765-4321",
        emails: "contato@belaimoveis.com.br",
        website: "https://belaimoveis.com.br",
        review_rating: "5.0",
        review_count: "180",
        address: "Rua Oscar Freire, 1100 - Jardins, São Paulo - SP",
        link: "https://maps.google.com"
      },
      {
        title: "Invista Prime Consultoria Imobiliária",
        category: "Agência Imobiliária",
        phone: "(11) 99123-8899",
        emails: "vip@invistaprime.com.br",
        website: "https://invistaprime.com.br",
        review_rating: "4.9",
        review_count: "95",
        address: "Av. Brigadeiro Faria Lima, 2200 - Pinheiros, São Paulo - SP",
        link: "https://maps.google.com"
      },
      {
        title: "Nova Capital Negócios Imobiliários",
        category: "Imobiliária",
        phone: "(11) 97654-3210",
        emails: "diretoria@novacapital.com.br",
        website: "https://novacapital.com.br",
        review_rating: "4.8",
        review_count: "74",
        address: "Alameda Lorena, 1400 - Jardins, São Paulo - SP",
        link: "https://maps.google.com"
      }
    ]
  };

  // Utilitários de DOM
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const fmt = (n) => (+n || 0).toLocaleString("pt-BR");

  // Notificação Toast Neon
  function showToast(msg, duration = 4000) {
    const toast = $("#ninja-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  // Parseador de CSV robusto (RFC 4180)
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (c !== "\r") {
        field += c;
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [header, ...lines] = rows;
    if (!header) return [];
    header[0] = header[0].replace(/^\ufeff/, "");
    return lines
      .filter(r => r.length > 1)
      .map(r => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] || "").trim()])));
  }

  // Cálculo de tempo relativo (ex: há 5 min)
  function timeAgo(dateIso) {
    if (!dateIso) return "";
    const sec = Math.max(0, (Date.now() - new Date(dateIso).getTime()) / 1000);
    if (sec < 60) return "agora";
    if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`;
    return new Date(dateIso).toLocaleDateString("pt-BR");
  }

  // ============================================================================
  // ATUALIZAÇÃO DE JOBS E METRICAS (KPIS)
  // ============================================================================

  async function refreshJobs() {
    try {
      const prevJobs = state.jobs;
      let backendJobs = [];
      try {
        backendJobs = await NinjaAPI.getJobs();
        updateEngineStatus(true);
      } catch (beErr) {
        if (!state.isDemo) {
          console.warn("API Go offline ou estática:", beErr);
        }
      }

      const localG123 = loadG123Jobs();
      localG123.forEach(gj => {
        if (!state.stats[gj.id]) {
          const l = loadG123Leads(gj.id);
          const wa = l.filter(x => x.has_whatsapp || NinjaAutomations.getWhatsAppNumber(x.phone)).length;
          state.stats[gj.id] = { total: l.length, wa, email: 0, site: 0 };
        }
      });

      const merged = [...localG123, ...backendJobs].sort((a, b) => new Date(b.date) - new Date(a.date));
      state.jobs = merged.length > 0 ? merged : (state.isDemo ? DEMO_JOBS : []);
      renderJobsList();
      updateGlobalKPIs();

      // Se nenhum job estiver ativo, abre o mais recente concluído
      if (!state.activeJobId && state.jobs.length > 0) {
        const firstOk = state.jobs.find(j => j.status === "ok");
        if (firstOk) selectJob(firstOk.id);
      } else if (state.activeJobId && !String(state.activeJobId).startsWith("g123")) {
        // Se a busca Google Maps que está aberta acabou de finalizar, recarrega a tabela na hora!
        const prevActive = prevJobs.find(j => j.id === state.activeJobId);
        const currActive = state.jobs.find(j => j.id === state.activeJobId);
        if (currActive && currActive.status === "ok" && (!prevActive || prevActive.status !== "ok" || state.leads.length === 0)) {
          selectJob(state.activeJobId);
          showToast("🎉 Coleta Ninja finalizada! Leads atualizados na tela.", 5000);
        }
      }
    } catch (e) {
      updateEngineStatus(false);
      console.warn("API offline ou ambiente estático. Ativando Modo Demonstração.");
      if (!state.isDemo) initDemoMode();
    }
  }

  function initDemoMode() {
    state.isDemo = true;
    const localG123 = loadG123Jobs();
    state.jobs = [...localG123, ...DEMO_JOBS];
    state.stats["demo-1"] = { total: 5, wa: 5, email: 5, site: 5 };
    state.stats["demo-2"] = { total: 3, wa: 3, email: 3, site: 3 };
    state.stats["demo-3"] = { total: 0, wa: 0, email: 0, site: 0 };
    updateEngineStatus(true);
    renderJobsList();
    updateGlobalKPIs();
    if (!state.activeJobId) selectJob("demo-1");
  }

  function updateEngineStatus(isOnline) {
    const el = $("#engine-status");
    if (!el) return;
    const dot = el.querySelector(".pulse-dot");
    const text = el.querySelector(".status-text");
    if (state.isDemo) {
      dot.className = "pulse-dot online";
      text.textContent = "Motor Online & G123 Ativo";
      el.title = "Visualizando motor híbrido (Google Maps + Guia G123).";
    } else if (isOnline) {
      dot.className = "pulse-dot online";
      text.textContent = "Motor Híbrido Online";
    } else {
      dot.className = "pulse-dot offline";
      text.textContent = "Offline";
    }
  }

  function updateGlobalKPIs() {
    const completedJobs = state.jobs.filter(j => j.status === "ok");
    const runningJobs = state.jobs.filter(j => j.status === "working" || j.status === "pending");

    $("#kpi-total-jobs").textContent = fmt(state.jobs.length);
    $("#kpi-jobs-hint").textContent = runningJobs.length ? `${runningJobs.length} em execução` : `${completedJobs.length} concluídas`;

    // Soma métricas dos leads carregados
    let totalLeads = 0, withWa = 0, withEmail = 0, withSite = 0;
    Object.values(state.stats).forEach(s => {
      if (s.total) {
        totalLeads += s.total;
        withWa += s.wa;
        withEmail += s.email;
        withSite += s.site;
      }
    });

    $("#kpi-total-leads").textContent = fmt(totalLeads);
    $("#kpi-with-wa").textContent = fmt(withWa);
    $("#kpi-wa-pct").textContent = totalLeads ? `${Math.round((withWa / totalLeads) * 100)}% dos leads` : "0%";
    $("#kpi-with-email").textContent = fmt(withEmail);
    $("#kpi-email-pct").textContent = totalLeads ? `${Math.round((withEmail / totalLeads) * 100)}% com e-mail` : "0%";
  }

  function renderJobsList() {
    const container = $("#jobs-list");
    if (!container) return;

    if (state.jobs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.88rem;">
          Nenhuma busca realizada ainda.<br>Crie sua primeira coleta no painel ao lado.
        </div>
      `;
      return;
    }

    container.innerHTML = state.jobs.map(j => {
      const isSelected = j.id === state.activeJobId;
      const statusMap = {
        ok: { text: "Concluído", class: "badge-success" },
        working: { text: "Coletando...", class: "badge-cyan" },
        pending: { text: "Na Fila", class: "badge-warning" },
        failed: { text: "Falhou", class: "badge-danger" }
      };
      const st = statusMap[j.status] || { text: j.status, class: "badge-cyan" };
      const jobStat = state.stats[j.id];
      const countDisplay = jobStat && jobStat.total != null ? `<b>${fmt(jobStat.total)}</b><span>leads</span>` : "";

      const isG123 = j.source === "g123" || String(j.id).startsWith("g123");
      const sourceBadge = isG123
        ? '<span class="job-source-tag g123">G123</span>'
        : '<span class="job-source-tag gmaps">GMaps</span>';

      return `
        <div class="job-item ${j.status} ${isSelected ? "active-job" : ""}" data-id="${esc(j.id)}">
          <div class="job-main-info">
            <div class="job-title-text" title="${esc(j.name)}">${sourceBadge}${esc(j.name)}</div>
            <div class="job-meta-row">
              <span class="ninja-badge ${st.class}">${st.text}</span>
              <span>${esc(timeAgo(j.date))}</span>
              ${j.email ? '<span class="badge-cyan" style="font-size: 0.7rem;">+Emails</span>' : ''}
            </div>
          </div>
          <div class="job-leads-count">${countDisplay}</div>
          <div class="job-actions-btns">
            <button class="icon-btn-danger" data-action="delete" title="Excluir busca">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // ============================================================================
  // SELEÇÃO E EXIBIÇÃO DE LEADS
  // ============================================================================

  async function selectJob(jobId) {
    state.activeJobId = jobId;
    renderJobsList();

    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    const isG123 = job.source === "g123" || String(jobId).startsWith("g123");

    // Tratamento para buscas do Guia Comercial G123
    if (isG123) {
      $("#active-job-title").textContent = job.name || "Guia Comercial G123";
      const statusText = job.status === "working" 
        ? "⚡ Extraindo do Guia Comercial G123..." 
        : `Concluído ${timeAgo(job.date)}`;
      $("#active-job-subtitle").textContent = `${job.cityName || "Catálogo Regional"} · ${statusText}`;

      if (job.status === "working") {
        $("#leads-table-body").innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 50px 20px;">
              <div style="display: inline-block; width: 42px; height: 42px; border: 3px solid rgba(157, 78, 221, 0.2); border-top-color: var(--neon-purple-soft); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px;"></div>
              <div style="font-size: 1.15rem; font-weight: 700; color: var(--neon-purple-soft); margin-bottom: 8px;">
                ⚡ Extraindo Leads do Guia Comercial G123...
              </div>
              <div style="color: var(--text-secondary); font-size: 0.9rem; max-width: 500px; margin: 0 auto; line-height: 1.6;">
                Baixando páginas do catálogo e identificando telefones e WhatsApp.<br>
                <span id="g123-live-status" style="color: var(--neon-cyan); font-weight: 600; font-size: 0.85rem;">Conectando ao catálogo...</span>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const leads = loadG123Leads(jobId);
      state.leads = leads;
      const waCount = leads.filter(l => l.has_whatsapp || NinjaAutomations.getWhatsAppNumber(l.phone)).length;
      state.stats[jobId] = { total: leads.length, wa: waCount, email: 0, site: 0 };
      populateCategories(leads);
      applyFilters();
      updateGlobalKPIs();
      return;
    }

    $("#active-job-title").textContent = job.name || "Leads Coletados";
    const statusText = job.status === "working" ? "⚡ Coletando no Google Maps..." : (job.status === "pending" ? "⏳ Na fila de espera..." : `Concluído ${timeAgo(job.date)}`);
    $("#active-job-subtitle").textContent = `${(job.keywords || []).join(", ")} · ${statusText}`;

    if (job.status === "working" || job.status === "pending") {
      $("#leads-table-body").innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 50px 20px;">
            <div style="display: inline-block; width: 42px; height: 42px; border: 3px solid rgba(0, 245, 212, 0.2); border-top-color: var(--neon-cyan); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px;"></div>
            <div style="font-size: 1.15rem; font-weight: 700; color: var(--neon-cyan); margin-bottom: 8px;">
              ⚡ Coletando Leads no Google Maps...
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem; max-width: 500px; margin: 0 auto; line-height: 1.6;">
              O motor está varrendo os locais e navegando nos sites para coletar telefones e e-mails.<br>
              <span style="color: var(--neon-cyan); font-weight: 600; font-size: 0.85rem;">Assim que terminar, a tabela atualizará automaticamente nesta tela!</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      $("#leads-table-body").innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--neon-cyan);">Carregando leads da Agência Ninja...</td></tr>`;
    }

    try {
      let leads = [];
      if (state.isDemo && DEMO_LEADS_MAP[jobId]) {
        leads = DEMO_LEADS_MAP[jobId];
      } else {
        const csvRaw = await NinjaAPI.downloadJobCSV(jobId);
        leads = parseCSV(csvRaw);
      }

      if (leads && leads.length > 0) {
        state.leads = leads;
        // Atualiza cache de estatísticas deste job
        const waCount = leads.filter(l => NinjaAutomations.getWhatsAppNumber(l.phone)).length;
        const emailCount = leads.filter(l => (l.emails || "").includes("@")).length;
        const siteCount = leads.filter(l => l.website).length;
        state.stats[jobId] = { total: leads.length, wa: waCount, email: emailCount, site: siteCount };

        populateCategories(leads);
        applyFilters();
        updateGlobalKPIs();
      } else if (job.status === "ok") {
        state.leads = [];
        $("#leads-table-body").innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum lead encontrado pelo Google para este raio e nicho. Tente aumentar o raio ou usar termos adicionais.</td></tr>`;
      }
    } catch (e) {
      if (job.status === "working" || job.status === "pending") {
        // Mantém o estado de carregamento animado ativo
      } else if (state.isDemo && DEMO_LEADS_MAP["demo-1"]) {
        const fallbackLeads = DEMO_LEADS_MAP["demo-1"];
        state.leads = fallbackLeads;
        populateCategories(fallbackLeads);
        applyFilters();
        updateGlobalKPIs();
      } else {
        $("#leads-table-body").innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--color-danger);">Nenhum lead encontrado para esta busca ou busca ainda não iniciada.</td></tr>`;
      }
    }
  }

  function populateCategories(leads) {
    const sel = $("#filter-category");
    if (!sel) return;
    const cats = [...new Set(leads.map(l => l.category).filter(Boolean))].sort();
    sel.innerHTML = `<option value="">Todas as Categorias (${leads.length})</option>` +
      cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  }

  function applyFilters() {
    const q = ($("#search-leads").value || "").toLowerCase().trim();
    const cat = $("#filter-category").value;
    const onlyWa = $("#filter-only-wa").checked;
    const onlyEmail = $("#filter-only-email").checked;
    const onlySite = $("#filter-only-site").checked;
    const dedupe = $("#filter-dedupe").checked;

    let res = state.leads.filter(l => {
      const hasWa = !!(l.has_whatsapp || NinjaAutomations.getWhatsAppNumber(l.phone));
      const hasEmail = (l.emails || "").includes("@");
      const hasSite = !!l.website;

      if (onlyWa && !hasWa) return false;
      if (onlyEmail && !hasEmail) return false;
      if (onlySite && !hasSite) return false;
      if (cat && l.category !== cat) return false;
      if (q) {
        const fullText = [l.title, l.category, l.phone, l.address, l.website, l.emails].join(" ").toLowerCase();
        if (!fullText.includes(q)) return false;
      }
      return true;
    });

    if (dedupe) {
      const seen = new Set();
      res = res.filter(l => {
        const key = NinjaAutomations.getWhatsAppNumber(l.phone) || l.raw_phone || l.phone || (l.title + l.address);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    state.filteredLeads = res;
    renderLeadsTable();
  }

  function renderLeadsTable() {
    const tbody = $("#leads-table-body");
    const countEl = $("#filtered-count");
    if (countEl) countEl.textContent = `${fmt(state.filteredLeads.length)} de ${fmt(state.leads.length)} leads`;

    if (state.filteredLeads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum lead encontrado com os filtros aplicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.filteredLeads.map((l, idx) => {
      const waLink = NinjaAutomations.buildWhatsAppLink(l);
      const rating = parseFloat(l.review_rating) || 0;
      const reviews = parseInt(l.review_count) || 0;

      return `
        <tr data-idx="${idx}">
          <td>
            <div class="lead-company-cell">
              <div class="company-title">${esc(l.title || l.name || "Sem Nome")}</div>
              <div class="company-cat">${esc(l.category || "Empresa Local")}</div>
            </div>
          </td>
          <td>
            <div class="contact-links-group">
              ${waLink ? `
                <a href="${waLink}" target="_blank" rel="noopener" class="wa-btn-direct" title="Abrir conversa no WhatsApp">
                  <span>🟢 WhatsApp</span>
                </a>
              ` : (l.phone ? `<span style="font-size: 0.85rem; color: var(--text-main);">${esc(l.phone)}</span>` : '<span style="color: var(--text-muted); font-size: 0.8rem;">Sem telefone</span>')}
              ${l.emails ? `<a href="mailto:${esc(l.emails)}" class="email-link">${esc(String(l.emails).split(/[\s,;]+/)[0])}</a>` : ''}
              ${l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener" class="website-link">🔗 ${esc(l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 26))}</a>` : ''}
            </div>
          </td>
          <td>
            ${rating > 0 ? `
              <div class="rating-badge">
                <span>★</span> ${rating.toFixed(1)}
                <span class="reviews-count">(${fmt(reviews)})</span>
              </div>
            ` : '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>'}
          </td>
          <td style="max-width: 280px; font-size: 0.82rem; color: var(--text-secondary);">
            ${esc((l.address || "").replace((l.title || "") + " - ", ""))}
          </td>
          <td>
            ${l.link ? `
              <a href="${esc(l.link)}" target="_blank" rel="noopener" class="btn-ninja-outline" style="padding: 4px 10px; font-size: 0.78rem;">
                Maps ↗
              </a>
            ` : (l.url ? `
              <a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn-ninja-outline" style="padding: 4px 10px; font-size: 0.78rem;">
                Guia ↗
              </a>
            ` : '—')}
          </td>
        </tr>
      `;
    }).join("");
  }

  // ============================================================================
  // CRIAÇÃO DE NOVA BUSCA (LAUNCHPAD)
  // ============================================================================

  async function handleCreateJob(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    const keywordInput = $("#keyword-input");
    const locationInput = $("#location-input");
    const keyword = (keywordInput.value || "").trim();
    const location = (locationInput.value || "").trim();

    if (!keyword) {
      showToast("Digite o que deseja buscar (ex: dentistas, clínicas).");
      keywordInput.focus();
      return;
    }
    if (!location) {
      showToast("Digite a cidade ou bairro desejado.");
      locationInput.focus();
      return;
    }

    const submitBtn = $("#btn-submit-job");
    state.isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Iniciando Coleta...";

    try {
      let geo = state.geo;
      if (!geo) {
        geo = await NinjaAPI.geocode(location);
        state.geo = geo;
      }

      // Suporte a múltiplos termos separados por vírgula no nicho
      const rawTerms = keyword.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      const searchTerms = [...rawTerms];

      // Expansão inteligente de sinônimos para trazer muito mais leads
      const expandSynonyms = $("#opt-synonyms") ? $("#opt-synonyms").checked : true;
      if (expandSynonyms) {
        rawTerms.forEach(t => {
          const lower = t.toLowerCase().trim();
          if (SYNONYMS_MAP[lower]) {
            SYNONYMS_MAP[lower].forEach(syn => {
              if (!searchTerms.includes(syn)) searchTerms.push(syn);
            });
          }
        });
      }

      // Constrói lista de keywords completas com o local
      const keywords = searchTerms.map(term => `${term} em ${location}`);
      const zoomLevel = getZoomForRadius(state.radius);

      const payload = {
        name: `Ninja · ${rawTerms.join(", ")} (${location.split(",")[0].trim()})`,
        keywords: keywords,
        lat: geo ? String(geo.lat) : "0",
        lon: geo ? String(geo.lon) : "0",
        zoom: zoomLevel,
        radius: state.radius * 1000,
        depth: state.depth,
        email: $("#opt-email").checked,
        fast_mode: $("#opt-fast").checked,
        lang: "pt",
        max_time: Math.min(3600, Math.max(900, keywords.length * 300))
      };

      if (state.isDemo) {
        const simJob = {
          id: "sim-" + Date.now(),
          name: payload.name,
          date: new Date().toISOString(),
          status: "working",
          keywords: payload.keywords,
          depth: payload.depth,
          email: payload.email
        };
        state.jobs.unshift(simJob);
        renderJobsList();
        showToast("⚡ [Preview] Busca simulada! Processando leads...", 5000);
        keywordInput.value = "";
        setTimeout(() => {
          simJob.status = "ok";
          state.stats[simJob.id] = { total: 2, wa: 2, email: 2, site: 2 };
          DEMO_LEADS_MAP[simJob.id] = [
            {
              title: `${keyword} Prime (${location})`,
              category: keyword,
              phone: "(11) 99888-7766",
              emails: "contato@empresaexemplo.com.br",
              website: "https://empresaexemplo.com.br",
              review_rating: "5.0",
              review_count: "42",
              address: `Av. Principal, 100 - ${location}`,
              link: "https://maps.google.com"
            },
            {
              title: `Excelência & Associados - ${keyword}`,
              category: keyword,
              phone: "(11) 98765-1122",
              emails: "atendimento@doutorexemplo.com.br",
              website: "https://doutorexemplo.com.br",
              review_rating: "4.9",
              review_count: "88",
              address: `Rua Comercial, 50 - ${location}`,
              link: "https://maps.google.com"
            }
          ];
          renderJobsList();
          updateGlobalKPIs();
          selectJob(simJob.id);
          showToast(`✓ [Preview] Coleta concluída para: ${keyword}!`, 5000);
        }, 3000);
        return;
      }

      await NinjaAPI.createJob(payload);
      showToast("Busca criada com sucesso! Acompanhe o progresso na fila.", 5000);
      keywordInput.value = "";
      await refreshJobs();
    } catch (err) {
      showToast(err.message || "Erro ao criar busca.", 6000);
    } finally {
      state.isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Iniciar Coleta Ninja";
    }
  }

  // ============================================================================
  // CRIAÇÃO DE BUSCA NO GUIA COMERCIAL G123 (TURBO REGIONAL)
  // ============================================================================

  async function handleCreateG123Job(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    const citySelect = $("#g123-city-select");
    const keywordInput = $("#g123-keyword-input");
    const citySlug = citySelect ? citySelect.value : "salto-do-lontra-pr";
    const cityName = citySelect && citySelect.options[citySelect.selectedIndex] ? citySelect.options[citySelect.selectedIndex].text : citySlug;
    const term = (keywordInput.value || "").trim();
    const maxPages = state.g123Pages || 1;
    const onlyWa = $("#g123-opt-wa") ? $("#g123-opt-wa").checked : false;

    const submitBtn = $("#btn-submit-g123");
    state.isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "⚡ Extraindo Leads...";

    const jobId = `g123-${Date.now()}`;
    const cleanTermName = term ? term.charAt(0).toUpperCase() + term.slice(1) : "Geral";
    const jobName = `G123 · ${cleanTermName} (${cityName.split(" - ")[0]})`;

    const newJob = {
      id: jobId,
      name: jobName,
      date: new Date().toISOString(),
      status: "working",
      source: "g123",
      cityName: cityName,
      term: term,
      keywords: [term ? `${term} em ${cityName}` : `Catálogo Completo de ${cityName}`],
      depth: maxPages
    };

    // Salva no storage imediatamente para aparecer na fila
    const g123Jobs = loadG123Jobs();
    g123Jobs.unshift(newJob);
    saveG123Jobs(g123Jobs);

    state.jobs.unshift(newJob);
    state.activeJobId = jobId;
    renderJobsList();
    selectJob(jobId);
    showToast(`⚡ Iniciando extração no Guia Comercial para ${cityName}...`, 4000);

    try {
      const leads = await NinjaG123.scrape({
        citySlug: citySlug,
        term: term,
        maxPages: maxPages,
        onlyWhatsApp: onlyWa,
        onProgress: (prog) => {
          const statusEl = $("#g123-live-status");
          if (statusEl) {
            statusEl.textContent = `${prog.status} (${prog.leadsFound} contatos encontrados)`;
          }
        }
      });

      newJob.status = "ok";
      saveG123Leads(jobId, leads);
      saveG123Jobs(g123Jobs);

      const waCount = leads.filter(l => l.has_whatsapp || NinjaAutomations.getWhatsAppNumber(l.phone)).length;
      state.stats[jobId] = { total: leads.length, wa: waCount, email: 0, site: 0 };

      renderJobsList();
      selectJob(jobId);
      updateGlobalKPIs();
      showToast(`🎉 ${leads.length} leads extraídos com sucesso do Guia Comercial!`, 5000);
    } catch (err) {
      newJob.status = "failed";
      saveG123Jobs(g123Jobs);
      renderJobsList();
      showToast(`Erro na extração G123: ${err.message}`, 6000);
    } finally {
      state.isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "⚡ Extrair Leads do Guia G123";
    }
  }

  // ============================================================================
  // EVENT LISTENERS & INICIALIZAÇÃO
  // ============================================================================

  function bindEvents() {
    // Alternância de fonte (Google Maps vs Guia Comercial G123)
    $$(".source-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        $$(".source-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const src = tab.dataset.source;
        state.currentSource = src;
        if (src === "g123") {
          $("#search-form").style.display = "none";
          $("#search-form-g123").style.display = "block";
        } else {
          $("#search-form").style.display = "block";
          $("#search-form-g123").style.display = "none";
        }
      });
    });

    // Popula o select de cidades do G123
    const citySel = $("#g123-city-select");
    if (citySel && typeof NinjaG123 !== "undefined") {
      citySel.innerHTML = NinjaG123.getCities().map(c => 
        `<option value="${c.slug}" ${c.slug === "salto-do-lontra-pr" ? "selected" : ""}>${c.name}</option>`
      ).join("");
    }

    // Tags de nichos do G123
    $$(".tag-btn-g123").forEach(btn => {
      btn.addEventListener("click", () => {
        const inp = $("#g123-keyword-input");
        inp.value = btn.dataset.niche || "";
        inp.focus();
      });
    });

    // Seletor de páginas do G123
    $$(".depth-btn-g123").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".depth-btn-g123").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.g123Pages = parseInt(btn.dataset.pages) || 1;
      });
    });

    // Submissão dos Formulários
    $("#search-form").addEventListener("submit", handleCreateJob);
    $("#search-form-g123").addEventListener("submit", handleCreateG123Job);

    // Tags de nichos rápidos Google Maps
    $$(".tag-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = $("#keyword-input");
        const val = btn.dataset.niche;
        input.value = input.value ? `${input.value}, ${val}` : val;
        input.focus();
      });
    });

    // Seletor de profundidade Google Maps
    $$(".depth-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".depth-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.depth = parseInt(btn.dataset.depth) || 15;
      });
    });

    // Slider de raio Google Maps
    const radiusSlider = $("#radius-slider");
    const radiusVal = $("#radius-val");
    radiusSlider.addEventListener("input", () => {
      state.radius = parseInt(radiusSlider.value) || 15;
      radiusVal.textContent = `${state.radius} km`;
      if (state.geo) {
        NinjaMap.updatePreview("mini-map", state.geo.lat, state.geo.lon, state.radius);
      }
    });

    // Geocodificação automática ao digitar local (debounce)
    let geoTimer;
    $("#location-input").addEventListener("input", (e) => {
      clearTimeout(geoTimer);
      const val = e.target.value.trim();
      if (val.length < 3) return;
      geoTimer = setTimeout(async () => {
        const geo = await NinjaAPI.geocode(val);
        if (geo) {
          state.geo = geo;
          NinjaMap.updatePreview("mini-map", geo.lat, geo.lon, state.radius);
        }
      }, 700);
    });

    // Clique na lista de jobs (selecionar ou excluir)
    $("#jobs-list").addEventListener("click", async (e) => {
      const delBtn = e.target.closest("[data-action=delete]");
      const jobItem = e.target.closest(".job-item");
      if (!jobItem) return;

      const jobId = jobItem.dataset.id;
      if (delBtn) {
        if (confirm("Deseja realmente apagar esta busca do histórico?")) {
          if (String(jobId).startsWith("g123")) {
            const updatedG123 = loadG123Jobs().filter(j => j.id !== jobId);
            saveG123Jobs(updatedG123);
            localStorage.removeItem(`ninja_g123_leads_${jobId}`);
            delete state.stats[jobId];
            showToast("Busca do Guia G123 removida.");
            if (state.activeJobId === jobId) state.activeJobId = null;
            await refreshJobs();
            return;
          }
          await NinjaAPI.deleteJob(jobId);
          showToast("Busca removida.");
          if (state.activeJobId === jobId) state.activeJobId = null;
          await refreshJobs();
        }
        return;
      }

      selectJob(jobId);
    });

    // Filtros de leads
    ["#search-leads", "#filter-category", "#filter-only-wa", "#filter-only-email", "#filter-only-site", "#filter-dedupe"].forEach(s => {
      const el = $(s);
      if (el) el.addEventListener("input", applyFilters);
    });

    // Exportações
    $("#btn-export-excel").addEventListener("click", () => {
      if (state.filteredLeads.length === 0) return showToast("Nenhum lead para exportar.");
      const job = state.jobs.find(j => j.id === state.activeJobId);
      const name = getFormattedExportName(job);
      NinjaAutomations.exportExcel(name, state.filteredLeads);
      showToast(`${state.filteredLeads.length} leads baixados para Excel.`);
    });

    $("#btn-export-sheets").addEventListener("click", () => {
      if (state.filteredLeads.length === 0) return showToast("Nenhum lead para exportar.");
      const job = state.jobs.find(j => j.id === state.activeJobId);
      const name = getFormattedExportName(job);
      NinjaAutomations.exportGoogleSheets(name, state.filteredLeads);
      showToast(`${state.filteredLeads.length} leads prontos para Google Sheets.`);
    });

    $("#btn-copy-tsv").addEventListener("click", async () => {
      if (state.filteredLeads.length === 0) return showToast("Nenhum lead para copiar.");
      await NinjaAutomations.copyClipboardTSV(state.filteredLeads);
      showToast("Tabela copiada! Cole direto no Excel ou Sheets (Ctrl+V).");
    });

    // Disparo para Webhook do n8n
    $("#btn-trigger-n8n").addEventListener("click", async () => {
      if (state.filteredLeads.length === 0) return showToast("Selecione uma busca com leads para enviar ao n8n.");
      const job = state.jobs.find(j => j.id === state.activeJobId);
      const jobName = job ? job.name : "Coleta Ninja";
      
      const btn = $("#btn-trigger-n8n");
      const originalText = btn.textContent;
      btn.textContent = "Disparando...";
      btn.disabled = true;

      try {
        await NinjaAutomations.triggerN8nWebhook(state.filteredLeads, jobName);
        showToast(`⚡ ${state.filteredLeads.length} leads enviados com sucesso ao n8n!`, 6000);
      } catch (err) {
        showToast(`Erro no n8n: ${err.message}`, 6000);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    // Modal de Configurações
    $("#btn-open-settings").addEventListener("click", () => {
      const settings = NinjaAutomations.getSettings();
      $("#cfg-n8n-url").value = settings.n8nWebhookUrl || "";
      $("#cfg-evolution-url").value = settings.evolutionApiUrl || "";
      $("#cfg-evolution-inst").value = settings.evolutionInstance || "";
      $("#cfg-evolution-key").value = settings.evolutionApiKey || "";
      $("#cfg-wa-msg").value = settings.waTemplate || "";
      $("#modal-settings").classList.add("open");
    });

    $("#btn-close-settings").addEventListener("click", () => {
      $("#modal-settings").classList.remove("open");
    });

    $("#settings-form").addEventListener("submit", (e) => {
      e.preventDefault();
      NinjaAutomations.saveSettings({
        n8nWebhookUrl: $("#cfg-n8n-url").value.trim(),
        evolutionApiUrl: $("#cfg-evolution-url").value.trim(),
        evolutionInstance: $("#cfg-evolution-inst").value.trim(),
        evolutionApiKey: $("#cfg-evolution-key").value.trim(),
        waTemplate: $("#cfg-wa-msg").value.trim()
      });
      $("#modal-settings").classList.remove("open");
      showToast("Configurações salvas com sucesso!");
    });
  }

  // Inicialização geral
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    refreshJobs();
    // Polling a cada 4 segundos para atualizar progresso das buscas
    state.pollTimer = setInterval(refreshJobs, 4000);
  });
})();
