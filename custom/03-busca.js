// ================= BUSCA: quadras (camada do mapa) + endereços (Photon) =================
// Limites da cidade: oeste, sul, leste, norte (ajuste se a cidade crescer)
var BBOX = '-51.26,-19.74,-51.12,-19.62';
var CENTRO = { lat: -19.677, lon: -51.19 };   // dá prioridade a resultados próximos
var CAMPO_QUADRA = null;                      // null = detecta sozinho; ou escreva o nome do campo, ex.: 'quadra'
var VALORES_INVALIDOS = ['?', '-', '0', ''];  // valores que não contam como quadra
var OCULTAR_BUSCA_NATIVA = false;             // true = esconde a caixa de busca antiga do qgis2web

if (OCULTAR_BUSCA_NATIVA) {
  var st = document.createElement('style');
  st.textContent = '.gcd-gl-container, .photon-geocoder-autocomplete {display:none !important}';
  document.head.appendChild(st);
}

// --- caixa e lista de sugestões ---
var boxBusca = document.createElement('div');
boxBusca.style.cssText = 'position:fixed;top:10px;left:50px;z-index:10000;width:330px;max-width:calc(100vw - 62px);font:14px sans-serif';
boxBusca.innerHTML =
  '<div style="background:#fff;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.4);display:flex">' +
  '<input id="inputBusca" type="text" autocomplete="off" placeholder="Rua, quadra ou coordenada" ' +
  'style="border:0;padding:8px;flex:1;font-size:14px;outline:none;border-radius:4px;min-width:0">' +
  '<button id="btnLimpar" title="Limpar busca" aria-label="Limpar busca" style="display:none;border:0;background:none;padding:0 6px;cursor:pointer;font-size:20px;line-height:1;color:#777">×</button>' +
  '<button id="btnBusca" style="border:0;background:none;padding:0 10px;cursor:pointer">🔍</button>' +
  '<button id="btnLoc" title="Minha localização" aria-label="Minha localização" style="border:0;border-left:1px solid #ddd;background:none;margin-left:10px;padding:0 13px;min-width:46px;cursor:pointer;font-size:18px">📍</button>' +
  '<button id="btnMedir" title="Medir distância e área" style="border:0;border-left:1px solid #ddd;background:none;margin-left:10px;padding:0 12px;min-width:44px;cursor:pointer;font-size:16px;border-radius:0 4px 4px 0">📏</button></div>' +
  '<div id="listaBusca" style="background:#fff;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.4);' +
  'margin-top:2px;display:none;max-height:260px;overflow-y:auto"></div>';
document.body.appendChild(boxBusca);

var inputBusca = document.getElementById('inputBusca');
var listaBusca = document.getElementById('listaBusca');
var btnLimpar = document.getElementById('btnLimpar');
var coordDaBusca = false;   // o cartão de coordenada aberto veio desta busca?
var sugestoes = [];

// --- marcador azul da busca ---
var fonteBusca = new ol.source.Vector();
map.addLayer(new ol.layer.Vector({
  source: fonteBusca,
  interactive: false,
  zIndex: 9998,
  style: new ol.style.Style({
    image: new ol.style.Circle({
      radius: 8,
      fill: new ol.style.Fill({ color: '#1e88e5' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 3 })
    })
  })
}));

// --- destaque da quadra pesquisada: contorno ciano com halo branco e preenchimento leve ---
var fonteDestaque = new ol.source.Vector();
var camadaDestaque = new ol.layer.Vector({
  source: fonteDestaque,
  interactive: false,
  zIndex: 9996,
  style: [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ffffff', width: 8 }) }),
    new ol.style.Style({
      stroke: new ol.style.Stroke({ color: '#00b8d4', width: 4 }),
      fill: new ol.style.Fill({ color: 'rgba(0,229,255,0.28)' })
    })
  ]
});
map.addLayer(camadaDestaque);

