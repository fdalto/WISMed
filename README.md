# WISMed Upload Bridge

Extensao Chrome em Manifest V3 para capturar um `uploadUrl` no portal da empresa, reconhecer portais/PACS com base em regras remotas e orientar ou automatizar o fluxo de download do exame e envio posterior.

## Visao geral do projeto

O projeto foi estruturado para separar claramente:

- captura de `uploadUrl` no dominio da empresa
- analise de portais/PACS baseada em DOM, hostname e regras JSON remotas
- orquestracao de estado via `chrome.storage.local`
- monitoramento de downloads via `chrome.downloads`
- tentativa de upload automatico quando houver URL HTTP(S) reutilizavel

## Arquitetura dos arquivos

- `manifest.json`: configuracao MV3, permissoes, popup, service worker e content scripts
- `service_worker.js`: coordenacao central, badge, estado global e acoes do popup
- `constants.js`: dominios, URL das regras remotas, chaves de storage e mapa de estados visuais
- `state_manager.js`: leitura, escrita e limpeza do estado salvo
- `content_platform.js`: captura do `uploadUrl` no site da empresa
- `content_portal.js`: analise de PACS/portal, observacao de SPA e execucao de acoes
- `rules_engine.js`: download, cache e avaliacao das regras remotas
- `dom_utils.js`: utilitarios de DOM, texto visivel, debounce e destaque visual
- `download_manager.js`: observacao do lifecycle dos downloads
- `upload_manager.js`: tentativa de upload automatico a partir de uma URL de download reaproveitavel
- `popup.html`, `popup.css`, `popup.js`: interface de status e acoes manuais

## Como carregar no Chrome em modo desenvolvedor

1. Abra `chrome://extensions`.
2. Ative `Developer mode`.
3. Clique em `Load unpacked`.
4. Selecione a pasta [D:\WISMed](/D:/WISMed).

## Como configurar dominio da empresa

Ajuste [constants.js](/D:/WISMed/constants.js):

- `COMPANY_HOST_PATTERNS`: hosts do portal da empresa. O projeto ja vem configurado com `wismedreview.lovable.app`
- `REMOTE_RULES_URL`: endpoint HTTPS do JSON remoto. O projeto ja vem apontando para `https://fdalto.github.io/WISMed/cloud_rules.sample.json`
- tempos de cache e debounce conforme a necessidade do ambiente

Se os PACS-alvo forem conhecidos, reduza os padroes em [manifest.json](/D:/WISMed/manifest.json) para remover `http://*/*` e `https://*/*` antes de distribuir a extensao.

## Exemplo de JSON remoto

```json
{
  "configVersion": "2026-03-20",
  "global": {
    "keywords": ["dicom", "download", "baixar", "zip", "imagens", "export"]
  },
  "vendors": [
    {
      "id": "animate",
      "name": "Animate",
      "priority": 100,
      "detect": {
        "hostnameContains": ["animate"],
        "pathContains": ["/viewer", "/exam"],
        "textContainsAny": ["animate", "dicom"],
        "selectorExists": ["#btnDownloadExam"],
        "scriptSrcContains": ["animate"]
      },
      "actions": [
        {
          "type": "click_selector",
          "selector": "#btnDownloadExam",
          "waitMs": 1000
        }
      ],
      "manualHint": "Fornecedor Animate detectado"
    }
  ]
}
```

O JSON remoto deve conter apenas dados. Nenhum codigo remoto e executado.

## Como testar a captura do upload URL

Suportado por padrao:

- `#upload-config[data-upload-url]`
- `#ext-config[type="application/json"]` com `uploadUrl`
- elementos genericos com `data-upload-url`
- texto visivel que contenha um caminho `/upload/...`

Ao encontrar um valor valido:

- o `service_worker` salva o `uploadUrl`
- o estado muda para `ready`
- o badge fica verde com `OK`

## Como testar a analise do portal/PACS

1. Abra um portal/PACS em outra aba.
2. Abra o popup.
3. Clique em `Recarregar regras` para carregar o JSON remoto.
4. Clique em `Analisar pagina atual`.
5. Se um fornecedor for reconhecido, clique em `Executar acao detectada`.

Estrategias ja implementadas:

- `click_selector`
- `click_text`
- `wait_for_selector`
- `open_menu_then_click`
- `highlight_selector`
- `manual_only`
- `read_attribute`
- `scan_iframes`
- `multi_step_sequence`

## Armazenamento em chrome.storage.local

Persistidos:

- `uploadUrl`
- `platformDetected`
- `rulesVersion`
- `activeVendor`
- `extensionStatus`
- `lastError`
- `lastDownloadInfo`
- `autoModeEnabled`
- `debugMode`
- `portalAnalysis`
- `currentTabInfo`
- `pendingUploadContext`

## Permissoes do manifesto

- `storage`: persistencia do estado da extensao
- `tabs`: descobrir e contatar a aba ativa
- `scripting`: reservado para evolucao de injecoes programaticas
- `downloads`: acompanhar inicio e fim dos downloads
- `webNavigation`: base para evolucoes ligadas a navegacao/SPA
- `host_permissions`: acesso ao dominio da empresa, ao JSON remoto e aos PACS analisados

## Como depurar

O estado completo fica centralizado em `chrome.storage.local`. O popup expoe:

- status atual
- upload URL mascarado
- dominio atual
- fornecedor detectado
- versao das regras
- ultimo download
- ultimo erro

Para depurar o service worker, use a tela da extensao em `chrome://extensions` e abra `service worker`.

## Limitacoes tecnicas conhecidas

- A API `chrome.downloads` nao entrega diretamente o conteudo binario do arquivo ja salvo no disco.
- Por isso, o upload automatico implementado em [upload_manager.js](/D:/WISMed/upload_manager.js) tenta refazer o download pela `finalUrl` HTTP(S).
- Isso so funciona quando o navegador ainda consegue acessar a URL original com a autenticacao necessaria.
- Se o portal gerar um arquivo apenas em contexto local, blob interno ou fluxo nao reaproveitavel, a extensao entrara em erro com orientacao implicita para retry/manual.
- Para um fluxo totalmente robusto, o ideal e capturar uma URL de export valida antes do download final ou integrar com uma API controlada pelo proprio PACS/fornecedor.

## Proximos passos para publicacao na Chrome Web Store

1. Reduzir `host_permissions` para dominios exatos.
2. Substituir `REMOTE_RULES_URL` por um endpoint real com versionamento.
3. Adicionar icones, screenshots e politica de privacidade.
4. Validar o comportamento em PACS reais e refinar os detectores por fornecedor.
5. Revisar o fluxo de upload de acordo com o backend real da empresa.
