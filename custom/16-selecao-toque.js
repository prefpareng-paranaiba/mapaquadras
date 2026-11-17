// ================= SELEÇÃO NO CELULAR E NO COMPUTADOR: toque rápido, com folga no dedo e destaque imediato =================
// Problemas que isto resolve (só no toque; o mouse continua como antes):
//  1) O OpenLayers espera ~250 ms depois do toque para ter certeza de que não é duplo toque -> "demora para selecionar".
//  2) Com o dedo, qualquer tremida de 1-2 px é lida como arrasto e o toque é descartado -> "não reconhece que estou selecionando".
//  3) Tocar na rua, entre duas quadras, ou perto da linha não pegava nada -> agora pega a quadra mais próxima (até ~18 px).
//  4) Não havia retorno visual: agora a feição tocada ganha contorno laranja (igual ao do mouse) enquanto o balão está aberto.
//
// PRIORIDADE (várias camadas de polígonos sobrepostas): vale a MAIS ESPECÍFICA que estiver sob o clique:
//     1º área construída  ->  2º lote  ->  3º quadra
//  Camadas desligadas no painel (ou com opacidade 0) são ignoradas. Camada sem campos de balão também é ignorada
//  (o clique cai para a camada de baixo). As camadas são achadas pelo NOME da variável (lyr_...), então não importa
//  o número que o qgis2web põe no final (Quadras_1, Lotes_2, AConstruida_3...).
(function () {
  'use strict';

  var TOLERANCIA_PX = 18;      // folga do dedo para achar a quadra mais próxima
  var MOVIMENTO_MAX = 10;      // px: acima disso é arrasto (mover o mapa), não toque
  var DURACAO_MAX = 350;       // ms: acima disso é toque longo (ferramenta de coordenada), não toque
  var ultimoToque = { t: 0, x: 0, y: 0 };

  // ---------- ordem de prioridade (da mais específica para a mais ampla) ----------
  // re: trecho do nome da variável da camada (lyr_...). tolToque: folga do dedo em px (só no toque).
  var GRUPOS = [
    { re: /Constru/i, tolToque: 8 },               // construções são pequenas: um pouco de folga para o dedo
    { re: /Lotes/i,   tolToque: 0 },
    { re: /Quadras/i, tolToque: TOLERANCIA_PX }    // quadra: "a mais próxima" como era antes
  ];

  function temBalao(l) {
    var campos = l.get('fieldImages');
    if (!campos) return false;
    for (var k in campos) { if (campos[k] !== 'Hidden') return true; }
    return false;
  }
  function podeSelecionar(l) {
    return l.getVisible() && l.getOpacity() > 0 && l.get('interactive') !== false && temBalao(l);
  }

  // todas as camadas vetoriais do qgis2web (variáveis globais lyr_...), mais as que camadasDeQuadras() devolver
  function camadasVetoriais() {
    var lista = [];
    Object.keys(window).forEach(function (k) {
      if (k.indexOf('lyr_') !== 0) return;
      var l = window[k];
      if (!l || typeof l.getSource !== 'function' || typeof l.get !== 'function') return;
      var s = l.getSource();
      if (s && typeof s.forEachFeatureIntersectingExtent === 'function') lista.push({ nome: k, l: l });
    });
    try {
      if (typeof camadasDeQuadras === 'function') {
        camadasDeQuadras().forEach(function (l) {
          if (!lista.some(function (x) { return x.l === l; })) lista.push({ nome: 'lyr_Quadras', l: l });
        });
      }
    } catch (e) {}
    return lista;
  }

  // camadas selecionáveis agrupadas na ordem de prioridade
  function gruposPorPrioridade() {
    var todas = camadasVetoriais(), usadas = [];
    return GRUPOS.map(function (g) {
      var cams = [];
      todas.forEach(function (x) {
        if (usadas.indexOf(x.l) >= 0 || !g.re.test(x.nome) || !podeSelecionar(x.l)) return;
        cams.push(x.l); usadas.push(x.l);
      });
      return { tolToque: g.tolToque, camadas: cams };
    });
  }

  // lista plana (construção, lote, quadra): usada também pelo destaque ao passar o mouse (07-hover-quadra.js)
  window.camadasSelecionaveisPrioridade = function () {
    var r = [];
    gruposPorPrioridade().forEach(function (g) { g.camadas.forEach(function (l) { r.push(l); }); });
    return r;
  };

  // feição sob o ponto, respeitando a prioridade; no toque, cada camada tem a sua folga de dedo
  function acharQuadra(coord, ehToque) {
    var res = map.getView().getResolution() || 1;
    var grupos = gruposPorPrioridade();
    for (var i = 0; i < grupos.length; i++) {
      var folga = (ehToque ? grupos[i].tolToque : 0) * res;
      var ext = ol.extent.buffer([coord[0], coord[1], coord[0], coord[1]], folga);
      var dentro = null, dentroLayer = null, melhor = null, melhorLayer = null, dMin = Infinity;
      grupos[i].camadas.forEach(function (l) {
        l.getSource().forEachFeatureIntersectingExtent(ext, function (f) {
          if (dentro) return true;
          var g = f.getGeometry(); if (!g) return;
          if (g.intersectsCoordinate(coord)) { dentro = f; dentroLayer = l; return true; }
          var c = g.getClosestPoint(coord), d = Math.hypot(c[0] - coord[0], c[1] - coord[1]);
          if (d < dMin) { dMin = d; melhor = f; melhorLayer = l; }
        });
      });
      if (dentro) return { f: dentro, l: dentroLayer, fora: false };
      if (melhor && dMin <= folga) return { f: melhor, l: melhorLayer, fora: true };
    }
    return null;
  }

  // ---------- destaque da feição selecionada (contorno laranja, sem preencher) ----------
  var fonteSel = new ol.source.Vector();
  map.addLayer(new ol.layer.Vector({
    source: fonteSel, zIndex: 9995, interactive: false,
    style: [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ffffff', width: 7 }) }),
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ff9800', width: 3.5 }) })
    ]
  }));
  function destacar(f) {
    fonteSel.clear();
    if (f) fonteSel.addFeature(new ol.Feature(f.getGeometry().clone()));
  }
  // quando o balão fecha (X, outro toque no vazio, medição...), o destaque some
  try {
    overlayPopup.on('change:position', function () { if (!overlayPopup.getPosition()) destacar(null); });
  } catch (e) {}

  // ---------- abre o balão da feição (mesmo conteúdo que o qgis2web montava) ----------
  function abrirBalao(achado, coord) {
    var l = achado.l, f = achado.f;
    var campos = l.get('fieldImages') || {}, temCampo = false;
    for (var k in campos) { if (campos[k] !== 'Hidden') temCampo = true; }
    if (!temCampo) { popupContent = ''; popupCoord = coord; updatePopup(); return; }
    popupContent = '<ul><li><table><a><b>' + l.get('popuplayertitle') + '</b></a>' +
      createPopupField(f, f.getKeys(), l) + '</table></li></ul>';
    popupCoord = coord;
    updatePopup();
  }

  // onde ancorar o balão: no próprio toque; se o dedo pegou a feição "por perto", dentro dela
  function pontoAncora(achado, coord) {
    if (!achado.fora) return coord;
    try {
      var g = achado.f.getGeometry();
      var p = g.getType() === 'MultiPolygon' ? g.getInteriorPoints().getCoordinates()[0] : g.getInteriorPoint().getCoordinates();
      return [p[0], p[1]];
    } catch (e) { return coord; }
  }

  function selecionarEm(pixel, ehToque) {
    if (doHover || sketch || window.medindo) return;
    var coord = map.getCoordinateFromPixel(pixel);
    if (!coord) return;
    var achado = acharQuadra(coord, ehToque);
    if (!achado) {
      destacar(null);
      popupContent = ''; popupCoord = coord; updatePopup();      // toque no vazio fecha o balão, como antes
      return;
    }
    destacar(achado.f);
    abrirBalao(achado, pontoAncora(achado, coord));
  }

  // ---------- substitui o tratador antigo do qgis2web ----------
  try { map.un('singleclick', onSingleClickFeatures); } catch (e) {}
  map.on('singleclick', function (e) {
    var oe = e.originalEvent || {};
    var toque = oe.pointerType === 'touch' || oe.pointerType === 'pen';
    // toque já tratado instantaneamente pelo detector abaixo: não repete
    if (toque && Math.abs(Date.now() - ultimoToque.t) < 900 &&
        Math.hypot(e.pixel[0] - ultimoToque.x, e.pixel[1] - ultimoToque.y) < 30) return;
    selecionarEm(e.pixel, toque);
  });

  // ---------- detector de toque instantâneo (não espera duplo toque, aceita tremida do dedo) ----------
  var vp = map.getViewport();
  var dedos = {}, cancelado = false, ini = null;
  vp.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    var agora = Date.now();
    for (var id in dedos) { if (agora - dedos[id] > 4000) delete dedos[id]; }   // pointerup perdido não pode deixar o toque travado
    dedos[e.pointerId] = agora;
    if (Object.keys(dedos).length > 1) { cancelado = true; ini = null; return; }   // dois dedos = zoom/giro
    cancelado = false;
    ini = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
  }, true);
  vp.addEventListener('pointermove', function (e) {
    if (!ini || e.pointerId !== ini.id) return;
    if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > MOVIMENTO_MAX) ini = null;
  }, true);
  function fim(e) {
    delete dedos[e.pointerId];
    if (e.pointerType === 'mouse' || !ini || e.pointerId !== ini.id) return;
    var i = ini; ini = null;
    if (cancelado || e.type === 'pointercancel') return;
    if (Date.now() - i.t > DURACAO_MAX) return;                                    // toque longo: fica com a ferramenta de coordenada
    var alvo = e.target;
    if (!alvo || alvo.tagName !== 'CANVAS') return;                                // ignora botões, balão e painéis
    var pixel = map.getEventPixel(e);
    ultimoToque = { t: Date.now(), x: pixel[0], y: pixel[1] };
    selecionarEm(pixel, true);
  }
  vp.addEventListener('pointerup', fim, true);
  vp.addEventListener('pointercancel', fim, true);
})();