// O destaque (quadra ou rua) só serve para a pessoa achar o objeto: depois de enquadrado, some sozinho (esmaece).
// Esc em qualquer lugar do mapa também sai da pesquisa e remove o destaque na hora.
var DESTAQUE_SEGUNDOS = 0;     // 0 = o destaque fica até apertar Esc, no X, ou fazer outra busca
var _tFimDestaque = null, _tFade = null;
function cancelarFimDestaque() {
  clearTimeout(_tFimDestaque); clearInterval(_tFade);
  _tFimDestaque = null; _tFade = null;
  camadaDestaque.setOpacity(1);
}
function agendarFimDestaque() {
  cancelarFimDestaque();
  if (!DESTAQUE_SEGUNDOS) return;
  _tFimDestaque = setTimeout(function () {
    var passo = 0, total = 10;                           // esmaece em ~0,4 s
    _tFade = setInterval(function () {
      passo++;
      camadaDestaque.setOpacity(Math.max(0, 1 - passo / total));
      if (passo >= total) {
        clearInterval(_tFade); _tFade = null;
        fonteDestaque.clear();
        camadaDestaque.setOpacity(1);
      }
    }, 40);
  }, DESTAQUE_SEGUNDOS * 1000);
}

// --- quadras: lê só a camada de quadras, só o campo do número ---
function camadasDeQuadras() {
  var todas = [], achadas = [];
  (function varrer(layers) {
    layers.forEach(function (l) {
      if (l.getLayers) { varrer(l.getLayers().getArray()); return; }
      var src = l.getSource && l.getSource();
      if (!src || !src.getFeatures || src === fonteBusca) return;
      if (!(l instanceof ol.layer.Vector)) return;
      todas.push(l);
      var titulo = String(l.get('title') || '').replace(/<[^>]*>/g, '').toLowerCase();
      if (titulo.indexOf('quadra') >= 0) achadas.push(l);
    });
  })(map.getLayers().getArray());
  return achadas.length ? achadas : todas;   // se o título não bater, usa todas as vetoriais
}

function detectarCampo(feats) {
  if (CAMPO_QUADRA) return CAMPO_QUADRA;
  if (!feats.length) return null;
  var chaves = Object.keys(feats[0].getProperties()).filter(function (k) { return k !== 'geometry'; });
  var pref = chaves.filter(function (k) { return /quadra|^num|^nº|^n_/i.test(k); });
  return (pref[0] || chaves[0] || null);
}

function quadrasLocais(q) {
  var ql = q.toLowerCase(), grupos = {};
  camadasDeQuadras().forEach(function (l) {
    var feats = l.getSource().getFeatures();
    var campo = detectarCampo(feats);
    if (!campo) return;
    feats.forEach(function (f) {
      var v = f.get(campo);
      if (v === null || v === undefined) return;
      v = String(v).trim();
      if (VALORES_INVALIDOS.indexOf(v) >= 0) return;
      if (v.toLowerCase().indexOf(ql) !== 0) return;
      (grupos[v] = grupos[v] || []).push(f);   // agrupa polígonos de mesmo número
    });
  });
  return Object.keys(grupos)
    .sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }); })
    .slice(0, 6)
    .map(function (v) { return { tipo: 'quadra', rotulo: 'Quadra ' + v, features: grupos[v] }; });
}

// --- endereços: Photon limitado à cidade ---
var contador = 0, timer = null;
async function enderecos(q) {
  var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) +
    '&limit=5&bbox=' + BBOX + '&lat=' + CENTRO.lat + '&lon=' + CENTRO.lon;
  var d = await (await fetch(url)).json();
  return d.features.map(function (f) {
    var p = f.properties;
    var linha1 = p.name || ((p.street || '') + (p.housenumber ? ', ' + p.housenumber : ''));
    var linha2 = [p.street && p.name ? p.street : '', p.district, p.city].filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(' - ');
    return { tipo: 'endereco', rotulo: linha1, detalhe: linha2,
             lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
             rua: (p.osm_key === 'highway' || p.type === 'street') ? p.name : null };
  });
}

