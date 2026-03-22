# Empacotar e Servir a Extensão (WISMed)

## 1) Estrutura esperada
Antes de empacotar, confirme que a pasta do projeto contém:

- `manifest.json`
- `service_worker.js`
- `popup.html`, `popup.js`, `popup.css`
- `content_platform.js`, `content_portal.js`
- `rules_engine.js`, `download_manager.js`, `upload_manager.js`
- `constants.js`, `dom_utils.js`, `state_manager.js`
- `cloud_rules.sample.json`
- ícones SVG usados no popup (`correct-icon.svg`, `alert-icon.svg`)

## 2) Rodar em desenvolvimento (sem empacotar)

### 2.1 Servir regras locais (JSON)
A extensão está configurada para `REMOTE_RULES_URL = http://127.0.0.1:5500/cloud_rules.sample.json`.

Você precisa servir essa pasta em `127.0.0.1:5500`.

Opção A (Live Server no VS Code):
1. Abra a pasta no VS Code
2. Clique em `Go Live`
3. Ajuste para usar porta `5500`

Opção B (Python):
```bash
cd /Users/vitordalto/Desktop/Programacao/WISMed
python3 -m http.server 5500 --bind 127.0.0.1
```

### 2.2 Carregar extensão no Chrome
1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Load unpacked`
4. Selecione `/Users/vitordalto/Desktop/Programacao/WISMed`

## 3) Empacotar (.crx + .pem)
Use quando quiser build assinada para distribuição manual.

1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Pack extension`
4. `Extension root directory`: selecione a pasta do projeto
5. `Private key file`:
   - primeira vez: deixe vazio (Chrome gera `.pem`)
   - próximas versões: reutilize o mesmo `.pem` para manter o mesmo ID
6. Clique em `Pack Extension`

Saída gerada:
- `WISMed.crx`
- `WISMed.pem`

## 4) Gerar ZIP para upload (Chrome Web Store)
A Web Store usa ZIP da pasta da extensão (não CRX).

No terminal:
```bash
cd /Users/vitordalto/Desktop/Programacao/WISMed
zip -r ../WISMed-extension.zip . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x "*.DS_Store" \
  -x "*.pem" \
  -x "*.crx"
```

## 5) Atualizar versão
Sempre incremente `version` em `manifest.json` antes de distribuir:

Exemplo:
```json
"version": "0.1.1"
```

## 6) Checklist antes de publicar

- `manifest.json` com versão nova
- Recarregar extensão em `chrome://extensions`
- Testar fluxo completo:
  - captura `uploadUrl + uploadToken`
  - clique no dropdown/download
  - estado `Baixando`
  - estado final `Processo finalizado. Exame enviado`
- Revisar permissões e domínios em `host_permissions`

## 7) Problemas comuns

### Erro de CORS/PNA para `127.0.0.1`
Se ocorrer em páginas PACS HTTP, o projeto já possui fallback para regras empacotadas (`chrome.runtime.getURL`). Ainda assim, manter o servidor local ativo ajuda em testes de edição de JSON.

### Mudanças não aparecem
1. Clique em `Reload` na extensão em `chrome://extensions`
2. Recarregue a aba do PACS

### ID da extensão mudou
Isso ocorre quando empacota com chave diferente. Reutilize sempre o mesmo `.pem`.

## 8) Distribuir para outras pessoas (instalação pelo site)

Se o objetivo e permitir que qualquer usuario instale ao acessar seu site, use **Chrome Web Store**.

### 8.1 Fluxo recomendado (producao)
1. Gere o ZIP da extensao (secao 4).
2. Crie/publice item na Chrome Web Store (conta de desenvolvedor Google).
3. Aguarde aprovacao.
4. Copie a URL publica da extensao na loja.
5. No seu site (`wismedreview.lovable.app`), adicione botao/link:
   - texto: `Instalar extensao`
   - destino: URL da extensao na Chrome Web Store

Resultado para o usuario:
- clica no botao no site
- abre a pagina da extensao na loja
- clica em `Usar no Chrome` / `Adicionar ao Chrome`
- instala sem modo desenvolvedor

### 8.2 O que NAO funciona para publico geral
- `Load unpacked`: serve apenas para desenvolvimento local.
- distribuir pasta da extensao para usuarios finais: exige modo desenvolvedor.
- instalar `.crx` diretamente em Chrome moderno: geralmente bloqueado fora de politicas corporativas.

### 8.3 Atualizacoes para usuarios
Depois de publicada na Web Store, novas versoes aprovadas sao atualizadas automaticamente no Chrome dos usuarios.

### 8.4 Recomendacao de produto
No site, mostre duas opcoes:
1. `Instalar extensao` (Web Store)
2. `Ja instalei, abrir instrucoes` (passos curtos de uso)
