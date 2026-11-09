// =====================================================================================
// perf.js — ajustes de DESEMPENHO (principalmente celular). Carregar DEPOIS de qgis2web.js.
// Fica separado dos arquivos gerados pelo qgis2web: reexportar o projeto não apaga estes ajustes.
// =====================================================================================
(function () {
  'use strict';

  var PERF = {
    rotulosZoomMin: 16,       // número das quadras só aparece a partir deste zoom (abaixo, 1.458 textos sobrepostos pesam muito)
    googleMaxZoom: 21         // o Google não tem tiles além disso; sem limite o mapa pede z22+ e recebe erro
  };

  // ---- 1) Estilo das quadras: objetos criados UMA vez (o original recriava 1.458 estilos + textos a cada quadro) ----
  var lyrQ = window.lyr_QuadrasNOVOquadras_v515b_1;
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
    window.lyr_GoogleHybrid_0.setSource(new ol.source.XYZ({
      attributions: ' ',
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      maxZoom: PERF.googleMaxZoom,
      transition: 0
    }));
  }

  // ---- 3) Cursor "mão" ao passar o mouse: 1 consulta por quadro e só com mouse (no toque não existe hover) ----
  try { map.un('pointermove', pointerOnFeature); } catch (e) {}
  var pend = false, ult = null;
  function atualizarCursor() {
    pend = false;
    if (!ult) return;
    var tem = map.hasFeatureAtPixel(ult, { layerFilter: function (l) { return l && l.get('interactive'); } });
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
})();
