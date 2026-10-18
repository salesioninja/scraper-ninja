# Configurações otimizadas de proxy para o scraper e automações
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Accept-Encoding "";

proxy_connect_timeout 300s;
proxy_send_timeout 600s;
proxy_read_timeout 600s;
proxy_buffering off;

sub_filter_once on;
sub_filter '</head>' '<meta name="htmx-config" content=\'{"useTemplateFragments":true}\'></head>';
