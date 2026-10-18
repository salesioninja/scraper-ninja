/**
 * Agência Ninja — Extrator Universal de Contatos & Listas Web
 * Varredura inteligente de qualquer URL, diretório ou lista telefônica com identificação automática de WhatsApp
 */

const NinjaWebScraper = (() => {
  "use strict";

  const G123_PROXY = "/g123-proxy";
  const WEB_PROXY = "/web-proxy/?url=";

  /**
   * Remove acentos para comparações e slugs
   */
  function removeAccents(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  /**
   * Formata número brasileiro com DDD
   */
  function formatBrazilianPhone(rawDigits) {
    if (!rawDigits) return { formatted: "", raw: "", isMobile: false };
    let digits = String(rawDigits).replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) {
      digits = digits.slice(2);
    }

    if (digits.length === 11) {
      const ddd = digits.slice(0, 2);
      const p1 = digits.slice(2, 7);
      const p2 = digits.slice(7);
      return {
        formatted: `(${ddd}) ${p1}-${p2}`,
        raw: digits,
        isMobile: ["8", "9"].includes(digits[2])
      };
    } else if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const p1 = digits.slice(2, 6);
      const p2 = digits.slice(6);
      return {
        formatted: `(${ddd}) ${p1}-${p2}`,
        raw: digits,
        isMobile: false
      };
    }
    return { formatted: digits, raw: digits, isMobile: false };
  }

  /**
   * Baixa uma URL via proxy
   */
  async function fetchUrlContent(targetUrl) {
    let proxyUrl = "";
    const isG123 = targetUrl.includes("g123.com.br");

    if (isG123) {
      const path = targetUrl.replace(/^https?:\/\/(www\.)?g123\.com\.br\/?/, "");
      proxyUrl = `${G123_PROXY}/${path.replace(/^\/+/, "")}`;
    } else {
      proxyUrl = `${WEB_PROXY}${encodeURIComponent(targetUrl)}`;
    }

    const res = await fetch(proxyUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      throw new Error(`O servidor retornou status ${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    // G123 usa ISO-8859-1; outros sites usam UTF-8 por padrão
    try {
      if (isG123) {
        return new TextDecoder("iso-8859-1").decode(buffer);
      }
      return new TextDecoder("utf-8").decode(buffer);
    } catch {
      return new TextDecoder("iso-8859-1").decode(buffer);
    }
  }

  /**
   * Parser Especializado para diretórios estruturados (estilo G123)
   */
  function parseStructuredDirectory(doc, baseUrl, keywordFilter) {
    const leads = [];
    const seen = new Set();
    const cleanKw = removeAccents(keywordFilter);

    const contatoLinks = doc.querySelectorAll('a[href*="/contato/"]');
    contatoLinks.forEach(a => {
      const href = a.getAttribute("href") || "";
      const match = href.match(/\/contato\/(\d{10,12})-([a-z0-9\-]+)/i);
      if (!match) return;

      const phoneInfo = formatBrazilianPhone(match[1]);
      if (seen.has(phoneInfo.raw)) return;

      // Container do anúncio
      let card = a;
      for (let i = 0; i < 5; i++) {
        if (card.parentElement) {
          card = card.parentElement;
          if (card.classList.contains("resultadocliente") ||
              card.classList.contains("resultadopar") ||
              card.classList.contains("resultadonormal") ||
              card.classList.contains("row") ||
              card.classList.contains("card")) {
            break;
          }
        }
      }

      // Nome da empresa
      const nameElem = card.querySelector(".nomecliente, .nomepar, .nomenormal, h1, h2, h3, strong");
      let name = nameElem ? nameElem.textContent.trim() : "";
      if (!name) name = a.getAttribute("title") || a.getAttribute("alt") || "";
      if (!name) {
        name = match[2].split("-").slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }

      // Endereço
      const addrElem = card.querySelector(".endereco");
      const address = addrElem ? addrElem.textContent.trim() : "";

      // Cidade
      const cityElem = card.querySelector(".cidade, .cidadebase");
      const city = cityElem ? cityElem.textContent.trim() : "";

      // Categoria
      const catElem = card.querySelector(".vejaoutros, [title*='Ramo']");
      const category = catElem ? catElem.textContent.trim() : "";

      // Filtro de palavra-chave
      if (cleanKw) {
        const fullText = removeAccents(`${name} ${category} ${address}`);
        if (!fullText.includes(cleanKw)) {
          return;
        }
      }

      seen.add(phoneInfo.raw);
      leads.push({
        title: name,
        name: name,
        phone: phoneInfo.formatted,
        raw_phone: phoneInfo.raw,
        has_whatsapp: phoneInfo.isMobile,
        is_mobile: phoneInfo.isMobile,
        whatsapp_url: phoneInfo.isMobile ? `https://wa.me/55${phoneInfo.raw}` : null,
        address: address,
        city: city,
        category: category || (keywordFilter ? keywordFilter.toUpperCase() : "Empresa Local"),
        source: "Extrator Web",
        url: href.startsWith("http") ? href : new URL(href, baseUrl).href
      });
    });

    return leads;
  }

  /**
   * Parser Universal para qualquer site genérico (Varredura inteligente de DOM)
   */
  function parseGenericWebPage(doc, baseUrl, keywordFilter) {
    const leads = [];
    const seen = new Set();
    const cleanKw = removeAccents(keywordFilter);

    // 1. Procura por links diretos de WhatsApp (wa.me, api.whatsapp.com)
    const waLinks = doc.querySelectorAll('a[href*="wa.me/"], a[href*="whatsapp.com/send"]');
    waLinks.forEach(a => {
      const href = a.getAttribute("href") || "";
      const match = href.match(/(?:phone=|\/)(55)?([1-9]{2}9\d{8})/);
      if (match) {
        const rawPhone = match[2];
        if (seen.has(rawPhone)) return;

        const phoneInfo = formatBrazilianPhone(rawPhone);
        let card = a.closest(".card, .item, .box, article, tr, li, div") || a.parentElement;
        let title = card ? (card.querySelector("h1, h2, h3, h4, strong, .title, .nome")?.textContent.trim() || "") : "";
        if (!title) title = a.textContent.trim() || "Contato WhatsApp";

        if (cleanKw) {
          const cardText = removeAccents((card ? card.textContent : "") + " " + title);
          if (!cardText.includes(cleanKw)) return;
        }

        seen.add(rawPhone);
        leads.push({
          title: title,
          name: title,
          phone: phoneInfo.formatted,
          raw_phone: rawPhone,
          has_whatsapp: true,
          is_mobile: true,
          whatsapp_url: `https://wa.me/55${rawPhone}`,
          address: card ? (card.querySelector(".address, .endereco, address")?.textContent.trim() || "") : "",
          city: "",
          category: keywordFilter || "Contato Web",
          source: "Extrator Web",
          url: baseUrl
        });
      }
    });

    // 2. Procura por links tel:
    const telLinks = doc.querySelectorAll('a[href^="tel:"]');
    telLinks.forEach(a => {
      const tel = a.getAttribute("href").replace("tel:", "").trim();
      const phoneInfo = formatBrazilianPhone(tel);
      if (phoneInfo.raw.length >= 10 && !seen.has(phoneInfo.raw)) {
        let card = a.closest(".card, .item, .box, article, tr, li, div") || a.parentElement;
        let title = card ? (card.querySelector("h1, h2, h3, h4, strong, .title, .nome")?.textContent.trim() || "") : "";
        if (!title) title = a.textContent.trim() || "Empresa Local";

        if (cleanKw) {
          const cardText = removeAccents((card ? card.textContent : "") + " " + title);
          if (!cardText.includes(cleanKw)) return;
        }

        seen.add(phoneInfo.raw);
        leads.push({
          title: title,
          name: title,
          phone: phoneInfo.formatted,
          raw_phone: phoneInfo.raw,
          has_whatsapp: phoneInfo.isMobile,
          is_mobile: phoneInfo.isMobile,
          whatsapp_url: phoneInfo.isMobile ? `https://wa.me/55${phoneInfo.raw}` : null,
          address: card ? (card.querySelector(".address, .endereco, address")?.textContent.trim() || "") : "",
          city: "",
          category: keywordFilter || "Empresa Local",
          source: "Extrator Web",
          url: baseUrl
        });
      }
    });

    // 3. Varredura por Regex no texto dos containers
    const phoneRegex = /(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(?:(9\s*\d{4}|\d{4}))[-.\s]?(\d{4})\b/g;
    const containers = doc.querySelectorAll(".card, .item, .empresa, .cliente, tr, li, article, .listing");
    
    containers.forEach(box => {
      const text = box.textContent || "";
      if (cleanKw && !removeAccents(text).includes(cleanKw)) return;

      let match;
      while ((match = phoneRegex.exec(text)) !== null) {
        const fullMatch = match[0].replace(/\D/g, "");
        if (fullMatch.length === 10 || fullMatch.length === 11) {
          if (!seen.has(fullMatch)) {
            seen.add(fullMatch);
            const phoneInfo = formatBrazilianPhone(fullMatch);
            const titleElem = box.querySelector("h1, h2, h3, h4, strong, .title, .nome, a");
            const title = titleElem ? titleElem.textContent.trim() : "Empresa / Contato";
            const addrElem = box.querySelector(".endereco, .address, address");
            const address = addrElem ? addrElem.textContent.trim() : "";

            // E-mail se houver no bloco
            const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

            leads.push({
              title: title,
              name: title,
              phone: phoneInfo.formatted,
              raw_phone: phoneInfo.raw,
              has_whatsapp: phoneInfo.isMobile,
              is_mobile: phoneInfo.isMobile,
              whatsapp_url: phoneInfo.isMobile ? `https://wa.me/55${phoneInfo.raw}` : null,
              address: address,
              city: "",
              category: keywordFilter || "Empresa Local",
              emails: emailMatch ? [emailMatch[0]] : [],
              source: "Extrator Web",
              url: baseUrl
            });
          }
        }
      }
    });

    return leads;
  }

  /**
   * Constrói URL para próxima página
   */
  function getNextPageUrl(currentUrl, pageNum) {
    // Caso especial para estruturas conhecidas com /pagina-X
    if (currentUrl.includes("/listas/") || currentUrl.includes("/pesquisa/")) {
      const base = currentUrl.replace(/\/pagina-\d+.*$/, "").replace(/\/+$/, "");
      return `${base}/pagina-${pageNum}`;
    }

    try {
      const u = new URL(currentUrl);
      if (u.searchParams.has("page")) {
        u.searchParams.set("page", pageNum);
        return u.href;
      }
      if (u.searchParams.has("p")) {
        u.searchParams.set("p", pageNum);
        return u.href;
      }
      if (u.searchParams.has("pagina")) {
        u.searchParams.set("pagina", pageNum);
        return u.href;
      }
      // Se não tem query param, adiciona page=
      u.searchParams.set("page", pageNum);
      return u.href;
    } catch {
      return currentUrl;
    }
  }

  return {
    /**
     * Extrai contatos de qualquer URL informada
     */
    async scrape({ url, keyword = "", maxPages = 1, onlyWhatsApp = false, onProgress }) {
      if (!url) throw new Error("Informe um link ou URL válido.");
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = `https://${cleanUrl}`;
      }

      // Se for diretório conhecido e o usuário colocou palavra-chave na busca
      const cleanKw = keyword.trim();
      if (cleanUrl.includes("g123.com.br") && cleanKw) {
        const cityMatch = cleanUrl.match(/\/listas\/([a-z0-9\-]+)/);
        if (cityMatch) {
          const citySlug = cityMatch[1];
          const kwSlug = removeAccents(cleanKw).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          cleanUrl = `https://g123.com.br/pesquisa/${citySlug}/${kwSlug}/`;
        }
      }

      const allLeads = [];
      const seenPhones = new Set();

      for (let page = 1; page <= maxPages; page++) {
        const pageUrl = page === 1 ? cleanUrl : getNextPageUrl(cleanUrl, page);

        try {
          if (onProgress) {
            onProgress({
              page,
              maxPages,
              leadsFound: allLeads.length,
              status: `Acessando página ${page}...`
            });
          }

          const html = await fetchUrlContent(pageUrl);
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          let pageLeads = [];
          if (cleanUrl.includes("g123.com.br")) {
            pageLeads = parseStructuredDirectory(doc, pageUrl, cleanKw);
          } else {
            pageLeads = parseGenericWebPage(doc, pageUrl, cleanKw);
          }

          if (!pageLeads || pageLeads.length === 0) {
            break; // Fim dos resultados
          }

          pageLeads.forEach(lead => {
            if (!seenPhones.has(lead.raw_phone)) {
              if (onlyWhatsApp && !lead.has_whatsapp) {
                return;
              }
              seenPhones.add(lead.raw_phone);
              allLeads.push(lead);
            }
          });

          if (page < maxPages) {
            await new Promise(r => setTimeout(r, 250));
          }
        } catch (err) {
          console.warn(`[NinjaWebScraper] Erro na página ${page}:`, err);
          break;
        }
      }

      return allLeads;
    }
  };
})();
