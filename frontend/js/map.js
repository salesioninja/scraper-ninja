/**
 * Agência Ninja — Módulo de Mapas Interativos com Leaflet
 * Suporte a visualização Dark Matter, raio dinâmico e marcadores neon
 */

const NinjaMap = (() => {
  "use strict";

  const hasLeaflet = typeof L !== "undefined";

  const TILES_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  const getTileLayer = () => {
    return L.tileLayer(TILES_URL, {
      maxZoom: 19,
      className: 'ninja-map-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  };

  const createPinIcon = (color = "#00f5d4", isHighlight = false) => {
    const scale = isHighlight ? 1.25 : 1.0;
    const svg = `
      <svg width="${28 * scale}" height="${40 * scale}" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 40 14 40C14 40 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}" fill-opacity="0.9"/>
        <circle cx="14" cy="14" r="5.5" fill="#05070a"/>
        <circle cx="14" cy="14" r="3" fill="#ffffff"/>
      </svg>
    `;
    return L.divIcon({
      className: "ninja-map-pin" + (isHighlight ? " hl-pin" : ""),
      html: svg,
      iconSize: [28 * scale, 40 * scale],
      iconAnchor: [14 * scale, 40 * scale],
      popupAnchor: [0, -36 * scale]
    });
  };

  let previewMap = null;
  let previewMarker = null;
  let previewCircle = null;

  return {
    isAvailable: hasLeaflet,

    /**
     * Inicializa ou atualiza o mini-mapa no formulário de busca
     */
    updatePreview(containerId, lat, lon, radiusKm) {
      if (!hasLeaflet) return;
      const el = document.getElementById(containerId);
      if (!el) return;

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      if (isNaN(latitude) || isNaN(longitude)) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";

      if (!previewMap) {
        previewMap = L.map(containerId, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false
        });
        getTileLayer().addTo(previewMap);
      }

      previewMap.invalidateSize();
      previewMap.setView([latitude, longitude], 13);

      if (previewMarker) previewMarker.remove();
      if (previewCircle) previewCircle.remove();

      previewMarker = L.marker([latitude, longitude], {
        icon: createPinIcon("#00f5d4")
      }).addTo(previewMap);

      const radiusMeters = (radiusKm || 5) * 1000;
      previewCircle = L.circle([latitude, longitude], {
        radius: radiusMeters,
        color: "#00f5d4",
        weight: 1.5,
        opacity: 0.8,
        fillColor: "#00f5d4",
        fillOpacity: 0.12
      }).addTo(previewMap);

      previewMap.fitBounds(previewCircle.getBounds(), { padding: [15, 15] });
    }
  };
})();
