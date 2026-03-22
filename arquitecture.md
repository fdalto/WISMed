# WISMed - Arquitecture

## Objetivo
Documentar a arquitetura atual da extensao, responsabilidades por modulo e pontos de extensibilidade.

## Visao de alto nivel
A extensao opera em 3 camadas:

1. Captura de credenciais de upload no portal da empresa.
2. Analise/acao em PACS-viewers (heuristica generica + vendors).
3. Orquestracao de estado e feedback visual (badge + popup).

## Componentes

### 1) Background
- Arquivo: `service_worker.js`
- Responsabilidades:
  - centralizar estado global
  - receber eventos dos content scripts
  - aplicar regra de ativa/inativa (kill-switch global)
  - sincronizar badge

### 2) Persistencia
- Arquivo: `state_manager.js`
- Responsabilidades:
  - wrapper de `chrome.storage.local`
  - leitura/escrita/limpeza do estado
  - broadcast de `STATE_UPDATED`

### 3) Captura no dominio da empresa
- Arquivo: `content_platform.js`
- Responsabilidades:
  - executar apenas em `wismedreview.lovable.app`
  - capturar `#data-upload-url` e `#data-upload-token`
  - reportar para background quando ambos forem validos

### 4) Analise no PACS/viewer
- Arquivo: `content_portal.js`
- Responsabilidades:
  - observar mudancas DOM/URL em paginas PACS
  - detectar vendor por regras
  - executar fluxo generico:
    - abrir dropdown de download (quando presente)
    - selecionar alvo por ranking de termos
    - aplicar cooldown de 4s entre tentativas
  - destacar elementos com halo quando necessario

### 5) Motor de regras
- Arquivo: `rules_engine.js`
- Responsabilidades:
  - carregar regras com cache (`rulesCache`, TTL)
  - validar payload JSON
  - fallback inteligente:
    - remoto (`REMOTE_RULES_URL`)
    - arquivo empacotado da extensao
    - fallback embedado (`EMBEDDED_FALLBACK_RULES`)

### 6) Download e envio
- Arquivos: `download_manager.js`, `upload_manager.js`
- Responsabilidades:
  - detectar criacao/conclusao de download
  - iniciar simulacao de upload ao concluir download
  - simulacao de 3s com estado de progresso
  - marcar sucesso ou erro no estado global

### 7) Interface
- Arquivos: `popup.html`, `popup.css`, `popup.js`
- Responsabilidades:
  - exibir dois blocos de status (link e envio)
  - exibir progresso no envio simulado
  - permitir toggle `ativa/inativa`
  - exibir erro com estilo padronizado

### 8) Editor de regras
- Arquivo: `rules_editor.html`
- Responsabilidades:
  - carregar JSON atual
  - editar listas de termos/seletores
  - ajustar `minimumScore`
  - exportar novo `cloud_rules.sample.json`

## Modelo de estado (resumo)

Campos principais em `chrome.storage.local`:
- `uploadUrl`, `uploadToken`
- `autoModeEnabled`
- `extensionStatus`
- `lastDownloadInfo`
- `pendingUploadContext`
- `lastUploadResult`
- `lastError`
- `rulesCache`, `rulesVersion`, `lastRulesSyncAt`

## Fluxo de eventos

1. `content_platform.js` captura URL/token -> envia mensagem ao `service_worker`.
2. `service_worker` atualiza estado e badge.
3. `content_portal.js` analisa PACS e tenta acao generica/vendor.
4. `download_manager.js` detecta download completo.
5. `upload_manager.js` simula envio (3s) e atualiza sucesso/erro.
6. `popup.js` reage a `STATE_UPDATED` e renderiza UI.

## Extensibilidade

### Evoluir termos sem alterar codigo
Ajustar `cloud_rules.sample.json`:
- `global.genericDropdown.*`
- `global.genericDownload.*`
- `global.downloadPriority.*`

### Adicionar vendor especifico
Inserir novo item em `vendors[]` com:
- `detect` (hostname/path/texto/seletores)
- `actions` (ex.: `pulse_halo_selector`, `click_selector`, `click_text`)

### Integrar upload real
Substituir simulacao em `upload_manager.js` por integracao Supabase/API mantendo:
- estados (`upload_in_progress`, `upload_success`, `error`)
- contrato de `pendingUploadContext` e `lastUploadResult`

## Riscos conhecidos

- PACS com DOM altamente dinamico podem exigir novos seletores.
- Acuracia do fluxo generico depende da qualidade dos termos no JSON.
- Alguns viewers podem bloquear automacao de clique por contexto de seguranca.
