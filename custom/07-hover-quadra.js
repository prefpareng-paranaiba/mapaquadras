// ================= DESTAQUE AO PASSAR O MOUSE NA QUADRA: SÓ CONTORNO, SEM PREENCHIMENTO =================
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

  var pendente = false, pixelUlt = null;
  // forEachFeatureAtPixel desenha todas as quadras num canvas do tamanho da tela e lê os pixels (getImageData) a cada vez que o mapa
  // se move: é o aviso "Multiple readback operations" do console e o maior peso do hover. Aqui é só geometria: a quadra cujo
  // contorno está a até 5 px do mouse (índice espacial, sem canvas). Mesmo resultado do contorno de antes, sem o custo.
  function quadraPerto(pixel) {
    var coord = map.getCoordinateFromPixel(pixel);
    if (!coord) return null;
    var tol = 5 * (map.getView().getResolution() || 1), dMin = tol, melhor = null;
    var ext = [coord[0] - tol, coord[1] - tol, coord[0] + tol, coord[1] + tol];
    quadras.forEach(function (l) {
      if (!l.getVisible() || l.getOpacity() <= 0 || l.get('interactive') === false) return;
      l.getSource().forEachFeatureIntersectingExtent(ext, function (f) {
        var g = f.getGeometry(); if (!g) return;
        var c = g.getClosestPoint(coord), d = Math.hypot(c[0] - coord[0], c[1] - coord[1]);
        if (d <= dMin) { dMin = d; melhor = f; }
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