// --- ruas: sugestões instantâneas a partir do arquivo local ruas.js (nomes de ruas do OpenStreetMap) ---
// Casa por INÍCIO DE QUALQUER PALAVRA, sem acento e ignorando "Rua/R./Av./Tv.": "com" acha "R. Comendador Garcia".
var _indiceRuas = null;
function indiceDeRuas() {
  if (_indiceRuas) return _indiceRuas;
  var grupos = {};
  var els = (window.RUAS_OSM && window.RUAS_OSM.elements) || [];
  if (!els.length) { carregarRuasLocal(); return []; }          // ainda não chegou: não guarda índice vazio
  els.forEach(function (el) {
    if (!el.tags || !el.tags.name || !el.geometry || el.geometry.length < 2) return;
    var nome = String(el.tags.name).trim(), chave = semAcento(nome);
    (grupos[chave] = grupos[chave] || { nome: nome, els: [], nucleo: nucleoNome(nome) }).els.push(el);
  });
  _indiceRuas = Object.keys(grupos).map(function (k) {
    var g = grupos[k]; g.palavras = g.nucleo.split(' '); return g;
  });
  return _indiceRuas;
}
function centroDaRua(g) {
  var maior = g.els.reduce(function (a, b) { return b.geometry.length > a.geometry.length ? b : a; });
  var pt = maior.geometry[Math.floor(maior.geometry.length / 2)];
  return { lat: pt.lat, lon: pt.lon };
}
function ruasLocais(q) {
  var toks = semAcento(q).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  if (toks.length > 1 && TIPOS_VIA.indexOf(toks[0]) >= 0) toks.shift();       // "rua com" -> "com"
  if (!toks.length || (toks.length === 1 && TIPOS_VIA.indexOf(toks[0]) >= 0 && toks[0].length < 4)) return [];
  var alvo = toks.join(' '), achadas = [];
  indiceDeRuas().forEach(function (g) {
    var ok = toks.every(function (t) { return g.palavras.some(function (w) { return w.indexOf(t) === 0; }); });
    if (!ok) return;
    achadas.push({ g: g, pontos: g.nucleo.indexOf(alvo) === 0 ? 0 : 1 });
  });
  achadas.sort(function (a, b) { return a.pontos - b.pontos || a.g.nucleo.length - b.g.nucleo.length; });
  return achadas.slice(0, 6).map(function (a) {
    var c = centroDaRua(a.g);
    return { tipo: 'endereco', rotulo: a.g.nome, detalhe: 'Rua · Paranaíba', lat: c.lat, lon: c.lon, rua: a.g.nome, local: true };
  });
}

// --- Google Maps (abre em outra aba): útil para achar o NÚMERO da casa, que o OpenStreetMap quase não tem ---
function itemGoogle(q) {
  var consulta = /paran/i.test(q) ? q : q + ', Paranaíba - MS';
  return { tipo: 'google', rotulo: 'Procurar no Google Maps: ' + q,
           detalhe: 'Abre o Google Maps em outra aba',
           url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta) };
}

function mostrar(lista) {
  sugestoes = lista;
  if (!lista.length) { listaBusca.style.display = 'none'; return; }
  listaBusca.innerHTML = '';
  lista.forEach(function (s, i) {
    var item = document.createElement('div');
    item.style.cssText = 'padding:8px 10px;cursor:pointer;border-bottom:1px solid #eee';
    var icone = s.tipo === 'quadra' ? '🟨 ' : (s.tipo === 'endereco' ? (s.local ? '🛣️ ' : '📍 ') : (s.tipo === 'coordenada' ? '🎯 ' : (s.tipo === 'google' ? '🔎 ' : '')));
    item.innerHTML = icone + '<b>' + s.rotulo + '</b>' +
      (s.detalhe ? '<br><small style="color:#666">' + s.detalhe + '</small>' : '');
    if (s.tipo === 'aviso') {
      item.style.cursor = 'default';
      item.style.color = '#888';
      listaBusca.appendChild(item);
      return;
    }
    item.onmouseenter = function () { item.style.background = '#e8f0fe'; };
    item.onmouseleave = function () { item.style.background = '#fff'; };
    item.onclick = function () { escolher(i); };
    listaBusca.appendChild(item);
  });
  listaBusca.style.display = 'block';
}

