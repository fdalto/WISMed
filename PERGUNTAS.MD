# Perguntas em aberto

1. O modo `Automação` (`autoModeEnabled`) deve realmente controlar execução automática? Hoje ele é salvo no estado, mas não está sendo usado para bloquear/liberar ações automáticas.
 r.1: Quero simplificar a extensão, ela deve entrar sempre no modo ativo, em baixo colocaremos um seletor que vem marcado sim por padrão dizendo que está inativa ou ativa. Isso faz com que a extensão fique rastreando os sites ou parada.

2. O backend de upload espera exatamente `multipart/form-data` com campo `file`? Precisa de headers extras (token, tenant, etc.)?
 r.2: Essa parte não está pronta ainda. O Upload será feito na supabase. Por enquanto, a extensão deve rastrear o site https://wismedreview.lovable.app/, procurar pelo URL e token.
 A extensão agora pode capturar URL e token assim:
    const url   = document.getElementById('data-upload-url').textContent;
    const token = document.getElementById('data-upload-token').textContent;
 Vamos inicialmente SIMULAR UM UPLOAD. Isso será feito depois. Por ora, sinalize que foi capturado o link, quando o download terminar, simule o upload e mostre o feedback.

3. Quando o upload falhar por autenticação no `finalUrl`, o comportamento esperado é só erro no popup ou você quer fallback manual guiado (ex.: botão “reenviar arquivo local”)?
 r.3: vamos simplificar o aspecto visual da plataforma em 2 metades, superior e inferior. Quando falhar a metade inferior deve ficar amarela com um simbolo de alerta e dizer com letras grandes "Falha do envio" em baixo a mensagem de erro capturada com font pequena.

4. As regras de `cloud_rules.sample.json` são só exemplo/local ou já são a base oficial que vamos manter em produção?
 r.4: precisamos melhorar a lógica de execução dele, ele precisa ser mais simples. A idéia e ter regras globais para:
    1 - captura do URL: 
        1.1 - const url   = document.getElementById('data-upload-url').textContent;
        1.2 - captura token: const token = document.getElementById('data-upload-token').textContent;
        1.3 - domínio da empresa: https://wismedreview.lovable.app
    2 - termos genéricos para tentar fazer o download em plataformas ainda nao cadastradas. Nesse bloco quero colocar termos que geralmente estão no site de PACS de empresas cuja extensão deve rastrear para tentar clicar em "download DICOM", por exemplo:
       "textContainsAny": [
          "download",
          "baixar",
          "dicom",
          "exportar"
        ],
    Mas temos que ter um mecanismo para priorizar baixar DICOM de todo exame compactado. Alguns websites oferecem baixar DICOM apenas da série atual ou imagem atual.
    3 - regras específicar para empresas já avaliadas/cadastradas. Neste caso colocaremos um detector de domínio ou elemento do DOM, se a pagina tiver este domínio OU contiver o nome do vendor no DOM ele vai ter instruções específicas para esta pagina.
        Exemplo: 
        se o domínio contiver ...pixeonkorus... ou img[alt='Pixeon'],
         fazer: 
         "actions": 
            [
            {
            "type": "pulse_halo_selector",
            "selector": "input[title='Exame de Imagem']",
            "durationMs": 10000
            }
            ],
    O objetivo deste bloco 3 é gerar ao longo do tempo estratégias automáticas de download quando o site nao for capturado pelas estratégias genéricas.

5. A extensão deve atuar em todos os domínios (`https://*/*`, `http://*/*`) durante desenvolvimento, ou já quer restringir agora para hosts específicos?
a extensão sempre vai rastrear todos domínios.

O que fazer:
Colocar remote rules (cloud_rules) local para desenvolvimento servido em http://127.0.0.1:5500/cloud_rules.sample.json

A extensão agora pode capturar URL e token assim:
const url   = document.getElementById('data-upload-url').textContent;
const token = document.getElementById('data-upload-token').textContent;

Simplificar o aspecto visual da extensao para, um rodapé com o botao de ativar e 2 blocos principais (captura do link e captura da imagem) que devem apresentar estados responsivos baseados em cores:
    standby/desligado = cinza
    rastreando = verde claro
    link e token capturados = verde bandeira + mudança textual com símbolo de (correct-icon.svg)
    erro = amarelo tom pastel com simbolo de falha e mensagem
Esquema:
    [ bloco captura de link upluad ]
    [ bloco captura image, donwload e upload ]
    [ footer com botao ativado ]

