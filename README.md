# WISMed Upload Bridge

Extensao Chrome (Manifest V3) para:

- capturar `uploadUrl` e `uploadToken` no portal da empresa (`wismedreview.lovable.app`)
- rastrear PACS/viewers em qualquer dominio
- executar heuristicas genericas de download DICOM
- simular upload apos o download finalizar (3 segundos)

## Fluxo atual simplificado

1. A extensao inicia **ativa** por padrao.
2. No portal da empresa, captura:
   - `#data-upload-url`
   - `#data-upload-token`
3. Em PACS/viewers, tenta:
   - abrir dropdown de download (quando existir)
   - priorizar opcoes de DICOM completo/ZIP por score de termos
   - aplicar cooldown de 4s para evitar multi-cliques repetidos
4. Quando o download conclui, executa simulacao de upload por 3s e marca sucesso.

## Estados visuais no popup

Layout com 2 blocos + rodape:

- Bloco 1: captura de link/token
- Bloco 2: download + envio
- Rodape: chave `Extensao ativa/inativa`

Cores:

- standby/inativa: cinza
- rastreando: verde claro
- sucesso (link/token capturados ou envio concluido): verde
- erro: amarelo pastel + icone de alerta + titulo fixo `Falha do envio`

## Arquivos principais

- `manifest.json`: configuracao MV3 e content scripts
- `constants.js`: constantes, estados, chaves de storage e fallback de regras
- `service_worker.js`: coordenacao central, badge, mensagens e toggle global ativa/inativa
- `state_manager.js`: leitura/escrita em `chrome.storage.local`
- `content_platform.js`: captura de `uploadUrl/uploadToken` no dominio da empresa
- `content_portal.js`: analise de PACS/viewers, dropdown generico, score de download e cooldown
- `rules_engine.js`: carrega regras (remotas, empacotadas ou fallback embedado)
- `download_manager.js`: monitora download via `chrome.downloads`
- `upload_manager.js`: simulacao de upload (3s) e estados de sucesso/erro
- `popup.html`, `popup.css`, `popup.js`: interface simplificada em dois blocos
- `cloud_rules.sample.json`: regras locais de desenvolvimento
- `rules_editor.html`: editor visual para evoluir termos e gerar novo JSON

## Regras (cloud_rules)

URL de desenvolvimento em `constants.js`:

- `REMOTE_RULES_URL`: `http://127.0.0.1:5500/cloud_rules.sample.json`

Blocos importantes no JSON:

- `global.downloadPriority.preferred`
- `global.downloadPriority.avoid`
- `global.genericDropdown.triggerSelectors`
- `global.genericDropdown.triggerTexts`
- `global.genericDownload.candidateSelectors`
- `global.genericDownload.actionTexts`
- `global.genericDownload.minimumScore`
- `vendors[]` para regras especificas por fornecedor

## CORS/PNA em ambiente local

Quando a pagina PACS roda em `http://...`, o browser pode bloquear fetch para `127.0.0.1` em content script (Private Network Access).

Para contornar:

- o `rules_engine.js` tenta carregar `cloud_rules.sample.json` empacotado (`chrome.runtime.getURL`) quando detectar loopback
- se falhar, usa fallback embedado em `constants.js`

## Como carregar no Chrome

1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Load unpacked`
4. Selecione a pasta do projeto

## Como usar o Rules Editor

1. Abra `rules_editor.html` via servidor local (ex.: Live Server)
2. Clique em `Carregar cloud_rules.sample.json`
3. Edite termos/seletores
4. Clique em `Gerar JSON` e depois `Baixar cloud_rules.sample.json`

## Armazenamento (chrome.storage.local)

Chaves principais:

- `uploadUrl`
- `uploadToken`
- `autoModeEnabled`
- `extensionStatus`
- `lastError`
- `lastDownloadInfo`
- `pendingUploadContext`
- `lastUploadResult`
- `rulesCache`, `rulesVersion`, `lastRulesSyncAt`

## Observacao

O envio atual esta em modo simulado. Integracao real com Supabase/backend sera implementada depois.
