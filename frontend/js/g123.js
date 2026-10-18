/**
 * Agência Ninja — Módulo de Extração de Contatos Guia Comercial G123
 * Extrai listas completas de empresas, telefones e links de WhatsApp de cidades do PR/SC
 */

const NinjaG123 = (() => {
  "use strict";

  const PROXY_BASE = "/g123-proxy";

  // Catálogo completo de cidades organizadas por UF
  const CITIES = [
    { slug: "todas-as-cidades", name: "Todas as Cidades (Busca Geral)" },
    { slug: "salto-do-lontra-pr", name: "Salto do Lontra - PR" },
    { slug: "francisco-beltrao-pr", name: "Francisco Beltrão - PR" },
    { slug: "pato-branco-pr", name: "Pato Branco - PR" },
    { slug: "dois-vizinhos-pr", name: "Dois Vizinhos - PR" },
    { slug: "cascavel-pr", name: "Cascavel - PR" },
    { slug: "chapeco-sc", name: "Chapecó - SC" },
    { slug: "ampere-pr", name: "Ampére - PR" },
    { slug: "capanema-pr", name: "Capanema - PR" },
    { slug: "chopinzinho-pr", name: "Chopinzinho - PR" },
    { slug: "coronel-vivida-pr", name: "Coronel Vivida - PR" },
    { slug: "marmeleiro-pr", name: "Marmeleiro - PR" },
    { slug: "realeza-pr", name: "Realeza - PR" },
    { slug: "palmas-pr", name: "Palmas - PR" },
    { slug: "clevelandia-pr", name: "Clevelândia - PR" },
    { slug: "santo-antonio-do-sudoeste-pr", name: "Santo Antônio do Sudoeste - PR" },
    { slug: "sao-joao-pr", name: "São João - PR" },
    { slug: "sao-jorge-do-oeste-pr", name: "São Jorge d'Oeste - PR" },
    { slug: "planalto-pr", name: "Planalto - PR" },
    { slug: "santa-izabel-do-oeste-pr", name: "Santa Izabel do Oeste - PR" },
    { slug: "nova-esperanca-do-sudoeste-pr", name: "Nova Esperança do Sudoeste - PR" },
    { slug: "cruzeiro-do-iguacu-pr", name: "Cruzeiro do Iguaçu - PR" },
    { slug: "boa-esperanca-do-iguacu-pr", name: "Boa Esperança do Iguaçu - PR" },
    { slug: "bela-vista-da-caroba-pr", name: "Bela Vista da Caroba - PR" },
    { slug: "bom-jesus-do-sul-pr", name: "Bom Jesus do Sul - PR" },
    { slug: "bom-sucesso-do-sul-pr", name: "Bom Sucesso do Sul - PR" },
    { slug: "barracao-pr", name: "Barracão - PR" },
    { slug: "enemas-pr", name: "Enéas Marques - PR" },
    { slug: "vermo-pr", name: "Verê - PR" },
    { slug: "renascenca-pr", name: "Renascença - PR" },
    { slug: "salgado-filho-pr", name: "Salgado Filho - PR" },
    { slug: "flor-da-serra-do-sul-pr", name: "Flor da Serra do Sul - PR" },
    { slug: "honorio-serpa-pr", name: "Honório Serpa - PR" },
    { slug: "iturama-pr", name: "Iturama - PR" },
    { slug: "mangueirinha-pr", name: "Mangueirinha - PR" },
    { slug: "marilena-pr", name: "Marilena - PR" },
    { slug: "perola-d-oeste-pr", name: "Pérola d'Oeste - PR" },
    { slug: "pinhal-de-sao-bento-pr", name: "Pinhal de São Bento - PR" },
    { slug: "pranchita-pr", name: "Pranchita - PR" },
    { slug: "rio-bonito-do-iguacu-pr", name: "Rio Bonito do Iguaçu - PR" },
    { slug: "sao-pedro-do-iguacu-pr", name: "São Pedro do Iguaçu - PR" },
    { slug: "sulina-pr", name: "Sulina - PR" },
    { slug: "vitorino-pr", name: "Vitorino - PR" },
    { slug: "abelardo-luz-sc", name: "Abelardo Luz - SC" },
    { slug: "anchieta-sc", name: "Anchieta - SC" },
    { slug: "campo-ere-sc", name: "Campo Erê - SC" },
    { slug: "dionisio-cerqueira-sc", name: "Dionísio Cerqueira - SC" },
    { slug: "descanso-sc", name: "Descanso - SC" },
    { slug: "guaraciaba-sc", name: "Guaraciaba - SC" },
    { slug: "itapiranga-sc", name: "Itapiranga - SC" },
    { slug: "maravilha-sc", name: "Maravilha - SC" },
    { slug: "palma-sola-sc", name: "Palma Sola - SC" },
    { slug: "pinhalzinho-sc", name: "Pinhalzinho - SC" },
    { slug: "romelandia-sc", name: "Romelândia - SC" },
    { slug: "sao-jose-do-cedro-sc", name: "São José do Cedro - SC" },
    { slug: "sao-lourenco-do-oeste-sc", name: "São Lourenço do Oeste - SC" },
    { slug: "sao-miguel-do-oeste-sc", name: "São Miguel do Oeste - SC" },
    { slug: "xanxere-sc", name: "Xanxerê - SC" },
    { slug: "xaxim-sc", name: "Xaxim - SC" },
    { slug: "concordia-sc", name: "Concórdia - SC" },
    { slug: "joacaba-sc", name: "Joaçaba - SC" }
  ];

  /**
   * Remove acentos para slugs amigáveis
   */
  function cleanSlug(text) {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Baixa uma página do G123 via proxy e decodifica em ISO-8859-1
   */
  async function fetchPage(urlPath) {
    const fullUrl = `${PROXY_BASE}/${urlPath.replace(/^\/+/, "")}`;
    const res = await fetch(fullUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      throw new Error(`Erro ao acessar Guia G123 (${res.status})`);
    }

    const buffer = await res.arrayBuffer();
    // Decodifica usando ISO-8859-1 para preservar acentuação brasileira
    const decoder = new TextDecoder("iso-8859-1");
    return decoder.decode(buffer);
  }

  /**
   * Analisa o HTML e extrai contatos formatados
   */
  function parseHtml(html, defaultCity) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const leads = [];
    const seen = new Set();

    const contatoLinks = doc.querySelectorAll('a[href*="/contato/"]');
    contatoLinks.forEach(a => {
      const href = a.getAttribute("href") || "";
      const match = href.match(/\/contato\/(\d{10,12})-([a-z0-9\-]+)/i);
      if (!match) return;

      const rawPhone = match[1];
      if (seen.has(rawPhone)) return;
      seen.add(rawPhone);

      // Formatação de Telefone
      let formattedPhone = rawPhone;
      let isMobile = false;

      if (rawPhone.length === 11) {
        const ddd = rawPhone.slice(0, 2);
        const p1 = rawPhone.slice(2, 7);
        const p2 = rawPhone.slice(7);
        formattedPhone = `(${ddd}) ${p1}-${p2}`;
        isMobile = ["8", "9"].includes(rawPhone[2]);
      } else if (rawPhone.length === 10) {
        const ddd = rawPhone.slice(0, 2);
        const p1 = rawPhone.slice(2, 6);
        const p2 = rawPhone.slice(6);
        formattedPhone = `(${ddd}) ${p1}-${p2}`;
        isMobile = false;
      }

      // Container pai do item
      let card = a;
      for (let i = 0; i < 5; i++) {
        if (card.parentElement) {
          card = card.parentElement;
          if (card.classList.contains("resultadocliente") ||
              card.classList.contains("resultadopar") ||
              card.classList.contains("resultadonormal") ||
              card.classList.contains("row")) {
            break;
          }
        }
      }

      // Nome da empresa
      const nameElem = card.querySelector(".nomecliente, .nomepar, .nomenormal, h1, h2");
      let name = nameElem ? nameElem.textContent.trim() : "";
      if (!name) {
        name = a.getAttribute("title") || a.getAttribute("alt") || "";
      }
      if (!name) {
        name = match[2].split("-").slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }

      // Endereço
      const addrElem = card.querySelector(".endereco");
      const address = addrElem ? addrElem.textContent.trim() : "";

      // Cidade
      const cityElem = card.querySelector(".cidade, .cidadebase");
      const city = cityElem ? cityElem.textContent.trim() : (defaultCity || "");

      // Categoria
      const catElem = card.querySelector(".vejaoutros, [title*='Ramo']");
      const category = catElem ? catElem.textContent.trim() : "";

      leads.push({
        title: name,
        name: name,
        phone: formattedPhone,
        raw_phone: rawPhone,
        has_whatsapp: isMobile,
        is_mobile: isMobile,
        whatsapp_url: isMobile ? `https://wa.me/55${rawPhone}` : null,
        address: address,
        city: city,
        category: category,
        source: "Guia G123",
        rating: null,
        reviews: null,
        website: null,
        emails: [],
        url: href.startsWith("http") ? href : `https://g123.com.br/${href.replace(/^\/+/, "")}`
      });
    });

    // Verifica se há próxima página
    const hasNext = doc.querySelectorAll('.pagination a, [href*="pagina-"]').length > 0;

    return { leads, hasNext };
  }

  return {
    getCities() {
      return CITIES;
    },

    /**
     * Executa a extração em múltiplas páginas
     */
    async scrape({ citySlug, term, maxPages = 1, onlyWhatsApp = false, onProgress }) {
      const city = CITIES.find(c => c.slug === citySlug) || { slug: citySlug, name: citySlug };
      const allLeads = [];
      const seenPhones = new Set();
      const cleanTerm = (term || "").trim();

      for (let page = 1; page <= maxPages; page++) {
        let path = "";
        if (cleanTerm) {
          const tSlug = cleanSlug(cleanTerm);
          path = page === 1 ? `pesquisa/${city.slug}/${tSlug}/` : `pesquisa/${city.slug}/${tSlug}/pagina-${page}`;
        } else {
          path = page === 1 ? `listas/${city.slug}` : `listas/${city.slug}/pagina-${page}`;
        }

        try {
          if (onProgress) {
            onProgress({
              page,
              maxPages,
              leadsFound: allLeads.length,
              status: `Baixando página ${page} de ${city.name}...`
            });
          }

          const html = await fetchPage(path);
          const { leads } = parseHtml(html, city.name);

          if (!leads || leads.length === 0) {
            break; // Sem mais páginas
          }

          leads.forEach(l => {
            if (!seenPhones.has(l.raw_phone)) {
              if (onlyWhatsApp && !l.has_whatsapp) {
                return;
              }
              seenPhones.add(l.raw_phone);
              allLeads.push(l);
            }
          });

          // Breve pausa para não sobrecarregar
          if (page < maxPages) {
            await new Promise(r => setTimeout(r, 250));
          }
        } catch (err) {
          console.warn(`[NinjaG123] Erro na página ${page}:`, err);
          break;
        }
      }

      return allLeads;
    }
  };
})();