function escolher(i) {
  var s = sugestoes[i];
  if (!s || s.tipo === 'aviso') return;
  if (s.tipo === 'google') { window.open(s.url, '_blank', 'noopener'); return; }
  cancelarFimDestaque();
  fonteBusca.clear();
  fonteDestaque.clear();
  listaBusca.style.display = 'none';
  inputBusca.value = s.rotulo.replace(/^Quadra /, '');
  atualizarX();
  if (s.tipo === 'coordenada') { irParaCoordenada(s.lat, s.lon); return; }
  if (coordDaBusca && window.fecharCoordenada) { window.fecharCoordenada(); coordDaBusca = false; }
  if (s.tipo === 'quadra') {
    var ext = ol.extent.createEmpty();
    s.features.forEach(function (f) { ol.extent.extend(ext, f.getGeometry().getExtent()); });
    s.features.forEach(function (f) { fonteDestaque.addFeature(new ol.Feature(f.getGeometry().clone())); });
    map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19 });
    agendarFimDestaque();
  } else if (s.tipo === 'endereco') {
    var coord = ol.proj.fromLonLat([s.lon, s.lat]);
    map.getView().setCenter(coord);
    if (s.rua) {
      map.getView().setZoom(17);
      destacarRua(s.rua, coord, ++contador);   // desenha a rua assim que o traçado chegar
    } else {
      fonteBusca.addFeature(new ol.Feature(new ol.geom.Point(coord)));
      map.getView().setZoom(18);
    }
  }
}

// --- coordenada digitada ou colada (formato do Google Maps, link ou graus/minutos/segundos) ---
function lerCoordenada(texto) {
  var s = String(texto || '').trim();
  if (!s) return null;
  var m, lat, lon;

  // 1) link do Google Maps: @lat,lon  |  !3dlat!4dlon  |  ?q=lat,lon
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||      // ponto exato do lugar
      s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||          // centro da tela do Google (cai perto do pino)
      s.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) { lat = parseFloat(m[1]); lon = parseFloat(m[2]); }

  // 2) graus decimais: -19.677426, -51.199232  (aceita também vírgula decimal)
  if (lat === undefined && /[.,]\d/.test(s)) {
    var t = s.replace(/[°º]/g, '');
    m = t.match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]?\s+(-?\d{1,3}(?:[.,]\d+)?)$/) ||
        t.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
    if (m) { lat = parseFloat(m[1].replace(',', '.')); lon = parseFloat(m[2].replace(',', '.')); }
  }

  // 3) graus, minutos e segundos: 19°40'38.7"S 51°11'57.2"W
  if (lat === undefined) {
    var re = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|'')?\s*([NSLOEW])/gi;
    var partes = [], x;
    while ((x = re.exec(s)) !== null) {
      var v = parseInt(x[1], 10) + parseInt(x[2], 10) / 60 + parseFloat(x[3].replace(',', '.')) / 3600;
      if (/[SOW]/i.test(x[4])) v = -v;     // Sul e Oeste são negativos (L = Leste)
      partes.push(v);
    }
    if (partes.length === 2) { lat = partes[0]; lon = partes[1]; }
  }

  if (lat === undefined || isNaN(lat) || isNaN(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: lat, lon: lon };
}

// --- destaque de rua: traça todos os trechos de mesmo nome dentro da cidade (dados do OpenStreetMap) ---
// 1º tenta o arquivo local "ruas.json" (instantâneo); se ele não existir, consulta o Overpass pela internet.
var OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
var _ruasLocal = null, _cacheRuas = {};

function semAcento(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function carregarRuasJson() {                                  // alternativa: ruas.json (exige servidor ou o site publicado)
  return fetch('ruas.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && d.elements) console.info('[ruas.json] carregado:', d.elements.length, 'trechos');
      else console.warn('Sem ruas.js/ruas.json; usando consulta online');
      return d;
    })
    .catch(function () { console.warn('Sem ruas.js/ruas.json; usando consulta online'); return null; });
}
function carregarRuasLocal() {
  if (!_ruasLocal) {
    if (window.RUAS_OSM && window.RUAS_OSM.elements) {          // já presente (ex.: <script src="ruas.js"> manual)
      _ruasLocal = Promise.resolve(window.RUAS_OSM);
    } else {                                                    // DESEMPENHO: injeta ruas.js sem travar a abertura do mapa
      _ruasLocal = new Promise(function (resolve) {
        var sc = document.createElement('script');
        sc.src = 'ruas.js';
        sc.async = true;
        sc.onload = function () {
          if (window.RUAS_OSM && window.RUAS_OSM.elements) {
            console.info('[ruas.js] carregado:', window.RUAS_OSM.elements.length, 'trechos');
            resolve(window.RUAS_OSM);
            setTimeout(indiceDeRuas, 0);                        // monta o índice de busca já, fora do momento da digitação
          } else { carregarRuasJson().then(resolve); }
        };
        sc.onerror = function () { carregarRuasJson().then(resolve); };
        document.head.appendChild(sc);
      });
    }
  }
  return _ruasLocal;
}
// pré-carrega só depois que o mapa terminou de desenhar e o navegador está ocioso
map.once('rendercomplete', function () {
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(carregarRuasLocal, { timeout: 5000 });
});

