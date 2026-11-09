// ================= ROSA DOS VENTOS: gira junto com o mapa; um toque volta para o norte =================
(function () {
  var ROSA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6868.7 -7144.3 5513.3 5513.3" width="200" height="200"><path fill="#263238" d="m-4122.5-6166.1-272.97 1313.9-492.72-323.25-10.375 10.344 322.69 491.94-1311.3 272.34v23.5l1310.8 272.34-324.78 495.09 10.344 10.344 493.03-323.38 272.88 1313.8h23.5l273.03-1314.1 492.75 323.22 10.344-10.344-322.81-492.12 1311.2-272.38v-23.5l-1310.5-272.28 324.53-494.69-10.375-10.344-492.91 323.31-272.88-1313.7h-23.5zm-0.2188 119.03v1373.8 254.84l-280.16-280.25 28.969-139.38 251.19-1209zm736.97 923.69-411.25 411.25-25.875-124.53 437.12-286.72zm-1460.5 10.781 410.31 410.31-124.25 25.812-286.06-436.12zm1042 433.81 142.66 29.656 1205.7 250.5h-1370-258.53l280.22-280.16zm-1963.9 301.66h1370.3 258.5l-280.22 280.22-142.69-29.656-1205.9-250.56zm1666.9 20.094 280.22 280.22-28.969 139.38-251.25 1209.2v-1374.1-254.75zm437.38 257.75 286.19 436.34-410.53-410.53 124.34-25.812zm-763.09 36.062 25.844 124.56-437.19 286.78 411.34-411.34z"/><text x="-4112.0" y="-6521.8" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="711.4" fill="#d32f2f">N</text><text x="-1977.9" y="-4387.6" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="711.4" fill="#263238">L</text><text x="-4112.0" y="-2253.4" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="711.4" fill="#263238">S</text><text x="-6246.2" y="-4387.6" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="711.4" fill="#263238">O</text></svg>';
  // a medição usa o mesmo desenho ao gerar a imagem para compartilhar
  window.ROSA_SVG_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ROSA_SVG);

  var view = map.getView();

  // garante os gestos de girar o mapa: dois dedos no celular; Shift+Alt+arrastar no computador
  try {
    var tem = function (Classe) {
      return map.getInteractions().getArray().some(function (i) { return i instanceof Classe; });
    };
    if (!tem(ol.interaction.PinchRotate)) map.addInteraction(new ol.interaction.PinchRotate());
    if (!tem(ol.interaction.DragRotate)) map.addInteraction(new ol.interaction.DragRotate());
  } catch (e) { console.warn('Rotação do mapa:', e); }

  var el = document.createElement('div');
  el.id = 'rosaVentos';
  el.title = 'Rosa dos ventos: toque para voltar ao norte';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Voltar o mapa para o norte');
  el.style.cssText = 'position:fixed;right:10px;top:6px;z-index:10000;width:56px;height:56px;' +
    'cursor:pointer;' +
    'touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none';
  var img = new Image();
  img.src = window.ROSA_SVG_URL;
  img.alt = '';
  img.draggable = false;
  img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;' +
    'will-change:transform';
  // brilho branco no lugar do fundo: desenhado UMA vez num canvas (um filtro CSS refeito a cada quadro do giro trava o celular)
  (function () {
    var base = new Image();
    base.onload = function () {
      try {
        var M = 24, T = 200, c = document.createElement('canvas');
        c.width = c.height = T + 2 * M;
        var g = c.getContext('2d');
        g.shadowColor = 'rgba(255,255,255,1)'; g.shadowBlur = 7;
        g.drawImage(base, M, M, T, T); g.drawImage(base, M, M, T, T);
        img.src = c.toDataURL('image/png');
      } catch (e) { /* mantém a rosa sem brilho */ }
    };
    base.src = window.ROSA_SVG_URL;
  })();
  el.appendChild(img);
  document.body.appendChild(el);
  // celular (tela estreita): a barra de busca (com 📍 e 📏) ocupa o topo até a borda direita,
  // então a rosa desce para logo abaixo dela; z-index menor para a lista de sugestões ficar por cima
  var stRosa = document.createElement('style');
  stRosa.textContent = '#rosaVentos{z-index:9999 !important}' +
    '@media (max-width:480px){#rosaVentos{top:58px !important}}';
  document.head.appendChild(stRosa);

  function atualizar() {
    img.style.transform = 'rotate(' + (view.getRotation() || 0) + 'rad)';
  }
  view.on('change:rotation', atualizar);
  atualizar();

  el.addEventListener('click', function () {
    var r = view.getRotation() || 0;
    var volta = 2 * Math.PI;
    r = r - volta * Math.round(r / volta);   // escolhe o caminho mais curto até o norte
    view.setRotation(r);
    view.animate({ rotation: 0, duration: 300 });
  });

  // (a rosa fica fixa no canto superior direito; com o PDF ao lado, o CSS do painel a desloca para dentro da área do mapa)
})();
