/**
 * Agência Ninja — Scraper API Client
 * Comunicação com a API Go do Google Maps Scraper e Geocodificação OSM Nominatim
 */

const NinjaAPI = (() => {
  "use strict";

  const BASE_API = "/api/v1/jobs";
  const GEO_CACHE_KEY = "ninja_geo_cache_v1";

  // Cache local de coordenadas para economizar requisições
  const loadGeoCache = () => {
    try {
      return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const saveGeoCache = (cache) => {
    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  };

  return {
    /**
     * Verifica saúde da conexão com o motor Scraper
     */
    async checkHealth() {
      try {
        const res = await fetch(BASE_API, { cache: "no-store", method: "GET" });
        return res.ok;
      } catch {
        return false;
      }
    },

    /**
     * Lista todas as buscas do histórico
     */
    async getJobs() {
      const res = await fetch(BASE_API, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erro ao listar buscas (${res.status})`);
      const data = await res.json();
      return (data || []).map(j => {
        const d = j.Data || j.data || {};
        return {
          id: j.ID || j.id,
          name: j.Name || j.name,
          date: j.Date || j.date,
          status: (j.Status || j.status || "").toLowerCase(),
          keywords: d.keywords || [],
          depth: d.depth || 5,
          email: !!d.email,
          lang: d.lang || "pt",
          lat: parseFloat(d.lat) || 0,
          lon: parseFloat(d.lon) || 0,
          radius: parseInt(d.radius) || 0
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    /**
     * Cria uma nova tarefa de extração
     */
    async createJob(payload) {
      const res = await fetch(BASE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = `O motor recusou a busca (${res.status})`;
        try {
          const errData = await res.json();
          if (errData.message) msg += `: ${errData.message}`;
        } catch {}
        throw new Error(msg);
      }
      return await res.json();
    },

    /**
     * Obtém detalhes de uma busca específica
     */
    async getJob(jobId) {
      const res = await fetch(`${BASE_API}/${jobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erro ao obter job (${res.status})`);
      return await res.json();
    },

    /**
     * Cancela e/ou apaga uma busca
     */
    async deleteJob(jobId) {
      const res = await fetch(`${BASE_API}/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Falha ao excluir busca (${res.status})`);
      return true;
    },

    /**
     * Baixa os dados em CSV bruto de uma busca
     */
    async downloadJobCSV(jobId) {
      const res = await fetch(`${BASE_API}/${jobId}/download`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Falha ao baixar CSV (${res.status})`);
      return await res.text();
    },

    /**
     * Geocodificação OpenStreetMap Nominatim com cache local e prioridade para Brasil
     */
    async geocode(placeText) {
      const text = placeText.trim();
      if (!text) return null;
      
      const cache = loadGeoCache();
      const slug = text.toLowerCase();
      if (cache[slug]) return cache[slug];

      // Busca com preferência de idioma português
      const params = new URLSearchParams({
        format: "json",
        limit: "1",
        addressdetails: "1",
        "accept-language": "pt-BR",
        q: text
      });

      try {
        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const res = await fetch(url, { headers: { "User-Agent": "AgenciaNinja-LeadScraper/2.0" } });
        if (!res.ok) return null;
        const results = await res.json();
        if (results && results.length > 0) {
          const match = {
            lat: results[0].lat,
            lon: results[0].lon,
            displayName: results[0].display_name
          };
          cache[slug] = match;
          saveGeoCache(cache);
          return match;
        }
      } catch (e) {
        console.warn("Geocodificação falhou:", e);
      }
      return null;
    }
  };
})();