// consulta os dois servidores ao mesmo tempo, com limite de 12 s; vale o primeiro que responder
function buscarRuaOnline(consulta) {
  return new Promise(function (resolve) {
    var restantes = OVERPASS.length, ctrls = [];
    function falha() { if (--restantes === 0) resolve(null); }
    OVERPASS.forEach(function (url, i) {
      var c = new AbortController();
      ctrls.push(c);
      var t = setTimeout(function () { c.abort(); }, 12000);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(consulta),
        signal: c.signal
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          clearTimeout(t);
          if (d && d.elements) {
            ctrls.forEach(function (x, j) { if (j !== i) x.abort(); });
            resolve(d);
          } else { falha(); }
        })
        .catch(function () { clearTimeout(t); falha(); });
    });
  });
}

// tipos de via que podem aparecer abreviados ou por extenso ("R." / "Rua", "Av." / "Avenida"...)
var TIPOS_VIA = ['rua', 'r', 'avenida', 'av', 'travessa', 'tv', 'praca', 'pc', 'alameda', 'al',
                 'estrada', 'est', 'rodovia', 'rod', 'beco', 'via'];
function nucleoNome(t) {
  var p = semAcento(t).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  if (p.length > 1 && TIPOS_VIA.indexOf(p[0]) >= 0) p.shift();
  return p.join(' ');
}
function filtrarRuas(lista, nome) {
  var alvo = semAcento(nome);
  var exatos = lista.filter(function (el) { return el.tags && el.tags.name && semAcento(el.tags.name) === alvo; });
  if (exatos.length) return exatos;
  var nucleo = nucleoNome(nome);                       // mesma rua com o tipo escrito de outro jeito
  return lista.filter(function (el) { return el.tags && el.tags.name && nucleoNome(el.tags.name) === nucleo; });
}

function avisarBusca(texto) {
  var a = document.createElement('div');
  a.textContent = texto;
  a.style.cssText = 'position:fixed;top:56px;left:50px;z-index:10003;background:#323232;color:#fff;' +
    'padding:8px 12px;border-radius:4px;font:13px sans-serif;max-width:calc(100vw - 70px);box-shadow:0 1px 5px rgba(0,0,0,.4)';
  document.body.appendChild(a);
  setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 4500);
}

async function destacarRua(nome, coordCentro, token) {
  var elementos = [];
  var local = await carregarRuasLocal();
  var origem = 'arquivo local';
  if (local && local.elements) elementos = filtrarRuas(local.elements, nome);

  if (!elementos.length) {                              // sem arquivo local, ou rua ausente nele: consulta online
    origem = 'consulta online';
    if (_cacheRuas[nome]) {
      elementos = _cacheRuas[nome];
    } else {
      var b = BBOX.split(',').map(Number);              // oeste, sul, leste, norte
      var consulta = '[out:json][timeout:25];way["highway"]["name"="' +
        nome.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"](' + b[1] + ',' + b[0] + ',' + b[3] + ',' + b[2] + ');out geom;';
      var d = await buscarRuaOnline(consulta);
      if (d && d.elements) { elementos = d.elements; _cacheRuas[nome] = elementos; }
    }
  }
  if (token !== contador) return;                       // a pessoa já fez outra busca ou cancelou

  var ext = ol.extent.createEmpty(), n = 0;
  elementos.forEach(function (el) {
    if (!el.geometry || el.geometry.length < 2) return;
    var cs = el.geometry.map(function (g) { return ol.proj.fromLonLat([g.lon, g.lat]); });
    var ft = new ol.Feature(new ol.geom.LineString(cs));
    fonteDestaque.addFeature(ft);
    ol.extent.extend(ext, ft.getGeometry().getExtent());
    n++;
  });
  console.info('[rua]', nome, '→', n, 'trechos (' + origem + ')');
  if (n) {
    map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19 });
    agendarFimDestaque();
  } else {
    fonteBusca.addFeature(new ol.Feature(new ol.geom.Point(coordCentro)));
    avisarBusca('Traçado da rua não encontrado no OpenStreetMap; mostrando só o ponto.');
  }
}

