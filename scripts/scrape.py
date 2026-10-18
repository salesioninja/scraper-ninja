#!/usr/bin/env python3
"""
Agência Ninja — Google Maps Lead Scraper CLI
Extração automatizada de leads com enriquecimento de dados e integração n8n / Evolution API.

Exemplos de Uso:
    # Busca com coordenadas:
    python scrape.py "dentistas em Curitiba PR" -25.4284 -49.2733 --depth 5

    # Busca com geocodificação automática:
    python scrape.py "imobiliarias em Florianopolis" --city "Florianopolis, SC" --depth 5 --email

    # Com disparo automático para o n8n:
    python scrape.py "clinicas estetica em Sao Paulo" --city "Sao Paulo, SP" --depth 5 --webhook "https://n8n.agencianinja.com.br/webhook/leads"
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = os.environ.get("SCRAPER_BASE_URL", "http://localhost:8080")
KEY = os.environ.get("SCRAPER_API_KEY", "")
UA = "AgenciaNinja-LeadScraper/2.0 (+https://agencianinja.com.br)"

LEAD_FIELDS = [
    "title", "phone", "emails", "website", "category", "address", 
    "review_rating", "review_count", "instagram", "facebook", "linkedin", "link"
]

SOCIAL_RE = {
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)", re.I),
    "facebook":  re.compile(r"https?://(?:www\.|m\.|web\.)?facebook\.com/([A-Za-z0-9_.\-]+)", re.I),
    "linkedin":  re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|in|school)/([A-Za-z0-9_.\-%]+)", re.I),
}

_SKIP_HANDLE = {
    "", "home", "pages", "people", "help", "about", "policies", "policy",
    "legal", "tos", "privacy", "settings", "sharer", "tr", "profile.php",
    "plugins", "dialog", "intent", "login", "share.php", "permalink.php",
    "p", "reel", "reels", "explore", "stories", "tv", "watch", "events",
    "groups", "marketplace", "gaming", "photo", "hashtag", "search"
}

def req(method, path, body=None):
    headers = {"Content-Type": "application/json", "User-Agent": UA}
    if KEY:
        headers["X-API-Key"] = KEY
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        return resp.status, resp.read()

def geocode(place):
    """Converte nome de cidade/bairro em coordenadas lat/lon via OpenStreetMap Nominatim."""
    q = urllib.parse.urlencode({"format": "json", "limit": 1, "q": place, "accept-language": "pt-BR"})
    url = f"https://nominatim.openstreetmap.org/search?{q}"
    r = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            hits = json.loads(resp.read())
        time.sleep(1)
        if hits:
            return str(hits[0]["lat"]), str(hits[0]["lon"])
    except Exception as e:
        print(f"  [!] Aviso: falha ao geocodificar local ({e})", file=sys.stderr)
    return None

def fetch_html(url, timeout=8):
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    try:
        r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.read(300_000).decode("utf-8", "replace")
    except Exception:
        return ""

def find_socials(html):
    res = {"instagram": "", "facebook": "", "linkedin": ""}
    for plat, rx in SOCIAL_RE.items():
        for m in rx.finditer(html or ""):
            h = m.group(1).split("?")[0].rstrip("/")
            if h.lower() not in _SKIP_HANDLE:
                res[plat] = m.group(0).split("?")[0].rstrip("/")
                break
    return res

def enrich_socials(leads, max_workers=8):
    print(f"[*] Buscando redes sociais para {len(leads)} leads...")
    sites = [r.get("website", "") for r in leads]
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        htmls = list(ex.map(fetch_html, sites))
    for r, html in zip(leads, htmls):
        soc = find_socials(html)
        r.update(soc)

def format_whatsapp(phone):
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    if len(digits) == 11 and digits[2] == "9":
        return f"https://wa.me/55{digits}"
    return ""

def push_to_n8n(webhook_url, job_name, leads):
    print(f"[*] Enviando {len(leads)} leads para webhook do n8n: {webhook_url}")
    payload = {
        "source": "AgenciaNinja-Scraper",
        "job_name": job_name,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_leads": len(leads),
        "leads": leads
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(webhook_url, data=data, headers={"Content-Type": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[✓] Leads enviados com sucesso ao n8n! (Status {resp.status})")
    except Exception as e:
        print(f"[!] Erro ao enviar leads para o n8n: {e}", file=sys.stderr)

def main():
    p = argparse.ArgumentParser(description="Agência Ninja — Google Maps Lead Scraper")
    p.add_argument("keyword", nargs="?", help="Termo de busca (ex: 'dentistas em Curitiba')")
    p.add_argument("lat", nargs="?", help="Latitude")
    p.add_argument("lon", nargs="?", help="Longitude")
    p.add_argument("--city", help="Nome da cidade para geocodificação automática")
    p.add_argument("--depth", type=int, default=5, help="Profundidade da busca (padrão 5)")
    p.add_argument("--email", action="store_true", help="Ativar varredura de e-mails nos sites")
    p.add_argument("--socials", action="store_true", help="Buscar Instagram, Facebook e LinkedIn")
    p.add_argument("--out", help="Nome do arquivo CSV de saída")
    p.add_argument("--webhook", help="URL do Webhook do n8n para envio direto")
    args = p.parse_args()

    if not args.keyword:
        p.print_help()
        sys.exit(1)

    lat, lon = args.lat, args.lon
    if not (lat and lon):
        place = args.city or args.keyword.split(" em ")[-1]
        print(f"[*] Geocodificando local: {place}")
        geo = geocode(place)
        if geo:
            lat, lon = geo
        else:
            lat, lon = "0", "0"

    job_name = f"Ninja · {args.keyword}"
    body = {
        "name": job_name,
        "keywords": [args.keyword],
        "lat": str(lat),
        "lon": str(lon),
        "depth": args.depth,
        "email": args.email,
        "lang": "pt-BR",
        "zoom": 14,
        "fast_mode": False,
        "max_time": 600
    }

    print(f"[*] Iniciando coleta: '{args.keyword}' (profundidade: {args.depth})...")
    status, res = req("POST", "/api/v1/jobs", body)
    job_info = json.loads(res.decode())
    job_id = job_info.get("ID") or job_info.get("id")
    print(f"[✓] Job criado com ID: {job_id}. Aguardando processamento...")

    while True:
        time.sleep(3)
        _, jres = req("GET", f"/api/v1/jobs/{job_id}")
        jdata = json.loads(jres.decode())
        st = (jdata.get("Status") or jdata.get("status", "")).lower()
        if st == "ok":
            print("[✓] Coleta finalizada com sucesso!")
            break
        elif st == "failed":
            print("[!] Falha durante a coleta.", file=sys.stderr)
            sys.exit(1)
        else:
            sys.stdout.write(".")
            sys.stdout.flush()

    _, csv_data = req("GET", f"/api/v1/jobs/{job_id}/download")
    csv_text = csv_data.decode("utf-8", "replace")
    reader = csv.DictReader(io.StringIO(csv_text))
    leads = list(reader)
    print(f"\n[*] Total de empresas encontradas: {len(leads)}")

    for lead in leads:
        lead["whatsapp"] = format_whatsapp(lead.get("phone", ""))

    if args.socials:
        enrich_socials(leads)

    out_file = args.out or f"leads_{int(time.time())}.csv"
    with open(out_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(leads[0].keys()) if leads else LEAD_FIELDS, delimiter=";")
        writer.writeheader()
        writer.writerows(leads)
    print(f"[✓] Arquivo exportado com sucesso: {out_file} (compatível com Excel pt-BR)")

    if args.webhook:
        push_to_n8n(args.webhook, job_name, leads)

if __name__ == "__main__":
    main()
