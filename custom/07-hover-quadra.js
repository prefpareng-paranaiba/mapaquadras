// ================= DESTAQUE AO PASSAR O MOUSE NA QUADRA / LOTE / CONSTRUÇÃO: SÓ CONTORNO, SEM PREENCHIMENTO =================
(function () {
  // desliga o destaque padrão do qgis2web (preenchimento branco por cima do mosaico)
  try { doHighlight = false; } catch (e) {}
  try { if (typeof featureOverlay !== 'undefined') featureOverlay.getSource().clear(); } catch (e) {}

  var fonteHover = new ol.source.Vector();
  map.addLayer(new ol.layer.Vector({
    source: fonteHover,
    interactive: false,
    zIndex: 9994,
    style: [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ffffff', width: 6 }) }),
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ff9800', width: 3 }) })
    ]
  }));

  var quadras = (typeof camadasDeQuadras === 'function') ? camadasDeQuadras() : [];
  var atual = null;

  // Camadas consideradas no hover, em ordem de prioridade (construção, lote, quadra).
  // A lista vem do 16-selecao-toque.js (mesma regra do clique, inclusive camadas desligadas no painel).
  // Se aquele arquivo não carregou, volta ao comportamento antigo (só quadras).
  function camadasHover() {
    if (typeof window.camadasSelecionaveisPrioridade === 'function') {
      try { return window.camadasSelecionaveisPrioridade(); } catch (e) {}
    }
    return quadras.filter(function (l) {
      return l.getVisible() && l.getOpacity() > 0 && l.get('interactive') !== false;
    });
  }

  var pendente = false, pixelUlt = null;
  // forEachFeatureAtPixel desenha todas as quadras num canvas do tamanho da tela e lê os pixels (getImageData) a cada vez que o mapa
  // se move: é o aviso "Multiple readback operations" do console e o maior peso do hover. Aqui é só geometria: a feição cujo
  // contorno está a até 5 px do mouse (índice espacial, sem canvas). Mesmo resultado do contorno de antes, sem o custo.
  // Com várias camadas, vence o contorno mais próximo; num empate (diferença menor que 1 px) vence a camada mais específica.
  function quadraPerto(pixel) {
    var coord = map.getCoordinateFromPixel(pixel);
    if (!coord) return null;
    var res = map.getView().getResolution() || 1;
    var tol = 5 * res, eps = 1 * res, dMin = Infinity, melhor = null;
    var ext = [coord[0] - tol, coord[1] - tol, coord[0] + tol, coord[1] + tol];
    camadasHover().forEach(function (l) {
      l.getSource().forEachFeatureIntersectingExtent(ext, function (f) {
        var g = f.getGeometry(); if (!g) return;
        var c = g.getClosestPoint(coord), d = Math.hypot(c[0] - coord[0], c[1] - coord[1]);
        if (d <= tol && d < dMin - eps) { dMin = d; melhor = f; }
      });
    });
    return melhor;
  }
  function procurarHover() {
    pendente = false;
    var achou = quadraPerto(pixelUlt);
    if (achou === atual) return;
    fonteHover.clear();
    atual = achou;
    if (achou) fonteHover.addFeature(new ol.Feature(achou.getGeometry().clone()));
  }
  map.on('pointermove', function (e) {
    if (e.dragging || window.medindo) { if (atual) { fonteHover.clear(); atual = null; } return; }
    var oe = e.originalEvent;
    if (oe && oe.pointerType && oe.pointerType !== 'mouse') return;      // só no computador
    pixelUlt = e.pixel;
    if (!pendente) { pendente = true; requestAnimationFrame(procurarHover); }   // DESEMPENHO: no máx. 1 consulta por quadro
  });
})();
