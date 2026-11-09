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
  function procurarHover() {
    pendente = false;
    var achou = null;
    map.forEachFeatureAtPixel(pixelUlt, function (f) { achou = f; return true; }, {
      layerFilter: function (l) { return quadras.indexOf(l) >= 0 && l.get('interactive') !== false; }
    });
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