function atualizarX() {
  btnLimpar.style.display = inputBusca.value ? 'block' : 'none';
}

// cancela a pesquisa: apaga o texto, a lista, o destaque da quadra e o pino da busca
function limparBusca(semFoco) {
  clearTimeout(timer);
  cancelarFimDestaque();
  contador++;                                  // descarta respostas que ainda estejam a caminho
  inputBusca.value = '';
  sugestoes = [];
  listaBusca.style.display = 'none';
  fonteBusca.clear();
  fonteDestaque.clear();
  if (coordDaBusca && window.fecharCoordenada) window.fecharCoordenada();
  coordDaBusca = false;
  atualizarX();
  if (!semFoco) inputBusca.focus();
}

function irParaCoordenada(lat, lon) {
  cancelarFimDestaque();
  fonteBusca.clear();
  fonteDestaque.clear();
  listaBusca.style.display = 'none';
  coordDaBusca = true;
  var coord = ol.proj.fromLonLat([lon, lat]);
  map.getView().setCenter(coord);
  map.getView().setZoom(19);
  if (window.mostrarCoordenada) {
    window.mostrarCoordenada(coord, true);   // pino laranja + cartão com a quadra, sem copiar
  } else {
    fonteBusca.addFeature(new ol.Feature(new ol.geom.Point(coord)));
  }
}

function entrar() {
  var c = lerCoordenada(inputBusca.value);
  if (c) { irParaCoordenada(c.lat, c.lon); return; }
  if (sugestoes.length) escolher(0); else atualizar();
}

async function atualizar() {
  var q = inputBusca.value.trim();
  if (q.length < 2) { mostrar([]); return; }
  var meu = ++contador;
  var coordTxt = lerCoordenada(q);
  if (coordTxt) {
    mostrar([{ tipo: 'coordenada', rotulo: coordTxt.lat.toFixed(6) + ', ' + coordTxt.lon.toFixed(6),
              detalhe: 'Ir para esta coordenada', lat: coordTxt.lat, lon: coordTxt.lon }]);
    return;
  }
  var locais = quadrasLocais(q);

  // parece número de quadra (ex.: 4022, 137A, 137-A): busca só nas quadras
  if (/^\d+-?[a-z]?$/i.test(q)) {
    mostrar(locais.length ? locais
      : [{ tipo: 'aviso', rotulo: 'Nenhuma quadra com esse número' }]);
    return;
  }

  // "Rua Fulano 123" / "Rua Fulano, nº 123": procura a rua sem o número (o número da casa pode ser procurado no Google Maps)
  var mNum = q.match(/^(.*?\D)[\s,]+(?:n[ºo°.]?\s*)?\d{1,5}[a-z]?$/i);
  var ruas = ruasLocais(mNum ? mNum[1] : q);
  var base = locais.concat(ruas);
  var google = q.length >= 3 ? [itemGoogle(q)] : [];
  mostrar(base.concat(google));
  if (q.length < 3) return;
  try {
    var ends = await enderecos(q);
    if (meu !== contador) return;           // descarta resposta antiga
    var jaTem = {};
    ruas.forEach(function (r) { jaTem[semAcento(r.rotulo)] = true; });
    ends = ends.filter(function (e) { return !(e.rua && jaTem[semAcento(e.rotulo)]); });   // sem repetir a mesma rua
    mostrar(base.concat(ends, google));
  } catch (e) { /* sem internet: mantém quadras e ruas locais */ }
}

inputBusca.addEventListener('input', function () {
  clearTimeout(timer);
  atualizarX();
  if (!inputBusca.value.trim()) { fonteDestaque.clear(); fonteBusca.clear(); }
  timer = setTimeout(atualizar, 350);       // espera parar de digitar
});
inputBusca.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    entrar();
  } else if (e.key === 'Escape') {
    limparBusca();
  }
});
document.getElementById('btnBusca').onclick = entrar;
btnLimpar.onclick = function () { limparBusca(); };
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || e.target === inputBusca) return;   // dentro da caixa, o Esc já é tratado pelo campo
  limparBusca(true);
});
document.addEventListener('click', function (e) {
  if (!boxBusca.contains(e.target)) listaBusca.style.display = 'none';
});
