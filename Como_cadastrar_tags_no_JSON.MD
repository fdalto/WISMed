# Como cadastrar tags no JSON (novos sites/portais)

Este guia ensina como adicionar novos portais no `cloud_rules.sample.json` para a extensão detectar o site e executar ações de download automaticamente.

## 1) Objetivo da regra

Cada item em `vendors` representa um portal/site.

Uma regra completa precisa:

1. Detectar que está no portal correto (`detect`).
2. Definir o que fazer nesse portal (`actions`).
3. Informar dica manual para fallback (`manualHint`).

Arquivo principal: `cloud_rules.sample.json`

## 2) Estrutura base de um vendor

```json
{
  "id": "nome-unico-do-vendor",
  "name": "Nome amigável do portal",
  "priority": 100,
  "detect": {
    "hostnameContains": ["dominio-do-portal"],
    "pathContains": ["/exames", "/viewer"],
    "textContainsAny": ["download", "dicom", "estudo"],
    "selectorExists": ["button[data-cy='download']", "#btn-download"],
    "scriptSrcContains": ["vendor.js"]
  },
  "actions": [
    {
      "type": "click_text",
      "texts": ["download dicom", "baixar dicom", "download"]
    }
  ],
  "manualHint": "Se necessário, abra o menu do exame e escolha Download DICOM completo."
}
```

## 3) Quais dados coletar do site (tags/classes/IDs)

Durante a análise do portal, colete:

1. Domínio e rota:
- Ex.: `portal.exemplo.com` + `/study/123`.

2. Textos visíveis relevantes:
- Palavras como `download`, `baixar`, `dicom`, `zip`, `exame completo`.

3. Seletores estáveis (preferência):
- `data-*` (ex.: `data-cy`, `data-testid`)  
- `id` fixo (`#btn-download`)  
- atributos semânticos (`[aria-label='Download']`)

4. Seletores menos estáveis (usar com cuidado):
- classes geradas dinamicamente (`.styles__...`, hashes de CSS-in-JS).

5. Elementos de fluxo:
- Botão/menu que abre opções.
- Item final que dispara o download.
- Elemento que indica que menu carregou.

## 4) Campos de detecção (`detect`) e como pensar

A extensão pontua vendors por sinais. Combine sinais fortes + médios:

- `hostnameContains`: melhor sinal de precisão.
- `pathContains`: ajuda a distinguir áreas internas do portal.
- `textContainsAny`: útil, mas pode gerar falso positivo.
- `selectorExists`: ótimo para confirmar UI específica.
- `scriptSrcContains`: opcional, bom quando o vendor injeta scripts com nome conhecido.

Dica: evite depender de um único sinal fraco. Use 2-3 sinais consistentes.

## 5) Tipos de ação suportados hoje

Ações válidas no `actions[]` (implementadas em `content_portal.js`):

1. `click_selector`
- Campos: `selector`
- Clica no primeiro elemento que casar com o seletor.

2. `click_text`
- Campos: `texts` (array), opcional `selector`
- Busca elemento por texto visível e clica.

3. `wait_for_selector`
- Campos: `selector`, opcional `timeoutMs`
- Aguarda elemento aparecer.

4. `open_menu_then_click`
- Campos: `menuSelector`, `targetSelector`, opcional `waitMs`
- Abre menu e depois clica no alvo.

5. `highlight_selector`
- Campos: `selector`
- Apenas destaca (debug/apoio visual).

6. `pulse_halo_selector`
- Campos: `selector`, opcional `durationMs`
- Destaca vários elementos (debug/guia visual).

7. `click_selector_all`
- Campos: `selector`
- Clica em todos elementos encontrados.

8. `manual_only`
- Campos: opcional `message`
- Não executa clique; registra ação manual.

9. `read_attribute`
- Campos: `selector`, `attribute`
- Lê atributo de elemento (debug/extração).

10. `scan_iframes`
- Campos: `texts` (array)
- Procura textos dentro de iframes acessíveis.

11. `multi_step_sequence`
- Campos: `steps` (array de ações)
- Executa sequência de ações em ordem.

## 6) Estratégia de fluxo (como montar o caminho de navegação)

Desenhe o fluxo real do usuário antes de escrever JSON:

1. Tela inicial do estudo/exame.
2. Se houver, abrir menu de ferramentas.
3. Clicar em opção de export/download.
4. Confirmar modalidade correta (DICOM/ZIP completo).
5. Encerrar.

Depois converta para ações:

```json
{
  "type": "multi_step_sequence",
  "steps": [
    { "type": "wait_for_selector", "selector": "[data-cy='dropDownToolsWrapper']", "timeoutMs": 10000 },
    { "type": "open_menu_then_click", "menuSelector": "[data-cy='dropDownToolsWrapper']", "targetSelector": "[data-cy='download-dicom']", "waitMs": 800 },
    { "type": "click_text", "texts": ["estudo completo", "exame completo", "full study"] }
  ]
}
```

## 7) Template pronto para novo site

Copie e ajuste:

```json
{
  "id": "novo-portal-x",
  "name": "Novo Portal X",
  "priority": 120,
  "detect": {
    "hostnameContains": ["portalx.com"],
    "pathContains": ["/viewer", "/study"],
    "textContainsAny": ["download", "dicom"],
    "selectorExists": ["[data-cy='download']", "button[aria-label*='Download']"],
    "scriptSrcContains": []
  },
  "actions": [
    {
      "type": "multi_step_sequence",
      "steps": [
        { "type": "wait_for_selector", "selector": "[data-cy='download']", "timeoutMs": 8000 },
        { "type": "click_selector", "selector": "[data-cy='download']" },
        { "type": "click_text", "texts": ["dicom", "exame completo", "full study"] }
      ]
    }
  ],
  "manualHint": "Se o download não iniciar, repetir o fluxo manual pelo menu Download."
}
```

## 8) Checklist de qualidade antes de salvar

1. `id` único (não repetir com outros vendors).
2. `actions` é array válido e com tipos suportados.
3. Seletores testados no DevTools (`document.querySelector`).
4. Textos contemplam português e inglês quando necessário.
5. `priority` coerente (vendor específico > genérico).
6. `manualHint` curto e claro para fallback.

## 9) Como validar no projeto

1. Atualize `cloud_rules.sample.json`.
2. Recarregue a extensão em `chrome://extensions`.
3. Abra um estudo no portal alvo.
4. Verifique no popup se o vendor foi detectado.
5. Teste execução automática e manual.
6. Se falhar, refine `detect.selectorExists` e `actions`.

## 10) Boas práticas para evitar quebra futura

1. Prefira seletores estáveis (`data-*`, `id`, `aria-*`).
2. Evite caminhos CSS longos e frágeis.
3. Evite classes com hash gerado por build.
4. Use `multi_step_sequence` quando houver menu + subação.
5. Mantenha regras genéricas como fallback, mas com prioridade menor.

