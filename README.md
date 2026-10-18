# ⚡ Agência Ninja — Lead Scraper Pro & Automações com IA

Plataforma unificada e de alto desempenho para **extração, enriquecimento e ativação de leads comerciais** diretamente do Google Maps.

Projetada com identidade visual Cyber-Aurora futurista para a **Agência Ninja — Marketing e Automações com I.A**, com arquitetura nativa para **VPS com Docker Swarm, Traefik, n8n e Evolution API**.

---

## 🌟 Principais Recursos

- 🚀 **Dashboard Magnífico & Reativo**: Interface dark cyberpunk com acentos neon ciano e violeta, métricas em tempo real (KPIs), acompanhamento de fila e gestão de leads.
- 🎯 **Launchpad Inteligente de Buscas**:
  - Tags de nichos de alto valor para agências (Odontologia, Médicos, Imobiliárias, Advocacia, Estética, Concessionárias, Energia Solar, etc.).
  - Geolocalização em tempo real via OpenStreetMap Nominatim.
  - Seletor de raio visual (km) com mini-mapa interativo Leaflet Dark Matter.
  - Controle de profundidade de leads (20, 60, 120, 250, 500 leads) com estimativa de tempo.
- 📱 **Ativação Comercial em 1 Clique (WhatsApp)**:
  - Identificação e validação de números celulares brasileiros (DDD + 9 dígitos).
  - Botão com link direto para o WhatsApp (`wa.me`) com mensagem de abordagem comercial personalizada da Agência Ninja.
- ⚡ **Integração Nativa com n8n & Webhooks**:
  - Disparo de leads (filtrados ou selecionados) direto para o webhook do n8n com payload estruturado em JSON.
  - Workflow do n8n já incluso na pasta `automations/n8n/` pronto para importar!
- 🤖 **Pronto para Evolution API**:
  - Compatibilidade com envio automatizado de mensagens de WhatsApp via Evolution API.
- 📊 **Exportações Profissionais**:
  - **Excel Pro**: Arquivo `.csv` com UTF-8 BOM e separador `;` (abre no Excel do Brasil sem caracteres estranhos).
  - **Google Sheets**: Arquivo `.csv` padrão com separador vírgula.
  - **Copiar TSV**: Copie com 1 clique e cole direto em qualquer planilha (Ctrl+V).
  - **JSON Completo**: Exportação de dados brutos para desenvolvedores.
- 🛡️ **Filtros e Deduplicação Inteligente**:
  - Filtro por nicho/categoria, apenas com WhatsApp, apenas com e-mail, apenas com website.
  - Deduplicação automática por telefone, place_id ou nome da empresa.

---

## 📁 Estrutura do Projeto Unificado

```text
agencia-ninja-scraper/
├── .env.example                     # Variáveis de ambiente para VPS e Traefik
├── DEPLOY_VPS.md                    # Passo a passo para Docker Swarm + Traefik na VPS
├── docker-compose.yml               # Execução local ou VPS standalone
├── docker-stack.yml                 # Deploy oficial em cluster Docker Swarm
├── nginx.conf                       # Configuração do Nginx e proxy reverso
├── scraper-proxy.inc                # Otimizações de streaming e timeouts do scraper
│
├── frontend/                        # O Novo Dashboard Magnífico
│   ├── index.html                   # Interface do Dashboard
│   ├── css/
│   │   ├── ninja-theme.css          # Design System Cyber-Aurora (Ciano, Violeta, Chrome)
│   │   └── dashboard.css            # Estilos dos componentes, KPIs e tabela
│   ├── js/
│   │   ├── app.js                   # Master controller e reatividade
│   │   ├── api.js                   # Comunicação com a API do Scraper
│   │   ├── automations.js           # Integrações n8n, WhatsApp e exportações
│   │   └── map.js                   # Mapeamento Leaflet Dark Matter
│   └── assets/
│       └── logo-ninja.png           # Logo oficial da Agência Ninja
│
├── automations/                     # Automações prontas
│   ├── n8n/
│   │   └── workflow-lead-enrichment.json  # Workflow oficial para importar no n8n
│   └── evolution-api/
│       └── payload-examples.json          # Exemplos de chamadas para Evolution API
│
├── scripts/                         # Ferramentas CLI
│   └── scrape.py                    # Script Python CLI com suporte a proxies e webhook
│
└── engine/                          # Código-fonte Go original do motor
```

---

## 🚀 Como Executar

### Opção 1: Execução Local com Docker Compose
```bash
cd agencia-ninja-scraper
docker compose up -d
```
Acesse o Dashboard em: `http://localhost:8080`

### Opção 2: Deploy em Produção na VPS (Docker Swarm + Traefik)
Consulte o guia completo passo a passo em:
👉 **[DEPLOY_VPS.md](DEPLOY_VPS.md)**

---

## ⚙️ Configurações Recomendadas no Dashboard

Ao abrir o painel, clique em **⚙️ Ajustes** no canto superior direito para definir:
1. **URL do Webhook do n8n**: Ex: `https://n8n.seudominio.com.br/webhook/ninja-leads`
2. **URL e Instância da Evolution API**: Ex: `http://evolution-api:8080`
3. **Template de Mensagem do WhatsApp**: Personalize a mensagem de abordagem usando `{empresa}`, `{categoria}`, `{nota}`, `{cidade}`.

---

## 🔒 Boas Práticas e Uso Responsável
- Para coletas grandes e contínuas em ambiente de produção na VPS, utilize proxies rotativos (Webshare, Bright Data ou Proxy-Seller) para evitar bloqueios temporários de IP pelo Google.
- Respeite as leis de privacidade e diretrizes de proteção de dados (LGPD) no envio de mensagens comerciais.
