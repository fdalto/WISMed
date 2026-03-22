1. O seletor do rodapé “ativa/inativa” deve pausar tudo (content scripts, análise de regras, ações de clique e upload simulado) ou só pausar ações automáticas?
    Para tudo.
2. Quando estiver “inativa”, você quer manter captura de url/token no site da empresa ou parar isso também?
    Para também.
3. No bloco 2 (download/upload), o “upload simulado” é sempre sucesso quando o download terminar, ou você quer simular falha em alguns casos (ex.: URL inválida/token ausente)?
    Quero uma animação mostrando progressão do upload, no caso da simulação ela deve durar 3 segundos e depois reportar "sucesso, exame enviado".
4. Para o estado de falha, quer usar o texto fixo Falha do envio sempre no título e a mensagem técnica embaixo (menor), certo?
    Isso.
5. O ícone de falha já existe no projeto ou devo usar fallback textual (⚠) enquanto criamos um SVG?
    Coloquei na pasta agora alert-icon.svg
6. Sobre priorização de DICOM completo: você aceita uma estratégia inicial por ranking de palavras (ex.: “exame completo”, “todos”, “full study”, “zip”, “dicom”) antes de “série/imagem atual”?
    Sim vamos tentar assim.
