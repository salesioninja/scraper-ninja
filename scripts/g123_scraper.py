#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agência Ninja — Extrator de Contatos & WhatsApp do Guia Comercial G123
Uso:
    python g123_scraper.py --cidade salto-do-lontra-pr --termo dentista
    python g123_scraper.py --cidade francisco-beltrao-pr --paginas 3 --apenas-wa
    python g123_scraper.py --listar-cidades
"""

import sys
import os
import re
import csv
import argparse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup

BASE_URL = "https://g123.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
}

POPULAR_CITIES = [
    ("salto-do-lontra-pr", "Salto do Lontra - PR"),
    ("francisco-beltrao-pr", "Francisco Beltrão - PR"),
    ("pato-branco-pr", "Pato Branco - PR"),
    ("dois-vizinhos-pr", "Dois Vizinhos - PR"),
    ("cascavel-pr", "Cascavel - PR"),
    ("chapeco-sc", "Chapecó - SC"),
    ("ampere-pr", "Ampére - PR"),
    ("capanema-pr", "Capanema - PR"),
    ("chopinzinho-pr", "Chopinzinho - PR"),
    ("coronel-vivida-pr", "Coronel Vivida - PR"),
    ("marmeleiro-pr", "Marmeleiro - PR"),
    ("realeza-pr", "Realeza - PR"),
    ("palmas-pr", "Palmas - PR"),
    ("clevelandia-pr", "Clevelândia - PR"),
    ("santo-antonio-do-sudoeste-pr", "Santo Antônio do Sudoeste - PR"),
    ("sao-joao-pr", "São João - PR"),
    ("sao-jorge-do-oeste-pr", "São Jorge d'Oeste - PR"),
    ("planalto-pr", "Planalto - PR"),
    ("santa-izabel-do-oeste-pr", "Santa Izabel do Oeste - PR"),
    ("nova-esperanca-do-sudoeste-pr", "Nova Esperança do Sudoeste - PR"),
    ("cruzeiro-do-iguacu-pr", "Cruzeiro do Iguaçu - PR"),
    ("boa-esperanca-do-iguacu-pr", "Boa Esperança do Iguaçu - PR"),
    ("bela-vista-da-caroba-pr", "Bela Vista da Caroba - PR"),
    ("enemas-pr", "Eneas Marques - PR"),
    ("vermo-pr", "Verê - PR"),
    ("renascenca-pr", "Renascença - PR"),
    ("salgado-filho-pr", "Salgado Filho - PR"),
    ("flor-da-serra-do-sul-pr", "Flor da Serra do Sul - PR"),
    ("bom-jesus-do-sul-pr", "Bom Jesus do Sul - PR"),
    ("barracao-pr", "Barracão - PR"),
    ("dionisio-cerqueira-sc", "Dionísio Cerqueira - SC"),
    ("sao-jose-do-cedro-sc", "São José do Cedro - SC"),
    ("guaraciaba-sc", "Guaraciaba - SC"),
    ("sao-miguel-do-oeste-sc", "São Miguel do Oeste - SC"),
    ("maravilha-sc", "Maravilha - SC"),
    ("pinhalzinho-sc", "Pinhalzinho - SC"),
    ("xanxere-sc", "Xanxerê - SC"),
    ("concordia-sc", "Concórdia - SC"),
    ("joacaba-sc", "Joaçaba - SC"),
]

def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
    try:
        return raw.decode("iso-8859-1")
    except Exception:
        return raw.decode("utf-8", errors="ignore")

def parse_leads_from_html(html, city_default=""):
    soup = BeautifulSoup(html, "html.parser")
    leads = []
    seen = set()

    contato_links = soup.find_all("a", href=lambda h: h and "/contato/" in h)
    for a in contato_links:
        href = a["href"]
        m = re.search(r"/contato/(\d{10,12})-([a-z0-9\-]+)", href)
        if not m:
            continue
        raw_phone = m.group(1)
        if raw_phone in seen:
            continue
        seen.add(raw_phone)

        # Formatação do Telefone
        is_mobile = False
        if len(raw_phone) == 11:
            ddd = raw_phone[:2]
            p1 = raw_phone[2:7]
            p2 = raw_phone[7:]
            formatted_phone = f"({ddd}) {p1}-{p2}"
            is_mobile = raw_phone[2] in ["8", "9"]
        elif len(raw_phone) == 10:
            ddd = raw_phone[:2]
            p1 = raw_phone[2:6]
            p2 = raw_phone[6:]
            formatted_phone = f"({ddd}) {p1}-{p2}"
            is_mobile = False
        else:
            formatted_phone = raw_phone

        # Container do anúncio
        card = a
        for _ in range(5):
            if card.parent:
                card = card.parent
                if any(c in card.get("class", []) for c in ["resultadocliente", "resultadopar", "resultadonormal", "row"]):
                    break

        # Extrair nome da empresa
        name_elem = card.find(class_=lambda c: c and any(k in c for k in ["nomecliente", "nomepar", "nomenormal"]))
        name = name_elem.get_text(strip=True) if name_elem else ""
        if not name:
            name = a.get("title") or a.get("alt") or ""
        if not name:
            slug_words = m.group(2).split("-")
            name = " ".join(w.capitalize() for w in slug_words[:4])

        # Extrair Endereço
        addr_elem = card.find(class_=lambda c: c and "endereco" in c)
        address = addr_elem.get_text(strip=True) if addr_elem else ""

        # Extrair Cidade
        city_elem = card.find(class_=lambda c: c and ("cidade" in c or "cidadebase" in c))
        city = city_elem.get_text(strip=True) if city_elem else city_default

        # Extrair Categoria
        cat_elem = card.find(class_=lambda c: c and "vejaoutros" in c)
        category = cat_elem.get_text(strip=True) if cat_elem else ""

        leads.append({
            "name": name,
            "phone": formatted_phone,
            "raw_phone": raw_phone,
            "is_mobile": is_mobile,
            "whatsapp_url": f"https://wa.me/55{raw_phone}" if is_mobile else "",
            "address": address,
            "city": city,
            "category": category,
            "url": href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
        })

    return leads

def scrape_g123(city_slug="salto-do-lontra-pr", term=None, max_pages=1, only_wa=False):
    all_leads = []
    seen_phones = set()
    print(f"\n[*] Iniciando extração G123: Cidade='{city_slug}', Nicho='{term or 'Todos'}', Páginas={max_pages}...")

    for page in range(1, max_pages + 1):
        if term:
            # Busca por termo
            term_slug = re.sub(r"[^\w\s-]", "", term.strip().lower())
            term_slug = re.sub(r"[\s_]+", "-", term_slug)
            if page == 1:
                url = f"{BASE_URL}/pesquisa/{city_slug}/{term_slug}/"
            else:
                url = f"{BASE_URL}/pesquisa/{city_slug}/{term_slug}/pagina-{page}"
        else:
            # Lista completa da cidade
            if page == 1:
                url = f"{BASE_URL}/listas/{city_slug}"
            else:
                url = f"{BASE_URL}/listas/{city_slug}/pagina-{page}"

        try:
            print(f" -> Baixando página {page}: {url}")
            html = fetch_html(url)
            page_leads = parse_leads_from_html(html, city_slug)
            if not page_leads:
                print(f"    (Sem mais resultados na página {page})")
                break

            new_count = 0
            for lead in page_leads:
                if lead["raw_phone"] not in seen_phones:
                    if only_wa and not lead["is_mobile"]:
                        continue
                    seen_phones.add(lead["raw_phone"])
                    all_leads.append(lead)
                    new_count += 1

            print(f"    + {new_count} leads capturados (Total acumulado: {len(all_leads)})")
        except Exception as e:
            print(f"    [!] Erro ao buscar página {page}: {e}")
            break

    return all_leads

def export_to_csv(leads, filename):
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(["Empresa", "Telefone", "WhatsApp?", "Link WhatsApp", "Endereço", "Cidade", "Categoria", "Fonte", "Link Original"])
        for l in leads:
            writer.writerow([
                l["name"],
                l["phone"],
                "SIM" if l["is_mobile"] else "NÃO",
                l["whatsapp_url"],
                l["address"],
                l["city"],
                l["category"],
                "Guia G123",
                l["url"]
            ])
    print(f"\n[OK] Arquivo exportado com sucesso: {filename} ({len(leads)} leads)")

def main():
    parser = argparse.ArgumentParser(description="Agência Ninja — Extrator de Contatos Guia G123")
    parser.add_argument("--cidade", default="salto-do-lontra-pr", help="Slug da cidade (ex.: salto-do-lontra-pr)")
    parser.add_argument("--termo", default="", help="Termo de busca / Nicho (ex.: dentista)")
    parser.add_argument("--paginas", type=int, default=1, help="Quantidade de páginas para varrer")
    parser.add_argument("--apenas-wa", action="store_true", help="Filtrar apenas contatos com WhatsApp (celular)")
    parser.add_argument("--listar-cidades", action="store_true", help="Lista as cidades mais populares catalogadas")
    parser.add_argument("--saida", default="", help="Caminho do arquivo CSV de saída")

    args = parser.parse_args()

    if args.listar_cidades:
        print("\nCidades do Catálogo Regional G123:")
        for slug, label in POPULAR_CITIES:
            print(f"  - {slug:30} -> {label}")
        return

    now = datetime.now()
    date_str = f"dia-{now.day:02d}-{now.month:02d}-{now.year}"
    clean_city = args.cidade.replace("-pr", "").replace("-sc", "").replace("-", "_").title()
    clean_term = args.termo.replace(" ", "_").title() if args.termo else "Geral"
    out_file = args.saida or f"Leads-G123-{clean_term}-{clean_city}-{date_str}.csv"

    leads = scrape_g123(
        city_slug=args.cidade,
        term=args.termo.strip() or None,
        max_pages=args.paginas,
        only_wa=args.apenas_wa
    )

    if leads:
        export_to_csv(leads, out_file)
    else:
        print("[!] Nenhum lead encontrado com os filtros fornecidos.")

if __name__ == "__main__":
    main()
