// =====================================================================================
// perf.js — ajustes de DESEMPENHO (principalmente celular). Carregar DEPOIS de qgis2web.js.
// Fica separado dos arquivos gerados pelo qgis2web: reexportar o projeto não apaga estes ajustes.
// =====================================================================================
(function () {
  'use strict';

  var PERF = {
    rotulosZoomMin: 16,       // número das quadras só aparece a partir deste zoom (abaixo, 1.458 textos sobrepostos pesam muito)
    googleMaxZoom: 21,        // o Google não tem tiles além disso; sem limite o mapa pede z22+ e recebe erro
    pixelRatioMax: 2          // celulares de tela 3x: limita a resolução interna do mapa (0 = não limitar)
  };

  // ---- 1) Estilo das quadras: objetos criados UMA vez (o original recriava 1.458 estilos + textos a cada quadro) ----
  var lyrQ = window.lyr_Quadras_1;
  if (lyrQ) {
    var traco = new ol.style.Stroke({ color: 'rgba(238,255,0,1.0)', lineCap: 'square', lineJoin: 'bevel', width: 2.85 });
    var soContorno = [new ol.style.Style({ stroke: traco })];
    var fillTxt = new ol.style.Fill({ color: '#f7ff01' });
    var bordaTxt = new ol.style.Stroke({ color: '#000000', width: 3 });
    var cache = {};
    var resMax = 156543.03392804097 / Math.pow(2, PERF.rotulosZoomMin);   // resolução (m/px) do zoom mínimo dos rótulos

    function estiloComRotulo(txt) {
      return cache[txt] || (cache[txt] = [new ol.style.Style({
        stroke: traco,
        text: new ol.style.Text({
          text: txt, font: "13.0px 'Arial', sans-serif", textAlign: 'center',
          fill: fillTxt, stroke: bordaTxt, overflow: false, placement: 'point'
        })
      })]);
    }
    lyrQ.setStyle(function (feature, resolution) {
      if (resolution > resMax) return soContorno;
      var q = feature.get('Quadra');
      return (q === null || q === undefined) ? soContorno : estiloComRotulo(String(q));
    });
  }

  // ---- 2) Google híbrido: limita o zoom dos tiles, sem animação de fade (menos redesenho) ----
  if (window.lyr_GoogleHybrid_0) {
    window.lyr_GoogleHybrid_0.set('title', 'Google Satélite');   // base só com imagem (lyrs=s); os nomes vêm da camada "Nomes de ruas"
    window.lyr_GoogleHybrid_0.setSource(new ol.source.XYZ({
      attributions: ' ',
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maxZoom: PERF.googleMaxZoom,
      transition: 0
    }));
  }

  // ---- 3) Cursor "mão" ao passar o mouse: 1 consulta por quadro e só com mouse (no toque não existe hover) ----
  try { map.un('pointermove', pointerOnFeature); } catch (e) {}
  var pend = false, ult = null;
  // hasFeatureAtPixel desenha TODAS as quadras num canvas do tamanho da tela e lê os pixels de volta (getImageData) toda vez que o mapa
  // muda de posição/zoom: é o "Canvas2D: Multiple readback operations" do console, e pesa muito. Aqui a checagem é só geometria:
  // distância até o contorno das quadras (índice espacial), sem canvas.
  var fonteQ = lyrQ && lyrQ.getSource();
  function pertoDeQuadra(pixel) {
    var coord = map.getCoordinateFromPixel(pixel);
    if (!coord) return false;
    var tol = 6 * map.getView().getResolution(), achou = false;
    fonteQ.forEachFeatureIntersectingExtent([coord[0] - tol, coord[1] - tol, coord[0] + tol, coord[1] + tol], function (f) {
      var g = f.getGeometry();
      if (!g) return;
      var p = g.getClosestPoint(coord);
      if (Math.hypot(p[0] - coord[0], p[1] - coord[1]) <= tol) { achou = true; return true; }
    });
    return achou;
  }
  function atualizarCursor() {
    pend = false;
    if (!ult || window.medindo) return;                // medindo/desenhando: outro script cuida do cursor
    var tem = fonteQ ? pertoDeQuadra(ult)
                     : map.hasFeatureAtPixel(ult, { layerFilter: function (l) { return l && l.get('interactive'); } });
    map.getViewport().style.cursor = tem ? 'pointer' : '';
  }
  map.on('pointermove', function (evt) {
    if (evt.dragging) return;
    var oe = evt.originalEvent;
    if (oe && oe.pointerType && oe.pointerType !== 'mouse') return;
    ult = evt.pixel;
    if (!pend) { pend = true; requestAnimationFrame(atualizarCursor); }
  });

  // ---- 4) O realce de hover do qgis2web (preenchimento branco + varredura de todas as camadas a cada movimento)
  //         é desligado no index.html, mas o qgis2web o religa ao passar o mouse sobre os botões: impede isso ----
  try { preDoHighlight = false; doHighlight = false; } catch (e) {}

  // (O clique nas quadras é tratado por custom/16-selecao-toque.js, que já desliga o tratador do qgis2web.
  //  Não mexer em 'singleclick' aqui: religar um tratador embrulhado impediria o 16 de removê-lo.)

  // ---- 5) Tela 3x: cada camada do mapa tem um canvas do tamanho da tela × ratio². Com ratio 3 são ~2,25x mais pixels (e memória)
  //         que com ratio 2, multiplicado pelo número de camadas ligadas. Limitar a 2 quase não muda a nitidez e alivia bastante ----
  try {
    var pr = map.pixelRatio_;
    if (PERF.pixelRatioMax && typeof pr === 'number' && pr > PERF.pixelRatioMax) {
      map.pixelRatio_ = PERF.pixelRatioMax;
      map.updateSize(); map.render();
    }
  } catch (e) {}
})();
