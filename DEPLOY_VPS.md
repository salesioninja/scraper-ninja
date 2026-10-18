# 🚀 Guia de Deploy na VPS — Agência Ninja Lead Scraper
### Arquitetura: Docker Swarm + Traefik v2/v3 + n8n + Evolution API

Este guia detalha o passo a passo para colocar o **Agência Ninja Lead Scraper** em produção na sua VPS, rodando harmoniosamente ao lado do **n8n**, **Evolution API**, **Typebot** e outros contêineres sob o mesmo proxy reverso **Traefik** com SSL automático.

---

## 1. Pré-Requisitos na VPS

1. **Docker e Docker Swarm ativado**:
   ```bash
   docker swarm init
   ```
2. **Rede pública do Traefik** (caso ainda não exista):
   ```bash
   docker network create --driver=overlay --attachable traefik-public
   ```
3. **Rede interna compartilhada** (para n8n e Evolution conversarem internamente):
   ```bash
   docker network create --driver=overlay --attachable ninja-network
   ```
4. **Apontamento de DNS (Tipo A)**:
   - Exemplo: `scraper.seudominio.com.br` apontando para o IP público da sua VPS.

---

## 2. Clonando ou Enviando os Arquivos para a VPS

Na sua VPS, crie uma pasta para o projeto:
```bash
mkdir -p /opt/ninja-scraper
cd /opt/ninja-scraper
```

Copie a pasta `agencia-ninja-scraper/` do seu computador para `/opt/ninja-scraper/` via SCP, Git, FileZilla ou rsync.

---

## 3. Configurando as Variáveis de Ambiente (`.env`)

Copie o arquivo de exemplo:
```bash
cp .env.example .env
nano .env
```

Configure os campos:
```env
# Seu subdomínio
DOMAIN=leads.acessaronline.com.br

# Rede do Traefik no Docker Swarm (Oficial da sua VPS: ninja_net)
TRAEFIK_NETWORK=ninja_net

# Nome do resolver Let's Encrypt no seu Traefik (Oficial da sua VPS: letsencryptresolver)
TRAEFIK_CERTRESOLVER=letsencryptresolver

# Rede interna compartilhada com n8n e Evolution
INTERNAL_NETWORK=ninja-network
```

---

## 4. Deploy no Docker Swarm

Para carregar as variáveis do arquivo `.env` e iniciar a stack no Swarm, execute:

```bash
docker stack deploy -c <(docker compose -f docker-stack.yml config) ninja-scraper
```
*Ou, se preferir exportar as variáveis antes:*
```bash
export $(cat .env | xargs) && docker stack deploy -c docker-stack.yml ninja-scraper
```

Para verificar o status dos serviços:
```bash
docker stack services ninja-scraper
docker service logs ninja-scraper_dashboard
docker service logs ninja-scraper_scraper
```

---

## 5. Integração com o n8n

1. Abra seu **n8n** na VPS (`https://n8n.seudominio.com.br`).
2. Vá em **Workflows** → **Import from File...**
3. Selecione o arquivo:
   `automations/n8n/workflow-lead-enrichment.json`
4. Ative o workflow. Ele criará um endpoint de webhook como:
   `https://n8n.seudominio.com.br/webhook/ninja-leads`
5. No **Dashboard da Agência Ninja**:
   - Clique em **⚙️ Ajustes** no topo direito.
   - Cole a URL do webhook do n8n.
   - Clique em **Salvar Configurações**.
6. Agora, em qualquer busca realizada, basta clicar em **⚡ Enviar p/ n8n** para disparar todos os leads filtrados para o workflow!

---

## 6. Integração com a Evolution API (WhatsApp)

1. No workflow importado do n8n, você encontrará o nó **Disparar Evolution API**.
2. Altere os parâmetros:
   - URL: `http://evolution-api:8080/message/sendText/{sua_instancia}` (como ambos estão na mesma rede `ninja-network`, a comunicação é direta e de altíssima velocidade).
   - Cabeçalho `apikey`: Sua chave da Evolution API.
3. No painel de Ajustes do Scraper, você também pode customizar o texto de abordagem comercial com tags dinâmicas:
   - `{empresa}`: Nome da empresa extraída.
   - `{categoria}`: Categoria ou nicho no Google.
   - `{nota}`: Avaliação em estrelas (ex: 4.8).
   - `{cidade}`: Cidade ou bairro da busca.

---

## 7. Comandos de Manutenção

- **Atualizar o Dashboard após alterações**:
  ```bash
  docker service update --force ninja-scraper_dashboard
  ```
- **Visualizar uso de recursos**:
  ```bash
  docker stats
  ```
- **Remover a stack**:
  ```bash
  docker stack rm ninja-scraper
  ```
