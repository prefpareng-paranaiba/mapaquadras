// ================= PAINEL DE CAMADAS + MINHAS MARCAÇÕES (salvas no próprio aparelho) =================
// - botão 🗂 (abaixo do zoom): liga/desliga camadas e ajusta a transparência (mosaico, nomes de ruas, quadras...)
//   Camadas novas exportadas pelo qgis2web aparecem sozinhas (qualquer camada com "title").
// - botão ✏️: desenha ponto, linha e polígono; dá nome, cor e descrição; edita a forma; mede; exporta/importa.
// - TUDO é salvo só neste aparelho (localStorage do navegador). Cada pessoa vê apenas as suas marcações.
//   Para levar para outro aparelho ou guardar com segurança: Exportar (GeoJSON ou KML) e Importar.
(function () {
  'use strict';

  var CH_MARC = 'mq.marcacoes.v1';
  var CH_CAM = 'mq.camadas.v1';
  var CH_COR = 'mq.cor.v1';
  var CH_PASTA = 'mq.pastas.v1';
  var CORES = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#ffffff'];
  var MAX_IMPORT_AVISO = 2000;

  // ---------- armazenamento (tudo em try/catch: modo privado, cache limpo, espaço cheio) ----------
  function lerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  // ---------- util ----------
  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k.indexOf('on') === 0) e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function hexRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(229,57,53,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function novoId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmtDist(m) {
    return m < 1000 ? m.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m'
      : (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' km';
  }
  function fmtArea(m2) {
    var s = m2.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m²';
    if (m2 >= 10000) s += ' (' + (m2 / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' ha)';
    return s;
  }
  var toastEl = null, toastT = null;
  function aviso(msg) {
    if (!toastEl) {
      toastEl = el('div', { style: 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:10100;background:rgba(30,30,30,.92);color:#fff;' +
        'padding:9px 14px;border-radius:8px;font:14px/1.3 Arial,sans-serif;max-width:88vw;text-align:center;display:none;box-shadow:0 2px 8px rgba(0,0,0,.4)' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.display = 'none'; }, 3500);
  }

  // ---------- camada das marcações ----------
  var fonte = new ol.source.Vector();
  var selecionada = null;
  var fmtJson = new ol.format.GeoJSON();

  function pontoRotulo(g) {
    var t = g.getType();
    if (t === 'Point') return g;
    if (t === 'Polygon') return g.getInteriorPoint();
    if (t === 'LineString') return new ol.geom.Point(g.getCoordinateAt(0.5));
    return new ol.geom.Point(ol.extent.getCenter(g.getExtent()));
  }
  function estilo(f, res) {
    if (f.get('visible') === false) return null;
    var g = f.getGeometry(); if (!g) return null;
    var cor = f.get('color') || '#e53935', t = g.getType(), sel = f === selecionada, out = [];
    var halo = new ol.style.Stroke({ color: sel ? '#ffeb3b' : '#ffffff', width: sel ? 9 : 6, lineCap: 'round', lineJoin: 'round' });
    var traco = new ol.style.Stroke({ color: cor, width: 3, lineCap: 'round', lineJoin: 'round' });
    if (t === 'Point' || t === 'MultiPoint') {
      out.push(new ol.style.Style({ image: new ol.style.Circle({
        radius: sel ? 12 : 9, fill: new ol.style.Fill({ color: cor }),
        stroke: new ol.style.Stroke({ color: sel ? '#ffeb3b' : '#ffffff', width: 3 }) }) }));
    } else if (t === 'Polygon' || t === 'MultiPolygon') {
      out.push(new ol.style.Style({ stroke: halo }));
      out.push(new ol.style.Style({ stroke: traco, fill: new ol.style.Fill({ color: hexRgba(cor, 0.22) }) }));
    } else {
      out.push(new ol.style.Style({ stroke: halo }));
      out.push(new ol.style.Style({ stroke: traco }));
    }
    var nome = f.get('name');
    if (nome && res < 6) {
      out.push(new ol.style.Style({
        geometry: pontoRotulo(g),
        text: new ol.style.Text({
          text: String(nome), font: 'bold 13px Arial, sans-serif', overflow: true,
          offsetY: (t === 'Point' ? -18 : 0),
          fill: new ol.style.Fill({ color: '#1a1a1a' }), stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 })
        })
      }));
    }
    return out;
  }
  var camada = new ol.layer.Vector({ source: fonte, style: estilo, zIndex: 9990 });
  camada.set('interactive', false);        // o balão do qgis2web ignora esta camada
  map.addLayer(camada);

  // ---------- salvar / carregar ----------
  var saveT = null, alertouArmaz = false;
  function salvar() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var txt = fmtJson.writeFeatures(fonte.getFeatures(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      if (!gravarLS(CH_MARC, txt)) {
        if (!alertouArmaz) { alertouArmaz = true; aviso('⚠ Não foi possível salvar neste navegador (modo privado ou sem espaço). Use Exportar para não perder.'); }
        mostrarBannerArmaz(true);
      } else {
        mostrarBannerArmaz(false);
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      }
    }, 300);
  }
  function carregar() {
    var txt = lerLS(CH_MARC); if (!txt) return;
    try {
      var fs = fmtJson.readFeatures(txt, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      fs.forEach(function (f) { if (!f.getId()) f.setId(novoId()); });
      fonte.addFeatures(fs);
    } catch (e) { console.warn('Marcações salvas ilegíveis:', e); }
  }
  carregar();
  fonte.on('changefeature', salvar);
  fonte.on('addfeature', salvar);
  fonte.on('removefeature', salvar);

  // teste de gravação (para avisar cedo se o navegador não deixa salvar)
  var armazenamentoOk = gravarLS('mq.teste', '1');

  // ---------- estado das camadas do mapa (visibilidade e transparência) ----------
  function camadasListaveis() {
    var r = [];
    (function v(ls) {
      ls.forEach(function (l) {
        if (l.getLayers) { v(l.getLayers().getArray()); return; }
        if (l === camada) return;
        var t = l.get('title');
        if (!t || l.get('displayInLayerSwitcher') === false) return;
        r.push(l);
      });
    })(map.getLayers().getArray());
    r.sort(function (a, b) { return (b.getZIndex() || -1) - (a.getZIndex() || -1); });
    return r;
  }
  function nomeCamada(l) { return String(l.get('title')).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  var pastasAberta = {};
  try { pastasAberta = JSON.parse(lerLS(CH_PASTA) || '{}') || {}; } catch (e) { pastasAberta = {}; }
  var estadoCam = {};
  try { estadoCam = JSON.parse(lerLS(CH_CAM) || '{}') || {}; } catch (e) { estadoCam = {}; }
  function salvarCam() { gravarLS(CH_CAM, JSON.stringify(estadoCam)); }
  function aplicarEstadoCam() {
    camadasListaveis().forEach(function (l) {
      var s = estadoCam[nomeCamada(l)]; if (!s) return;
      if (typeof s.v === 'boolean') l.setVisible(s.v);
      if (typeof s.o === 'number') l.setOpacity(s.o);
    });
  }
  var padraoCam = {};
  camadasListaveis().forEach(function (l) { padraoCam[nomeCamada(l)] = { v: l.getVisible(), o: l.getOpacity() }; });
  aplicarEstadoCam();

  // ---------- visual ----------
  var css = el('style', { text:
    '#mqBotoes{position:fixed;left:8px;z-index:10001;display:flex;flex-direction:column;gap:8px}' +
    '#mqBotoes button{width:38px;height:40px;border:0;border-radius:10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.35);font-size:19px;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;transition:background .15s,box-shadow .15s}' +
    '#mqBotoes button:active{transform:scale(.94)}' +
    '#mqBotoes button.on{background:#e3efff;box-shadow:0 0 0 2px #1565c0,0 1px 6px rgba(0,0,0,.35)}' +
    '#mqPainel{position:fixed;z-index:10002;background:#fff;color:#222;font:14px/1.35 Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);display:none;flex-direction:column;' +
      'left:58px;top:118px;width:360px;max-height:calc(100vh - 140px);border-radius:14px;overflow:hidden}' +
    '#mqPainel .mq-grab{display:none;height:22px;align-items:center;justify-content:center;cursor:pointer;touch-action:none}' +
    '#mqPainel .mq-grab i{display:block;width:40px;height:5px;border-radius:3px;background:#c9ced6}' +
    '@media (max-width:640px){#mqPainel{left:0;right:0;top:auto;bottom:0;width:auto;max-height:56vh;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}' +
      '#mqPainel .mq-grab{display:flex}}' +
    '#mqPainel .mq-cab{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px;border-bottom:1px solid #e6e9ee;background:#fff}' +
    '#mqPainel .mq-seg{flex:1;display:flex;background:#eef1f5;border-radius:10px;padding:3px;gap:3px}' +
    '#mqPainel .mq-aba{flex:1;padding:9px 6px;text-align:center;border:0;border-radius:8px;background:none;font:inherit;font-weight:bold;color:#5b6573;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '#mqPainel .mq-aba.on{background:#fff;color:#1565c0;box-shadow:0 1px 3px rgba(0,0,0,.18)}' +
    '#mqPainel .mq-x{width:40px;height:40px;border:0;border-radius:10px;background:#eef1f5;font-size:22px;line-height:1;color:#5b6573;cursor:pointer}' +
    '#mqPainel .mq-corpo{overflow:auto;padding:12px 12px 16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
    '#mqPainel .mq-lin{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eee}' +
    '#mqPainel .mq-lin label{flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}' +
    '#mqPainel .mq-lin input[type=checkbox]{width:20px;height:20px;flex:none}' +
    '#mqPainel .mq-nome{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#mqPainel .mq-cam{border:1px solid #e3e7ed;border-radius:12px;padding:7px 12px 6px;margin-bottom:7px;background:#fff;transition:background .15s,border-color .15s}' +
    '#mqPainel .mq-cam.on{background:#f4f8ff;border-color:#bcd3f5}' +
    '#mqPainel .mq-cam-topo{display:flex;align-items:center;gap:10px;min-height:32px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '#mqPainel .mq-cam-ic{width:28px;height:28px;border-radius:8px;background:#eef1f5;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none}' +
    '#mqPainel .mq-cam.on .mq-cam-ic{background:#dbe8fb}' +
    '#mqPainel .mq-cam-nome{flex:1;min-width:0;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#mqPainel .mq-cam-nome img{height:14px;vertical-align:-2px;margin-right:4px}' +
    '#mqPainel .mq-sw{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:46px;height:28px;border-radius:14px;background:#c3c9d2;border:0;margin:0;cursor:pointer;transition:background .18s;outline-offset:2px}' +
    '#mqPainel .mq-sw::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .18s}' +
    '#mqPainel .mq-sw:checked{background:#1565c0}' +
    '#mqPainel .mq-sw:checked::after{transform:translateX(18px)}' +
    '#mqPainel .mq-opac{display:flex;align-items:center;gap:10px;margin-top:0;color:#5b6573;font-size:12px}' +
    '#mqPainel .mq-cam:not(.on) .mq-opac{opacity:.4}' +
    '#mqPainel .mq-opac input[type=range]{flex:1;min-width:0;height:26px;margin:0;accent-color:#1565c0}' +
    '#mqPainel .mq-opac b{width:38px;text-align:right;font-variant-numeric:tabular-nums;color:#333}' +
    '#mqPainel input[type=range]{width:90px;flex:none}' +
    '#mqPainel .mq-btn{border:1px solid #bbb;background:#fafafa;border-radius:6px;padding:8px 10px;font:inherit;cursor:pointer}' +
    '#mqPainel .mq-btn.pri{background:#1565c0;border-color:#1565c0;color:#fff}' +
    '#mqPainel .mq-btn.per{color:#c62828;border-color:#e0a0a0}' +
    '#mqPainel .mq-grade{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}' +
    '#mqPainel .mq-peq{color:#666;font-size:12px}' +
    '#mqPainel .mq-item{border-bottom:1px solid #eee;padding:8px 0}' +
    '#mqPainel .mq-item.sel{background:#fff8dc;margin:0 -12px;padding:8px 12px}' +
    '#mqPainel .mq-topo{display:flex;align-items:center;gap:8px}' +
    '#mqPainel .mq-ic{border:0;background:none;font-size:18px;cursor:pointer;padding:4px 6px}' +
    '#mqPainel input[type=text],#mqPainel textarea{width:100%;box-sizing:border-box;border:1px solid #bbb;border-radius:6px;padding:8px;font:inherit;margin:3px 0}' +
    '#mqPainel .mq-cor{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #999;cursor:pointer;padding:0}' +
    '#mqPainel .mq-cor.on{box-shadow:0 0 0 3px #1565c0}' +
    '#mqBarra{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:18px;z-index:10003;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.5);' +
      'padding:10px 12px;display:none;font:14px/1.3 Arial,sans-serif;max-width:94vw;box-sizing:border-box;text-align:center}' +
    '#mqBarra .mq-btn{border:1px solid #bbb;background:#fafafa;border-radius:8px;padding:10px 10px;white-space:nowrap;font:inherit;cursor:pointer;margin:4px 3px 0}' +
    '#mqBarra .mq-btn.pri{background:#1565c0;border-color:#1565c0;color:#fff}' +
    '#mqPainel .mq-sw:indeterminate{background:#7aa7de}' +
    '#mqPainel .mq-sw:indeterminate::after{transform:translateX(9px)}' +
    '#mqPainel .mq-pasta{margin-bottom:10px}' +
    '#mqPainel .mq-pasta-cab{display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 4px 4px 2px;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #e3e7ed}' +
    '#mqPainel .mq-seta{width:18px;flex:none;text-align:center;color:#5b6573;font-size:13px}' +
    '#mqPainel .mq-pasta-ic{font-size:20px;flex:none}' +
    '#mqPainel .mq-pasta-nome{flex:1;min-width:0;font-weight:bold;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#mqPainel .mq-cont{flex:none;font-size:12px;color:#5b6573;background:#eef1f5;border-radius:10px;padding:2px 8px;font-variant-numeric:tabular-nums}' +
    '#mqPainel .mq-pasta-corpo{margin:8px 0 0 9px;padding-left:8px;border-left:2px solid #dbe3ef}' +
    '.desenhando .ol-popup{display:none !important}' +
    '.desenhando #map, .desenhando #map .ol-viewport{cursor:crosshair !important}'
  });
  document.head.appendChild(css);

  // ---------- botões flutuantes (abaixo do zoom) ----------
  var botoes = el('div', { id: 'mqBotoes' });
  var btnCam = el('button', { title: 'Camadas', text: '🗂' });
  var btnMarc = el('button', { title: 'Minhas marcações', text: '✏️' });
  botoes.appendChild(btnCam); botoes.appendChild(btnMarc);
  document.body.appendChild(botoes);
  function posicionarBotoes() {
    var z = document.getElementById('ctlZoom');
    var base = z ? z.getBoundingClientRect().bottom : 108;
    botoes.style.top = Math.round(base + 8) + 'px';
    painel.style.top = '';   // no desktop o painel acompanha os botões
    if (window.innerWidth > 640) painel.style.top = Math.round(base + 8) + 'px';
  }

  // ---------- painel ----------
  var painel = el('div', { id: 'mqPainel', style: 'display:none' });
  var abaCam = el('button', { class: 'mq-aba', text: 'Camadas' });
  var abaMarc = el('button', { class: 'mq-aba', text: 'Marcações' });
  var fechar = el('button', { class: 'mq-x', text: '×', title: 'Fechar' });
  var seg = el('div', { class: 'mq-seg' }, [abaCam, abaMarc]);
  var cab = el('div', { class: 'mq-cab' }, [seg, fechar]);
  var corpo = el('div', { class: 'mq-corpo' });
  var alca = el('div', { class: 'mq-grab', title: 'Arraste para baixo para fechar' }, [el('i')]);   // só no celular
  var alcaY = null;
  alca.addEventListener('pointerdown', function (e) { alcaY = e.clientY; try { alca.setPointerCapture(e.pointerId); } catch (x) {} });
  alca.addEventListener('pointerup', function (e) { if (alcaY !== null && (e.clientY - alcaY > 30 || Math.abs(e.clientY - alcaY) < 6)) fecharPainel(); alcaY = null; });
  painel.appendChild(alca); painel.appendChild(cab); painel.appendChild(corpo);
  document.body.appendChild(painel);

  var aba = 'cam', expandido = null;
  function abrir(qual) {
    aba = qual || aba;
    painel.style.display = 'flex';
    abaCam.className = 'mq-aba' + (aba === 'cam' ? ' on' : '');
    abaMarc.className = 'mq-aba' + (aba === 'marc' ? ' on' : '');
    btnCam.className = aba === 'cam' ? 'on' : '';
    btnMarc.className = aba === 'marc' ? 'on' : '';
    posicionarBotoes();
    render();
  }
  function fecharPainel() { painel.style.display = 'none'; btnCam.className = ''; btnMarc.className = ''; }
  function painelAberto() { return painel.style.display !== 'none'; }
  btnCam.onclick = function () { (painelAberto() && aba === 'cam') ? fecharPainel() : abrir('cam'); };
  btnMarc.onclick = function () { (painelAberto() && aba === 'marc') ? fecharPainel() : abrir('marc'); };
  abaCam.onclick = function () { abrir('cam'); };
  abaMarc.onclick = function () { abrir('marc'); };
  fechar.onclick = fecharPainel;
  window.addEventListener('resize', posicionarBotoes);
  if (window.ResizeObserver && document.getElementById('ctlZoom')) new ResizeObserver(posicionarBotoes).observe(document.getElementById('ctlZoom'));
  posicionarBotoes();

  function render() {
    if (!painelAberto()) return;
    var topo = corpo.scrollTop;
    corpo.textContent = '';
    if (aba === 'cam') renderCamadas(); else renderMarcacoes();
    corpo.scrollTop = topo;
  }

  // ---- aba Camadas ----
  function iconeCamada(n) {
    n = n.toLowerCase();
    if (/google|sat[eé]lite|h[ií]brid/.test(n)) return '🌐';
    if (/rua|logradouro/.test(n)) return '🏷';
    if (/quadra/.test(n)) return '▦';
    return '🖼';
  }
  function renderCamadas() {
    var ls = camadasListaveis();
    if (!ls.length) corpo.appendChild(el('div', { class: 'mq-peq', text: 'Nenhuma camada encontrada.' }));

    function cartao(titulo, icone, visivel, opac, aoLigar, aoOpac, htmlTitulo) {
      var sw = el('input', { type: 'checkbox', class: 'mq-sw', 'aria-label': titulo }); sw.checked = visivel;
      var nomeEl = el('span', { class: 'mq-cam-nome' });
      if (htmlTitulo) nomeEl.innerHTML = htmlTitulo; else nomeEl.textContent = titulo;
      var topo = el('div', { class: 'mq-cam-topo' }, [el('span', { class: 'mq-cam-ic', text: icone }), nomeEl, sw]);
      var card = el('div', { class: 'mq-cam' + (visivel ? ' on' : '') }, [topo]);
      var pct = null, rg = null;
      if (aoOpac) {
        rg = el('input', { type: 'range', min: '0', max: '100', title: 'Transparência', 'aria-label': 'Opacidade de ' + titulo });
        rg.value = String(Math.round(opac * 100));
        pct = el('b', { text: rg.value + '%' });
        rg.oninput = function () { pct.textContent = rg.value + '%'; aoOpac(rg.value / 100); };
        card.appendChild(el('div', { class: 'mq-opac' }, [el('span', { text: 'Opacidade' }), rg, pct]));
      }
      sw.onchange = function () { card.classList.toggle('on', sw.checked); aoLigar(sw.checked); };
      topo.onclick = function (e) { if (e.target !== sw) { sw.checked = !sw.checked; sw.onchange(); } };   // a linha inteira liga/desliga (alvo grande no celular)
      return card;
    }

    // ---- pastas estilo Google Earth ----
    function ehMosaico(l) {
      var g = l.get('pasta');                       // opcional: l.set('pasta','mosaicos'|'poligonos') força a pasta
      if (g === 'mosaicos') return true;
      if (g === 'poligonos') return false;
      return (ol.layer.Tile && l instanceof ol.layer.Tile) ||
             (ol.layer.Image && l instanceof ol.layer.Image) ||
             (ol.layer.WebGLTile && l instanceof ol.layer.WebGLTile);
    }
    function ligarCamada(l, v) {
      var n = nomeCamada(l);
      l.setVisible(v); (estadoCam[n] = estadoCam[n] || {}).v = v;
    }
    function pasta(id, titulo, icone, contagem, ligada, parcial, aoMestre, filhos) {
      var aberta = pastasAberta[id] !== false;      // padrão: aberta
      var mestre = el('input', { type: 'checkbox', class: 'mq-sw', 'aria-label': 'Ligar ou desligar tudo em ' + titulo, title: 'Ligar/desligar tudo desta pasta' });
      mestre.checked = ligada; mestre.indeterminate = parcial;
      mestre.onchange = function () { aoMestre(mestre.checked); render(); };
      mestre.onclick = function (e) { e.stopPropagation(); };
      var cab = el('div', { class: 'mq-pasta-cab' }, [
        el('span', { class: 'mq-seta', text: aberta ? '▼' : '▶' }),
        el('span', { class: 'mq-pasta-ic', text: icone }),
        el('span', { class: 'mq-pasta-nome', text: titulo }),
        el('span', { class: 'mq-cont', text: contagem }),
        mestre
      ]);
      cab.onclick = function () { pastasAberta[id] = !aberta; gravarLS(CH_PASTA, JSON.stringify(pastasAberta)); render(); };
      var box = el('div', { class: 'mq-pasta' }, [cab]);
      if (aberta) {
        var c = el('div', { class: 'mq-pasta-corpo' });
        if (filhos.length) filhos.forEach(function (x) { c.appendChild(x); });
        else c.appendChild(el('div', { class: 'mq-peq', style: 'padding:4px 0 8px', text: 'Nada nesta pasta.' }));
        box.appendChild(c);
      }
      return box;
    }
    function pastaDeCamadas(id, titulo, icone, lista) {
      var ativos = lista.filter(function (l) { return l.getVisible(); }).length;
      var cards = lista.map(function (l) {
        var nome = nomeCamada(l);
        return cartao(nome, iconeCamada(nome), l.getVisible(), l.getOpacity(),
          function (v) { ligarCamada(l, v); salvarCam(); render(); },
          function (o) { l.setOpacity(o); (estadoCam[nome] = estadoCam[nome] || {}).o = o; salvarCam(); });
      });
      return pasta(id, titulo, icone, ativos + '/' + lista.length, ativos > 0, ativos > 0 && ativos < lista.length,
        function (v) { lista.forEach(function (l) { ligarCamada(l, v); }); salvarCam(); }, cards);
    }

    var mosaicos = ls.filter(ehMosaico), poligonos = ls.filter(function (l) { return !ehMosaico(l); });
    corpo.appendChild(pastaDeCamadas('poligonos', 'Polígonos', '⬠', poligonos));
    corpo.appendChild(pastaDeCamadas('mosaicos', 'Mosaicos', '🖼', mosaicos));

    // pasta Marcações: cada marcação do usuário com seu próprio liga/desliga
    var fsm = fonte.getFeatures(), camOn = camada.getVisible();
    var visM = camOn ? fsm.filter(function (f) { return f.get('visible') !== false; }).length : 0;
    var linhasM = fsm.slice().reverse().map(function (f) {
      var cb = el('input', { type: 'checkbox', title: 'Mostrar/ocultar' });
      cb.checked = camada.getVisible() && f.get('visible') !== false;
      cb.onchange = function () {
        if (cb.checked && !camada.getVisible()) camada.setVisible(true);
        f.set('visible', cb.checked); render();
      };
      var nm = el('span', { class: 'mq-nome', text: f.get('name') || '(sem nome)', style: 'cursor:pointer' });
      nm.onclick = function () { irPara(f); };
      return el('div', { class: 'mq-lin' }, [
        cb, el('span', { style: 'width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 1px #888;background:' + (f.get('color') || '#e53935') }),
        el('label', { style: 'flex:1;min-width:0' }, [nm])
      ]);
    });
    var ligadaM = fsm.length ? visM > 0 : camOn;
    corpo.appendChild(pasta('marcacoes', 'Minhas marcações', '✏️', fsm.length ? visM + '/' + fsm.length : '0',
      ligadaM, fsm.length > 0 && visM > 0 && visM < fsm.length,
      function (v) { camada.setVisible(v); fsm.forEach(function (f) { f.set('visible', v); }); }, linhasM));

    var rest = el('button', { class: 'mq-btn', style: 'width:100%;margin-top:4px', text: '↺ Restaurar camadas ao padrão', onclick: function () {
      camadasListaveis().forEach(function (l) {
        var d = padraoCam[nomeCamada(l)]; if (!d) return;
        l.setVisible(d.v); l.setOpacity(d.o);
      });
      estadoCam = {}; salvarCam(); render();
    } });
    corpo.appendChild(rest);
    corpo.appendChild(el('div', { class: 'mq-peq', style: 'margin-top:10px;text-align:center', text: 'Toque na linha para ligar ou desligar. Suas escolhas ficam salvas neste aparelho.' }));
  }

  // ---- aba Marcações ----
  function tipoNome(g) {
    var t = g.getType();
    return t === 'Point' ? 'Ponto' : (t === 'LineString' ? 'Linha' : (t === 'Polygon' ? 'Polígono' : t));
  }
  function medida(f) {
    var g = f.getGeometry(); if (!g) return '';
    var t = g.getType(), o = { projection: 'EPSG:3857' };
    try {
      if (t === 'Point') { var c = ol.proj.toLonLat(g.getCoordinates()); return 'Ponto · ' + c[1].toFixed(6) + ', ' + c[0].toFixed(6); }
      if (t === 'LineString' || t === 'MultiLineString') return 'Linha · ' + fmtDist(ol.sphere.getLength(g, o));
      if (t === 'Polygon' || t === 'MultiPolygon') return 'Polígono · ' + fmtArea(ol.sphere.getArea(g, o));
    } catch (e) {}
    return tipoNome(g);
  }
  function renderMarcacoes() {
    if (!armazenamentoOk) corpo.appendChild(el('div', { style: 'background:#fff3cd;border:1px solid #e0c36a;border-radius:6px;padding:8px;margin-bottom:8px', text: '⚠ Este navegador não permite salvar. Suas marcações só duram enquanto a página estiver aberta; use Exportar.' }));
    corpo.appendChild(el('div', { id: 'mqBannerArmaz', style: 'display:none;background:#fff3cd;border:1px solid #e0c36a;border-radius:6px;padding:8px;margin-bottom:8px', text: '⚠ Não foi possível salvar a última alteração (sem espaço ou modo privado). Use Exportar.' }));
    var g = el('div', { class: 'mq-grade' }, [
      el('button', { class: 'mq-btn pri', text: '📍 Ponto', onclick: function () { iniciarDesenho('Point'); } }),
      el('button', { class: 'mq-btn pri', text: '〰 Linha', onclick: function () { iniciarDesenho('LineString'); } }),
      el('button', { class: 'mq-btn pri', text: '⬠ Polígono', onclick: function () { iniciarDesenho('Polygon'); } })
    ]);
    corpo.appendChild(g);
    var fs = fonte.getFeatures();
    if (!fs.length) {
      corpo.appendChild(el('div', { class: 'mq-peq', style: 'margin:8px 0', text: 'Nenhuma marcação ainda. Escolha acima o que quer desenhar. As marcações ficam salvas apenas neste aparelho.' }));
    }
    fs.slice().reverse().forEach(function (f) { corpo.appendChild(itemMarcacao(f)); });

    var rod = el('div', { class: 'mq-grade', style: 'margin-top:12px' }, [
      el('button', { class: 'mq-btn', text: '⬇ GeoJSON', title: 'Exporta para o QGIS', onclick: function () { exportar('geojson'); } }),
      el('button', { class: 'mq-btn', text: '⬇ KML', title: 'Exporta para o Google Earth', onclick: function () { exportar('kml'); } }),
      el('button', { class: 'mq-btn', text: '⬆ Importar', onclick: function () { arquivoImport.click(); } }),
      fs.length ? el('button', { class: 'mq-btn per', text: '🗑 Apagar tudo', onclick: apagarTudo }) : null
    ]);
    corpo.appendChild(rod);
  }
  function mostrarBannerArmaz(sim) { var b = document.getElementById('mqBannerArmaz'); if (b) b.style.display = sim ? 'block' : 'none'; }

  function itemMarcacao(f) {
    var id = f.getId(), aberto = expandido === id, cor = f.get('color') || '#e53935';
    var cb = el('input', { type: 'checkbox', title: 'Mostrar/ocultar' }); cb.checked = f.get('visible') !== false;
    cb.onchange = function () { f.set('visible', cb.checked); };
    var nomeEl = el('span', { class: 'mq-nome', text: f.get('name') || '(sem nome)', style: 'font-weight:bold' });
    var topo = el('div', { class: 'mq-topo' }, [
      cb, el('span', { style: 'width:14px;height:14px;border-radius:50%;flex:none;box-shadow:0 0 0 1px #888;background:' + cor }),
      el('label', { style: 'flex:1;min-width:0;cursor:pointer' }, [nomeEl]),
      el('button', { class: 'mq-ic', title: 'Ir para', text: '🎯', onclick: function () { irPara(f); } }),
      el('button', { class: 'mq-ic', title: 'Editar', text: aberto ? '▾' : '✏️', onclick: function () { expandido = aberto ? null : id; selecionar(aberto ? null : f); render(); } })
    ]);
    nomeEl.parentNode.onclick = function () { irPara(f); selecionar(f); };
    var it = el('div', { class: 'mq-item' + (f === selecionada ? ' sel' : '') }, [topo, el('div', { class: 'mq-peq', style: 'margin-left:30px', text: medida(f) })]);
    var desc = f.get('description');
    if (desc && !aberto) it.appendChild(el('div', { class: 'mq-peq', style: 'margin:2px 0 0 30px;color:#444', text: desc }));
    if (aberto) it.appendChild(formEdicao(f, nomeEl));
    return it;
  }
  function formEdicao(f, nomeEl) {
    var nome = el('input', { type: 'text', placeholder: 'Nome', maxlength: '80' }); nome.value = f.get('name') || '';
    nome.oninput = function () { f.set('name', nome.value); nomeEl.textContent = nome.value || '(sem nome)'; };
    var desc = el('textarea', { rows: '3', placeholder: 'Descrição / observações' }); desc.value = f.get('description') || '';
    desc.oninput = function () { f.set('description', desc.value); };
    var cores = el('div', { class: 'mq-grade' });
    CORES.forEach(function (c) {
      var b = el('button', { class: 'mq-cor' + ((f.get('color') || '') === c ? ' on' : ''), title: c, style: 'background:' + c });
      b.onclick = function () { f.set('color', c); gravarLS(CH_COR, c); render(); };
      cores.appendChild(b);
    });
    var acoes = el('div', { class: 'mq-grade' }, [
      el('button', { class: 'mq-btn pri', text: '✔ Pronto', onclick: function () { expandido = null; selecionar(null); render(); } }),
      el('button', { class: 'mq-btn', text: '✥ Editar forma', onclick: function () { iniciarEdicaoForma(f); } }),
      el('button', { class: 'mq-btn per', text: '🗑 Excluir', onclick: function () { if (confirm('Excluir "' + (f.get('name') || 'esta marcação') + '"?')) { fonte.removeFeature(f); expandido = null; selecionar(null); render(); } } })
    ]);
    return el('div', { style: 'margin:6px 0 0 0' }, [nome, desc, cores, acoes]);
  }
  function selecionar(f) { selecionada = f; camada.changed(); }
  function irPara(f) {
    var g = f.getGeometry(); if (!g) return;
    var v = map.getView(), mob = window.innerWidth <= 640;
    var pad = [70, 40, mob && painelAberto() ? Math.round(window.innerHeight * 0.55) + 20 : 70, mob ? 40 : (painelAberto() ? 400 : 70)];
    if (g.getType() === 'Point') v.animate({ center: g.getCoordinates(), zoom: Math.max(v.getZoom(), 18), duration: 350 });
    else v.fit(g.getExtent(), { padding: pad, maxZoom: 19, duration: 400 });
  }
  function apagarTudo() {
    if (!fonte.getFeatures().length) return;
    if (confirm('Apagar TODAS as suas marcações deste aparelho? (Exporte antes se quiser guardar uma cópia.)')) {
      fonte.clear(); expandido = null; selecionada = null; render();
    }
  }

  // ---------- exportar / importar ----------
  function baixar(nome, texto, mime) {
    var a = el('a', { href: URL.createObjectURL(new Blob([texto], { type: mime })), download: nome });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function estiloKml(f) {
    var cor = f.get('color') || '#e53935', t = f.getGeometry().getType();
    if (t === 'Point' || t === 'MultiPoint') {
      return new ol.style.Style({ image: new ol.style.Icon({ src: 'https://maps.google.com/mapfiles/kml/paddle/wht-blank.png', color: cor, scale: 1 }) });
    }
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: cor, width: 3 }),
      fill: new ol.style.Fill({ color: hexRgba(cor, 0.25) })
    });
  }
  function exportar(fmt) {
    var fs = fonte.getFeatures();
    if (!fs.length) { aviso('Não há marcações para exportar.'); return; }
    var d = new Date(), nomeBase = 'minhas-marcacoes-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var opc = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' };
    if (fmt === 'kml') {
      var copias = fs.map(function (f) { var c = f.clone(); c.setId(f.getId()); c.setStyle(estiloKml(f)); return c; });
      var kml = new ol.format.KML({ writeStyles: true, defaultStyle: [] }).writeFeatures(copias, opc);
      baixar(nomeBase + '.kml', kml, 'application/vnd.google-earth.kml+xml');
    } else {
      baixar(nomeBase + '.geojson', fmtJson.writeFeatures(fs, opc), 'application/geo+json');
    }
  }
  var arquivoImport = el('input', { type: 'file', accept: '.geojson,.json,.kml,application/json,application/vnd.google-earth.kml+xml', style: 'display:none' });
  document.body.appendChild(arquivoImport);
  arquivoImport.onchange = function () {
    var arq = arquivoImport.files && arquivoImport.files[0]; arquivoImport.value = '';
    if (!arq) return;
    var rd = new FileReader();
    rd.onload = function () {
      var txt = String(rd.result || ''), fs = [];
      var opc = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' };
      try {
        fs = /\.kml$/i.test(arq.name) || /^\s*<\?xml|^\s*<kml/i.test(txt)
          ? new ol.format.KML({ extractStyles: false }).readFeatures(txt, opc)
          : fmtJson.readFeatures(txt, opc);
      } catch (e) { aviso('Não consegui ler este arquivo. Use GeoJSON ou KML.'); return; }
      fs = fs.filter(function (f) { return f.getGeometry(); });
      if (!fs.length) { aviso('O arquivo não tem geometrias para importar.'); return; }
      if (fs.length > MAX_IMPORT_AVISO && !confirm('O arquivo tem ' + fs.length + ' itens; o mapa pode ficar lento. Importar mesmo assim?')) return;
      var cor = lerLS(CH_COR) || CORES[0], n = 0;
      fs.forEach(function (f) {
        var p = f.getProperties();
        f.setId(novoId());
        f.setProperties({
          name: p.name || p.nome || p.Nome || p.NAME || (tipoNome(f.getGeometry()) + ' importado'),
          description: p.description || p.descricao || '',
          color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : cor,
          visible: true, created: new Date().toISOString()
        });
        n++;
      });
      fonte.addFeatures(fs);
      aviso(n + ' item(ns) importado(s).');
      var ext = fonte.getExtent(); if (!ol.extent.isEmpty(ext)) map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 400 });
      render();
    };
    rd.readAsText(arq);
  };

  // ---------- desenhar e editar ----------
  var draw = null, modificar = null, dblZoom = [], barra = null, terminou = false, medindoAntes = false;
  function pararMedicao() {
    if (document.body.classList.contains('medindo')) { var b = document.getElementById('btnMedir'); if (b) b.click(); }
  }
  function entrarModo() {
    pararMedicao();
    medindoAntes = !!window.medindo;
    window.medindo = true;                          // impede o toque longo/Ctrl+clique de abrir o cartão de coordenada
    document.body.classList.add('desenhando');
    map.getInteractions().getArray().forEach(function (i) {
      if (i instanceof ol.interaction.DoubleClickZoom && i.getActive()) { i.setActive(false); dblZoom.push(i); }
    });
  }
  function sairModo() {
    document.body.classList.remove('desenhando');
    if (!document.body.classList.contains('medindo')) window.medindo = false;
    dblZoom.forEach(function (i) { i.setActive(true); }); dblZoom = [];
    if (barra) barra.style.display = 'none';
  }
  function mostrarBarra(dica, botoesBarra) {
    if (!barra) { barra = el('div', { id: 'mqBarra' }); document.body.appendChild(barra); }
    barra.textContent = '';
    barra.appendChild(el('div', { text: dica, style: 'font-weight:bold' }));
    var l = el('div'); botoesBarra.forEach(function (b) { l.appendChild(el('button', { class: 'mq-btn' + (b.pri ? ' pri' : ''), text: b.t, onclick: b.f })); });
    barra.appendChild(l); barra.style.display = 'block';
  }
  function estiloEsboco(f) {
    var cor = lerLS(CH_COR) || CORES[0], t = f.getGeometry().getType();
    var base = [new ol.style.Style({ image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: cor, width: 3 }) }) })];
    if (t !== 'Point') base.unshift(new ol.style.Style({
      stroke: new ol.style.Stroke({ color: cor, width: 3, lineDash: [8, 6] }),
      fill: new ol.style.Fill({ color: hexRgba(cor, 0.18) })
    }));
    return base;
  }
  function iniciarDesenho(tipo) {
    cancelarTudo();
    entrarModo(); fecharPainel(); terminou = false;
    draw = new ol.interaction.Draw({ source: fonte, type: tipo, style: estiloEsboco });
    draw.on('drawend', function (ev) {
      terminou = true;
      var f = ev.feature, tn = tipo === 'Point' ? 'Ponto' : (tipo === 'LineString' ? 'Linha' : 'Polígono');
      var n = fonte.getFeatures().filter(function (x) { return x.getGeometry() && x.getGeometry().getType() === tipo; }).length + 1;
      f.setId(novoId());
      f.setProperties({ name: tn + ' ' + n, description: '', color: lerLS(CH_COR) || CORES[0], visible: true, created: new Date().toISOString() });
      setTimeout(function () {
        encerrarDesenho();
        expandido = f.getId(); selecionar(f); abrir('marc');
        var alvo = corpo.querySelector('.mq-item.sel input[type=text]'); if (alvo) { alvo.focus(); alvo.select(); }
      }, 0);
    });
    map.addInteraction(draw);
    var dica = tipo === 'Point' ? 'Toque no mapa para marcar o ponto' : (tipo === 'LineString' ? 'Toque para adicionar pontos da linha' : 'Toque para adicionar os cantos do polígono');
    var bs = [];
    if (tipo !== 'Point') {
      bs.push({ t: '↶ Desfazer', f: function () { if (draw) draw.removeLastPoint(); } });
      bs.push({ t: '✔ Concluir', pri: true, f: function () { terminou = false; if (draw) draw.finishDrawing(); if (!terminou) aviso(tipo === 'LineString' ? 'Marque pelo menos 2 pontos.' : 'Marque pelo menos 3 pontos.'); } });
    }
    bs.push({ t: '✖ Cancelar', f: function () { cancelarTudo(); abrir('marc'); } });
    mostrarBarra(dica, bs);
  }
  function encerrarDesenho() {
    if (draw) { map.removeInteraction(draw); draw = null; }
    sairModo();
  }
  function iniciarEdicaoForma(f) {
    cancelarTudo(); entrarModo(); fecharPainel();
    modificar = new ol.interaction.Modify({ features: new ol.Collection([f]) });
    map.addInteraction(modificar);
    var g = f.getGeometry(); if (g) irPara(f);
    mostrarBarra('Arraste os pontos para ajustar a forma', [
      { t: '✔ Concluir edição', pri: true, f: function () { cancelarTudo(); expandido = f.getId(); selecionar(f); abrir('marc'); } }
    ]);
  }
  function cancelarTudo() {
    if (draw) { map.removeInteraction(draw); draw = null; }
    if (modificar) { map.removeInteraction(modificar); modificar = null; }
    sairModo();
  }
  // se a medição for ligada no meio de um desenho, o desenho é cancelado
  new MutationObserver(function () {
    if ((draw || modificar) && document.body.classList.contains('medindo')) { var m = window.medindo; cancelarTudo(); window.medindo = true; }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ---------- tocar numa marcação existente (perto da linha/ponto, não no meio do polígono) ----------
  function acharMarcacao(e) {
    var melhor = null, dMin = 14;
    fonte.getFeatures().forEach(function (f) {
      if (f.get('visible') === false) return;
      var g = f.getGeometry(); if (!g) return;
      var t = g.getType(), alvo = g;
      if (t === 'Polygon') alvo = new ol.geom.LineString(g.getCoordinates()[0]);
      else if (t === 'MultiPolygon') alvo = new ol.geom.MultiLineString(g.getCoordinates().map(function (p) { return p[0]; }));
      var c = alvo.getClosestPoint(e.coordinate), px = map.getPixelFromCoordinate(c);
      if (!px) return;
      var d = Math.hypot(px[0] - e.pixel[0], px[1] - e.pixel[1]);
      if (d < dMin) { dMin = d; melhor = f; }
    });
    return melhor;
  }
  map.on('singleclick', function (e) {
    if (draw || modificar || window.medindo) return;
    var f = acharMarcacao(e);
    if (!f) return;
    try { overlayPopup.setPosition(undefined); } catch (err) {}   // fecha o balão da quadra que estava embaixo
    expandido = f.getId(); selecionar(f); abrir('marc');
    var item = corpo.querySelector('.mq-item.sel'); if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
  });
  // alguns navegadores móveis dispararam o balão da quadra antes: garante que ele não reapareça por cima da seleção
  window.MQ = { fonte: fonte, camada: camada, abrir: abrir, exportar: exportar };
})();
