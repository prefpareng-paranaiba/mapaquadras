# Mapa de quadras — estrutura do projeto

  index.html        MESTRE (seu). Só carrega os scripts. A exportação do qgis2web NÃO o substitui.
  mosaicos.js       lista dos mosaicos de drone  <- edite aqui para adicionar bairros
  mosaicos/         tiles (z/x/y.webp), uma subpasta por bairro. Fora do pacote por causa do tamanho.
  custom/           todo o seu código (busca, medição, popup, street view, dock, rotação...), um arquivo por recurso
  perf.js, sw.js    desempenho e cache offline (seus)
  ruas.json         ruas (seu)
  atualizar.py      traz uma nova exportação do qgis2web sem apagar nada acima

  layers/ styles/ resources/ webfonts/   <- GERADOS pelo qgis2web (podem ser substituídos à vontade)

## Fluxo de atualização
1. No QGIS: qgis2web -> exporte para uma PASTA TEMPORÁRIA (nunca por cima do site).
2. python atualizar.py "C:\...\pasta_temporaria"      (use --simular para só ver o que mudaria)
3. Abra o site e confira. O que foi trocado fica em _backup/<data>/.

## Adicionar um mosaico
1. Coloque a pasta de tiles em mosaicos/<nome>/  (z/x/y.webp)
2. Em mosaicos.js, acrescente uma linha na lista (exemplo comentado no arquivo).

## Tiles em outro lugar (recomendado: 60 MB+ e crescendo)
Em mosaicos.js, MOSAICOS_BASE = 'https://seu-host/mosaicos/'. O site fica pequeno e os tiles
sobem uma vez só (Cloudflare R2/Pages, GitHub Pages, S3...). O host precisa permitir CORS apenas se
você quiser que a imagem de medição inclua o mosaico.
Se preferir manter o formato antigo (pasta santa_monica/ na raiz do site): MOSAICOS_BASE = ''.

## Se você renomear a camada no QGIS
O atualizar.py detecta o nome novo e ajusta perf.js e custom/*.js sozinho (caso de 1 camada de dados).
