// ================= MEDIÇÃO DE DISTÂNCIA E ÁREA =================
// Cálculo esférico (não usa as medidas da projeção do mapa, que distorcem ~6% em distância e ~13% em área aqui).
(function () {
  // >>> geodesia
  var R = 6371008.8;
  function rad(x) { return x * Math.PI / 180; }
  function distancia(a, b) {
    var A = ol.proj.toLonLat(a), B = ol.proj.toLonLat(b);
    var f1 = rad(A[1]), f2 = rad(B[1]), dl = rad(B[0] - A[0]);
    var h = Math.pow(Math.sin((f2 - f1) / 2), 2) + Math.cos(f1) * Math.cos(f2) * Math.pow(Math.sin(dl / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function areaEsferica(cs) {              // cs = vértices sem repetir o primeiro
    var s = 0, n = cs.length;
    for (var i = 0; i < n; i++) {
      var a = ol.proj.toLonLat(cs[i]), b = ol.proj.toLonLat(cs[(i + 1) % n]);
      s += rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
    }
    return Math.abs(s * R * R / 2);
  }
  // <<< geodesia
  function fmtDist(m) {
    return m < 1000
      ? m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
      : (m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' km';
  }
  function fmtArea(m2) {
    var s = m2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²';
    if (m2 >= 10000) s += ' (' + (m2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ha)';
    return s;
  }

  var modo = 'dist', pts = [], ativo = false, modify = null, textoCopia = '', dblZoom = [];
  var apagando = false;      // modo "apagar ponto": o próximo toque num ponto o remove
  var tituloImg = '';        // título opcional da imagem/KML/marcação (limpo ao limpar a medição)
  window.medindo = false;

  // estilos extras: esconde o balão do qgis2web e usa mira enquanto mede
  var st = document.createElement('style');
  st.textContent = '.medindo .ol-popup{display:none !important}' +
    '.medindo #map, .medindo #map .ol-viewport{cursor:crosshair !important}' +
    '.apagando #map, .apagando #map .ol-viewport{cursor:pointer !important}';
  document.head.appendChild(st);

  // --- desenho ---
  var fonteMedir = new ol.source.Vector();
  var COR = '#e91e63';
  function estilo(f, resolucao) {
    var g = f.getGeometry(), t = g.getType(), out = [];
    var halo = new ol.style.Stroke({ color: '#ffffff', width: 7 });
    var linha = new ol.style.Stroke({ color: COR, width: 3 });
    if (t === 'Polygon') {
      out.push(new ol.style.Style({ stroke: halo }));
      out.push(new ol.style.Style({ stroke: linha, fill: new ol.style.Fill({ color: 'rgba(233,30,99,0.18)' }) }));
    } else if (t === 'LineString') {
      out.push(new ol.style.Style({ stroke: halo }));
      out.push(new ol.style.Style({ stroke: linha }));
    }
    var cs = t === 'Polygon' ? g.getCoordinates()[0] : (t === 'LineString' ? g.getCoordinates() : [g.getCoordinates()]);
    var nv = t === 'Polygon' ? cs.length - 1 : cs.length;
    var rv = apagando ? 9 : 6, corV = apagando ? '#e53935' : COR;   // vermelhos e maiores enquanto apaga
    for (var i = 0; i < nv; i++) {
      out.push(new ol.style.Style({
        geometry: new ol.geom.Point(cs[i]),
        image: new ol.style.Circle({
          radius: rv,
          fill: new ol.style.Fill({ color: '#ffffff' }),
          stroke: new ol.style.Stroke({ color: corV, width: 3 })
        })
      }));
    }
    // medida de cada trecho (só quando há espaço na tela)
    for (var j = 0; j < cs.length - 1; j++) {
      var a = cs[j], b = cs[j + 1];
      var compPx = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)) / resolucao;
      var txtL = fmtDist(distancia(a, b));
      var larg = txtL.length * 7 + 8;                    // largura aproximada do texto em 12px
      if (compPx < Math.max(24, larg * 0.5)) continue;   // só esconde quando realmente não há espaço
      var peq = compPx < larg;                           // lado curto: texto menor em vez de sumir
      out.push(new ol.style.Style({
        geometry: new ol.geom.Point([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
        text: new ol.style.Text({
          text: txtL,
          font: 'bold ' + (peq ? 10 : 12) + 'px sans-serif',
          fill: new ol.style.Fill({ color: '#000' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 4 }),
          offsetY: peq ? -10 : -12
        })
      }));
    }
    return out;
  }
  map.addLayer(new ol.layer.Vector({
    source: fonteMedir, interactive: false, zIndex: 9995, style: estilo,
    updateWhileInteracting: true, updateWhileAnimating: true
  }));

  // --- painel ---
  var BTN = 'padding:7px 10px;border:0;border-radius:4px;font-size:13px;cursor:pointer;';
  var painel = document.createElement('div');
  painel.id = 'medPainel';
  painel.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10002;display:none;' +
    'background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);padding:10px 12px;font:14px sans-serif;' +
    'width:380px;max-width:calc(100vw - 24px)';
  painel.innerHTML =
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
    '<button id="medDist" style="' + BTN + '">Distância</button>' +
    '<button id="medArea" style="' + BTN + '">Área</button>' +
    '<button id="medFechar" aria-label="Fechar" style="margin-left:auto;border:0;background:none;font-size:22px;line-height:1;cursor:pointer">×</button></div>' +
    '<div id="medResultado" style="font-size:16px;font-weight:bold;min-height:22px"></div>' +
    '<div id="medDetalhe" style="color:#555;font-size:13px;margin:2px 0 2px"></div>' +
    '<div id="medCentro" style="color:#555;font-size:13px;margin:0 0 8px"></div>' +
    '<div style="display:flex;gap:6px">' +
    '<button id="medDesfazer" style="' + BTN + 'background:#eee;flex:1">Desfazer</button>' +
    '<button id="medLimpar" style="' + BTN + 'background:#eee;flex:1">Limpar</button>' +
    '<button id="medCopiar" style="' + BTN + 'background:#1e88e5;color:#fff;flex:1">Copiar</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:6px">' +
    '<button id="medApagar" style="' + BTN + 'background:#eee;flex:1">🗑 Apagar ponto</button>' +
    '<button id="medKml" style="' + BTN + 'background:#43a047;color:#fff;flex:1">🌍 Exportar KML</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:6px">' +
    '<button id="medSalvar" style="' + BTN + 'background:#8e24aa;color:#fff;flex:1">📌 Salvar em Minhas marcações</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:6px">' +
    '<button id="medCompartilhar" style="' + BTN + 'background:#25d366;color:#fff;flex:1">📤 Compartilhar imagem</button></div>';
  document.body.appendChild(painel);

  var elResultado = document.getElementById('medResultado');
  var elDetalhe = document.getElementById('medDetalhe');
  var elCentro = document.getElementById('medCentro');
  var btnDist = document.getElementById('medDist');
  var btnArea = document.getElementById('medArea');
  var btnCopiar = document.getElementById('medCopiar');
  var btnMedir = document.getElementById('btnMedir');
  var btnShare = document.getElementById('medCompartilhar');
  var btnApagar = document.getElementById('medApagar');
  var btnKml = document.getElementById('medKml');
  var btnSalvar = document.getElementById('medSalvar');

  function pintarAbas() {
    btnDist.style.cssText = BTN + (modo === 'dist' ? 'background:#e91e63;color:#fff' : 'background:#eee');
    btnArea.style.cssText = BTN + (modo === 'area' ? 'background:#e91e63;color:#fff' : 'background:#eee');
  }

  function atualizarPainel() {
    var n = pts.length;
    textoCopia = '';
    elCentro.textContent = '';
    if (modo === 'dist') {
      if (n < 2) {
        elResultado.textContent = 'Toque no mapa para marcar os pontos';
        elDetalhe.textContent = n + (n === 1 ? ' ponto' : ' pontos');
      } else {
        var total = 0;
        for (var i = 0; i < n - 1; i++) total += distancia(pts[i], pts[i + 1]);
        elResultado.textContent = 'Distância: ' + fmtDist(total);
        elDetalhe.textContent = n + ' pontos';
        textoCopia = 'Distância: ' + fmtDist(total);
      }
    } else {
      if (n < 3) {
        elResultado.textContent = 'Marque ao menos 3 pontos';
        elDetalhe.textContent = n + (n === 1 ? ' ponto' : ' pontos');
      } else {
        var per = 0;
        for (var k = 0; k < n; k++) per += distancia(pts[k], pts[(k + 1) % n]);
        var ar = areaEsferica(pts);
        elResultado.textContent = 'Área: ' + fmtArea(ar);
        elDetalhe.textContent = 'Perímetro: ' + fmtDist(per) + ' · ' + n + ' pontos';
        textoCopia = 'Área: ' + fmtArea(ar) + ' | Perímetro: ' + fmtDist(per);
        var cen = centroideLatLon(pts);
        if (cen) { elCentro.textContent = 'Centro: ' + fmtCentro(cen); textoCopia += ' | Centro: ' + fmtCentroPonto(cen); }
      }
    }
    btnCopiar.style.opacity = textoCopia ? '1' : '.5';
    if (btnShare) { btnShare.style.opacity = textoCopia ? '1' : '.5'; if (!gerando) rotuloBtn(); }
    if (btnKml) btnKml.style.opacity = textoCopia ? '1' : '.5';
    if (btnSalvar) btnSalvar.style.opacity = textoCopia ? '1' : '.5';
    if (apagando) {
      elResultado.textContent = 'Toque no ponto que quer apagar';
      elDetalhe.textContent = 'Toque em "Cancelar" para sair';
    }
  }

  // apagar um ponto específico: toque no botão e depois no ponto que quer remover
  function modoApagar(on) {
    apagando = !!on;
    document.body.classList.toggle('apagando', apagando);
    btnApagar.textContent = apagando ? '✖ Cancelar' : '🗑 Apagar ponto';
    btnApagar.style.cssText = BTN + (apagando ? 'background:#e53935;color:#fff;flex:1' : 'background:#eee;flex:1');
    if (modify) modify.setActive(!apagando);     // enquanto apaga, um toque na linha não cria ponto novo
    fonteMedir.changed();                        // redesenha os pontos (vermelhos enquanto apaga)
    atualizarPainel();
  }

  function desenhar() {
    fonteMedir.clear();
    if (pts.length) {
      var g;
      if (modo === 'area' && pts.length >= 3) g = new ol.geom.Polygon([pts.concat([pts[0]])]);
      else if (pts.length >= 2) g = new ol.geom.LineString(pts);
      else g = new ol.geom.Point(pts[0]);
      fonteMedir.addFeature(new ol.Feature(g));
    }
    atualizarPainel();
  }

  // depois de arrastar um ponto, relê os vértices a partir do desenho
  function sincronizar() {
    var f = fonteMedir.getFeatures()[0];
    if (!f) return;
    var g = f.getGeometry(), t = g.getType();
    pts = t === 'Polygon' ? g.getCoordinates()[0].slice(0, -1) : (t === 'LineString' ? g.getCoordinates() : [g.getCoordinates()]);
    atualizarPainel();
  }

  function ligar() {
    ativo = true;
    window.medindo = true;
    document.body.classList.add('medindo');
    if (window.fecharCoordenada) window.fecharCoordenada();   // fecha o cartão de coordenada
    var info = document.getElementById('infoPino');
    if (info) info.style.display = 'none';
    modify = new ol.interaction.Modify({ source: fonteMedir, pixelTolerance: 16 });   // alvo maior para o dedo
    modify.on('modifyend', sincronizar);
    map.addInteraction(modify);
    dblZoom = map.getInteractions().getArray().filter(function (i) { return i instanceof ol.interaction.DoubleClickZoom && i.getActive(); });
    dblZoom.forEach(function (i) { i.setActive(false); });   // sem zoom por duplo-toque enquanto mede
    btnMedir.style.background = '#e8f0fe';
    painel.style.display = 'block';
    pintarAbas();
    desenhar();
  }

  function desligar() {
    if (apagando) modoApagar(false);
    ativo = false;
    window.medindo = false;
    document.body.classList.remove('medindo');
    if (modify) { map.removeInteraction(modify); modify = null; }
    dblZoom.forEach(function (i) { i.setActive(true); }); dblZoom = [];
    pts = []; tituloImg = '';
    fonteMedir.clear();
    painel.style.display = 'none';
    btnMedir.style.background = 'none';
    var info = document.getElementById('infoPino');
    if (info) info.style.display = '';
  }

  btnMedir.onclick = function () { ativo ? desligar() : ligar(); };
  document.getElementById('medFechar').onclick = desligar;
  btnDist.onclick = function () { modo = 'dist'; pintarAbas(); desenhar(); };
  btnArea.onclick = function () { modo = 'area'; pintarAbas(); desenhar(); };
  document.getElementById('medDesfazer').onclick = function () { pts.pop(); desenhar(); };
  document.getElementById('medLimpar').onclick = function () { if (apagando) modoApagar(false); pts = []; tituloImg = ''; desenhar(); };
  btnApagar.onclick = function () {
    if (!apagando && !pts.length) { aviso('Não há pontos para apagar.'); return; }
    modoApagar(!apagando);
  };
  btnCopiar.onclick = function () {
    if (!textoCopia || !window.copiarTexto) return;
    window.copiarTexto(textoCopia).then(function (ok) {
      btnCopiar.textContent = ok ? 'Copiado ✓' : 'Copiar';
      setTimeout(function () { btnCopiar.textContent = 'Copiar'; }, 2000);
    });
  };

  // ================= COMPARTILHAR COMO IMAGEM (recorte da medição + resultado + rosa dos ventos) =================
  // A imagem é montada à parte, sem copiar a tela: busca os tiles do recorte (mosaico de drone + Esri de fundo),
  // desenha a medição por cima e acrescenta uma faixa com os resultados. Assim não depende do que está na tela
  // e não esbarra no bloqueio de captura dos tiles do Google.
  var imgCache = null, gerando = false;
  var ROTULO_BTN = '📤 Compartilhar imagem';

  function aviso(t) { if (typeof avisarBusca === 'function') avisarBusca(t); }
  function rotuloBtn(t) { if (btnShare) btnShare.textContent = t || ROTULO_BTN; }

  function carregarImg(url, cors) {
    return new Promise(function (resolve) {
      var im = new Image(), fim = false;
      function acabou(v) { if (!fim) { fim = true; resolve(v); } }
      if (cors) im.crossOrigin = 'anonymous';   // se o servidor não permitir, falha limpo em vez de "sujar" a imagem
      im.onload = function () { acabou(im); };
      im.onerror = function () { acabou(null); };
      setTimeout(function () { acabou(null); }, 15000);
      im.src = url;
    });
  }

  var HALF_MERC = 20037508.342789244;
  function mundo20(c) {                      // coordenada do mapa (EPSG:3857) -> pixel do mundo no zoom 20
    var k = 256 * Math.pow(2, 20) / (2 * HALF_MERC);
    return [(c[0] + HALF_MERC) * k, (HALF_MERC - c[1]) * k];
  }

  function urlGoogle(lyrs, z, x, y) {
    return 'https://mt' + ((x + y) % 4) + '.google.com/vt/lyrs=' + lyrs + '&hl=pt-BR&x=' + x + '&y=' + y + '&z=' + z;
  }

  // ordem de desenho: base (Google satélite; Esri se o Google falhar) -> mosaico de drone -> nomes de ruas do Google
  function fontesDeImagem(opc) {
    var bases = [{
      nome: 'Google Satélite', min: 0, max: 20, cors: true,
      url: function (z, x, y) { return urlGoogle('s', z, x, y); }
    }, {
      nome: 'Esri World Imagery', min: 0, max: 18, cors: true,
      url: function (z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; }
    }];
    var drone = [];
    (typeof mosaicos !== 'undefined' ? mosaicos : []).forEach(function (m) {
      drone.push({
        nome: m.nome, min: m.minZoom, max: m.maxZoom, cors: false,
        url: function (z, x, y) { return MOSAICOS_BASE + m.pasta + '/' + z + '/' + x + '/' + (((1 << z) - 1) - y) + '.' + MOSAICOS_EXT; }
      });
    });
    var rotulos = [{
      nome: 'Nomes de ruas', min: 0, max: 20, cors: true, semCredito: true,
      reduz: (opc && opc.localizacao) ? 1 : 0,        // 1 nível abaixo = texto 2x maior (imagem de localização)
      reforco: !!(opc && opc.localizacao),            // desenha duas vezes: letras mais firmes sobre a foto
      url: function (z, x, y) { return urlGoogle('h', z, x, y); }
    }];
    return { bases: bases, drone: drone, rotulos: rotulos };
  }

  function prepararFonte(f, zt, bx0, bx1, by0, by1) {
    if (zt < f.min) return Promise.resolve({ f: f, T: 0, tiles: [] });
    var zn = Math.max(0, Math.min(f.max, zt - (f.reduz || 0)));
    var T = 256 * Math.pow(2, 20 - zn), n = Math.pow(2, zn);
    var x0 = Math.max(0, Math.floor(bx0 / T)), x1 = Math.min(n - 1, Math.floor(bx1 / T));
    var y0 = Math.max(0, Math.floor(by0 / T)), y1 = Math.min(n - 1, Math.floor(by1 / T));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 200) return Promise.resolve({ f: f, T: T, tiles: [] });
    var tarefas = [];
    for (var x = x0; x <= x1; x++) {
      for (var y = y0; y <= y1; y++) {
        tarefas.push((function (x, y) {
          return carregarImg(f.url(zn, x, y), f.cors).then(function (im) { return { im: im, x: x, y: y }; });
        })(x, y));
      }
    }
    return Promise.all(tarefas).then(function (tiles) { return { f: f, T: T, tiles: tiles }; });
  }

  // quadra em que a medição está (usa as funções da busca, se existirem)
  function quadraDaMedicao(pontos) {
    if (typeof camadasDeQuadras !== 'function' || typeof detectarCampo !== 'function') return null;
    var mx = 0, my = 0;
    pontos.forEach(function (p) { mx += p[0]; my += p[1]; });
    var cands = [[mx / pontos.length, my / pontos.length]].concat(pontos);
    var layers = camadasDeQuadras();
    for (var c = 0; c < cands.length; c++) {
      for (var li = 0; li < layers.length; li++) {
        var feats = layers[li].getSource().getFeatures();
        var campo = detectarCampo(feats);
        if (!campo) continue;
        for (var fi = 0; fi < feats.length; fi++) {
          var g = feats[fi].getGeometry();
          if (g && g.intersectsCoordinate && g.intersectsCoordinate(cands[c])) {
            var v = feats[fi].get(campo);
            if (v !== null && v !== undefined && VALORES_INVALIDOS.indexOf(String(v).trim()) < 0) return String(v).trim();
          }
        }
      }
    }
    return null;
  }

  // contorno (anéis) do polígono da quadra que contém a medição; null se a medição está fora das quadras
  function aneisDaQuadra(pontos) {
    if (typeof camadasDeQuadras !== 'function' || typeof detectarCampo !== 'function') return null;
    var mx = 0, my = 0;
    pontos.forEach(function (p) { mx += p[0]; my += p[1]; });
    var cands = [[mx / pontos.length, my / pontos.length]].concat(pontos);
    var layers = camadasDeQuadras();
    for (var c = 0; c < cands.length; c++) {
      for (var li = 0; li < layers.length; li++) {
        var feats = layers[li].getSource().getFeatures();
        var campo = detectarCampo(feats);
        if (!campo) continue;
        for (var fi = 0; fi < feats.length; fi++) {
          var g = feats[fi].getGeometry();
          if (!g || !g.intersectsCoordinate || !g.intersectsCoordinate(cands[c])) continue;
          var v = feats[fi].get(campo);
          if (v === null || v === undefined || VALORES_INVALIDOS.indexOf(String(v).trim()) >= 0) continue;
          var polys = g.getType() === 'MultiPolygon' ? g.getPolygons() : [g];
          var alvo = polys.filter(function (pg) { return pg.intersectsCoordinate(cands[c]); })[0] || polys[0];
          if (!alvo || !alvo.getCoordinates) continue;
          return alvo.getCoordinates().map(function (r) { return r.map(function (q) { return [q[0], q[1]]; }); });
        }
      }
    }
    return null;
  }

  // centróide do polígono (média ponderada pela área); devolve [lat, lon] ou null
  function centroideLatLon(pontos) {
    if (!pontos || pontos.length < 3) return null;
    var ox = pontos[0][0], oy = pontos[0][1], A = 0, cx = 0, cy = 0, n = pontos.length;
    for (var i = 0; i < n; i++) {
      var x0 = pontos[i][0] - ox, y0 = pontos[i][1] - oy;
      var x1 = pontos[(i + 1) % n][0] - ox, y1 = pontos[(i + 1) % n][1] - oy;
      var c = x0 * y1 - x1 * y0;
      A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    var m;
    if (Math.abs(A) < 1e-9) {                       // pontos alinhados: usa a média simples
      var sx = 0, sy = 0;
      pontos.forEach(function (p) { sx += p[0]; sy += p[1]; });
      m = [sx / n, sy / n];
    } else {
      m = [ox + cx / (3 * A), oy + cy / (3 * A)];
    }
    var ll = ol.proj.toLonLat(m);
    return [ll[1], ll[0]];
  }
  function fmtCentro(c) { return c[0].toFixed(6).replace('.', ',') + ', ' + c[1].toFixed(6).replace('.', ','); }
  function fmtCentroPonto(c) { return c[0].toFixed(6) + ', ' + c[1].toFixed(6); }   // formato que o Google Maps entende

  // >>> ruas-osm
  // Nomes de rua desenhados pelo próprio script (dados do OpenStreetMap): letra grande, sempre dentro da imagem,
  // acompanhando a direção da rua. Os tiles de rótulo do Google só entram se o OSM não responder.
  var osmCache = [];
  function mundo20Inv(x, y) {                           // pixel do mundo (zoom 20) -> [lon, lat]
    var N = 256 * Math.pow(2, 20), n = Math.PI - 2 * Math.PI * y / N;
    return [x / N * 360 - 180, 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
  }
  function pedirOverpass(url, q) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 9000);
    return fetch(url + '?data=' + encodeURIComponent(q), { signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(t); return j; }, function (e) { clearTimeout(t); throw e; });
  }
  function primeiroSucesso(ps) {
    return new Promise(function (res) {
      var falhas = 0;
      ps.forEach(function (p) {
        p.then(function (v) { if (v) res(v); else if (++falhas === ps.length) res(null); },
               function () { if (++falhas === ps.length) res(null); });
      });
    });
  }
  async function buscarRuasOSM(bx0, bx1, by0, by1) {
    try {
      var a = mundo20Inv(bx0, by1), b = mundo20Inv(bx1, by0);
      var w = a[0], s = a[1], e = b[0], n = b[1];
      if (n - s > 0.06 || e - w > 0.06) return null;                      // área grande demais para consultar
      for (var i = 0; i < osmCache.length; i++) {                          // já buscado (o zoom muda o recorte, não a região)
        var c = osmCache[i];
        if (c.w <= w && c.s <= s && c.e >= e && c.n >= n) return c.ruas;
      }
      var mx = (e - w) * 0.35, my = (n - s) * 0.35;                        // busca com folga para absorver ajustes de zoom
      var W2 = w - mx, S2 = s - my, E2 = e + mx, N2 = n + my;
      var q = '[out:json][timeout:12];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service)$"]["name"](' +
        [S2, W2, N2, E2].map(function (x) { return x.toFixed(6); }).join(',') + ');out geom;';
      var json = await primeiroSucesso(['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
        .map(function (u) { return pedirOverpass(u, q); }));
      if (!json || !json.elements) return null;
      var ruas = json.elements.filter(function (el) { return el.geometry && el.geometry.length > 1 && el.tags && el.tags.name; })
        .map(function (el) { return { nome: el.tags.name, pts: el.geometry.map(function (g) { return [g.lon, g.lat]; }) }; });
      osmCache.push({ w: W2, s: S2, e: E2, n: N2, ruas: ruas });
      return ruas;
    } catch (err) { console.warn('Ruas (OpenStreetMap):', err); return null; }
  }
  function abreviarRua(n) {
    var t = String(n).trim();
    [[/^Rua /i, 'R. '], [/^Avenida /i, 'Av. '], [/^Travessa /i, 'Tv. '], [/^Alameda /i, 'Al. '], [/^Praça /i, 'Pç. '], [/^Rodovia /i, 'Rod. '], [/^Estrada /i, 'Est. '],
     [/\bCoronel\b/g, 'Cel.'], [/\bDoutor\b/g, 'Dr.'], [/\bDoutora\b/g, 'Dra.'], [/\bProfessor\b/g, 'Prof.'], [/\bProfessora\b/g, 'Profa.'],
     [/\bVisconde\b/g, 'Visc.'], [/\bPresidente\b/g, 'Pres.'], [/\bGeneral\b/g, 'Gen.'], [/\bMajor\b/g, 'Maj.'], [/\bCapitão\b/g, 'Cap.'],
     [/\bSenador\b/g, 'Sen.'], [/\bEngenheiro\b/g, 'Eng.'], [/\bTenente\b/g, 'Ten.'], [/\bPadre\b/g, 'Pe.']
    ].forEach(function (r) { t = t.replace(r[0], r[1]); });
    return t;
  }
  function desenharRuasOSM(ctx, ruas, toImg, W, Hm, k) {
    var FONTE = 'Arial, Helvetica, sans-serif', fsBase = Math.round(W * 0.03);
    var DR = Math.round(W * 0.17);
    var occ = [{ x: W - DR / 2 - 12 * k, y: DR / 2 + 12 * k, r: DR * 0.55 }];   // rosa dos ventos
    var nomes = {};
    ruas.forEach(function (r) {
      var poly = r.pts.map(function (p) { return toImg(mundo20(ol.proj.fromLonLat(p))); });
      var nome = abreviarRua(r.nome);
      (nomes[nome] = nomes[nome] || []).push(poly);
    });
    function compPoly(poly) { var c = 0; for (var i = 1; i < poly.length; i++) c += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); return c; }
    function compNome(n) { return nomes[n].reduce(function (s, p) { return s + compPoly(p); }, 0); }
    var lista = Object.keys(nomes).sort(function (a, b) { return compNome(b) - compNome(a); });

    function livre(circs) {
      for (var i = 0; i < circs.length; i++) {
        var c = circs[i];
        for (var j = 0; j < occ.length; j++) {
          var o = occ[j], dx = c.x - o.x, dy = c.y - o.y;
          if (dx * dx + dy * dy < (c.r + o.r) * (c.r + o.r)) return false;
        }
      }
      return true;
    }
    function candidatos(polys, tw, fs) {
      var m = fs * 0.8, out = [];
      function dentro(p) { return p[0] >= m && p[0] <= W - m && p[1] >= m && p[1] <= Hm - m; }
      polys.forEach(function (poly) {
        var cum = [0];
        for (var i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
        var total = cum[cum.length - 1];
        if (total < tw * 1.05) return;
        function em(d) {
          var i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          var seg = cum[i] - cum[i - 1] || 1, f = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
          return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * f, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * f];
        }
        for (var d = tw / 2; d <= total - tw / 2; d += Math.max(6, tw * 0.25)) {
          var a = em(d - tw / 2), b = em(d + tw / 2), c = em(d);
          if (!dentro(a) || !dentro(b) || !dentro(c)) continue;
          var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), reta = true;
          for (var u = 1; u < 4 && reta; u++) {                    // trecho tem que ser quase reto
            var p = em(d - tw / 2 + u * tw / 4);
            var dev = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
            if (dev > 0.07 * tw) reta = false;
          }
          if (reta) out.push({ x: c[0], y: c[1], ang: ang });
        }
      });
      out.sort(function (p, q) { return Math.hypot(p.x - W / 2, p.y - Hm / 2) - Math.hypot(q.x - W / 2, q.y - Hm / 2); });   // as mais centrais primeiro
      return out;
    }
    var colocados = {};
    function tentar(nome, fs, quantos, esp) {
      ctx.font = 'bold ' + fs + 'px ' + FONTE;
      var tw = ctx.measureText(nome).width, feitos = colocados[nome] = colocados[nome] || [], n = 0;
      var cands = candidatos(nomes[nome], tw, fs);
      for (var ci = 0; ci < cands.length && n < quantos; ci++) {
        var c = cands[ci], longe = true;
        for (var h = 0; h < feitos.length; h++) if (Math.hypot(feitos[h].x - c.x, feitos[h].y - c.y) < esp) { longe = false; break; }
        if (!longe) continue;
        var qtd = Math.max(1, Math.round(tw / (fs * 0.7))), cs = [], cosA = Math.cos(c.ang), sinA = Math.sin(c.ang);
        for (var u = 0; u < qtd; u++) { var t = (u + 0.5) / qtd * tw - tw / 2; cs.push({ x: c.x + t * cosA, y: c.y + t * sinA, r: fs * 0.62 }); }
        if (!livre(cs)) continue;
        cs.forEach(function (x) { occ.push(x); });
        feitos.push({ x: c.x, y: c.y });
        var ang = c.ang;
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;   // texto sempre de pé
        ctx.save();
        ctx.translate(c.x, c.y); ctx.rotate(ang);
        ctx.font = 'bold ' + fs + 'px ' + FONTE;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7 * k; ctx.strokeStyle = 'rgba(0,0,0,0.88)'; ctx.strokeText(nome, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillText(nome, 0, 0);
        ctx.restore();
        n++;
      }
      return n;
    }
    [1, 0.78].forEach(function (esc) {                      // 1ª rodada: cada rua ganha ao menos um nome (se não couber, tenta menor)
      lista.forEach(function (nome) { if (!(colocados[nome] && colocados[nome].length)) tentar(nome, Math.round(fsBase * esc), 1, 0); });
    });
    lista.forEach(function (nome) {                         // 2ª rodada: repete o nome em ruas longas, bem espaçado
      if (colocados[nome] && colocados[nome].length) tentar(nome, fsBase, 2, Math.max(W * 0.45, fsBase * 9));
    });
  }
  // <<< ruas-osm

  async function montarImagem(pontos, modoUsado, opc) {
    var loc = !!(opc && opc.localizacao);                 // 2ª imagem: a área medida dentro do enquadramento da quadra
    var rot = map.getView().getRotation() || 0;          // a imagem sai com a mesma orientação do mapa na tela
    var cos = Math.cos(rot), sin = Math.sin(rot);
    var P = pontos.map(mundo20);
    var area = modoUsado === 'area' && pontos.length >= 3;

    // caixa que envolve a medição (no plano já girado), com margem
    var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    (opc && opc.enquadrar ? opc.enquadrar.map(mundo20) : P).forEach(function (p) {
      var qx = p[0] * cos - p[1] * sin, qy = p[0] * sin + p[1] * cos;
      if (qx < minx) minx = qx;
      if (qx > maxx) maxx = qx;
      if (qy < miny) miny = qy;
      if (qy > maxy) maxy = qy;
    });
    var w = maxx - minx, h = maxy - miny;
    var pad = Math.max(0.18 * Math.max(w, h), 90);
    var w2 = w + 2 * pad, h2 = h + 2 * pad;
    if (h2 > w2) w2 = h2;                                // no mínimo quadrada
    if (h2 < 0.55 * w2) h2 = 0.55 * w2;                  // e não muito achatada
    var qcx = (minx + maxx) / 2, qcy = (miny + maxy) / 2;

    // zoom escolhido pelo usuário (fator > 1 afasta, < 1 aproxima); nunca corta a medição
    var fz = (opc && opc.zoom) || 1;
    if (fz !== 1) {
      var m0x = Infinity, m1x = -Infinity, m0y = Infinity, m1y = -Infinity;
      P.forEach(function (p) {
        var rx = p[0] * cos - p[1] * sin, ry = p[0] * sin + p[1] * cos;
        if (rx < m0x) m0x = rx; if (rx > m1x) m1x = rx;
        if (ry < m0y) m0y = ry; if (ry > m1y) m1y = ry;
      });
      w2 *= fz; h2 *= fz;
      var esc = Math.max(1, (m1x - m0x) * 1.12 / w2, (m1y - m0y) * 1.12 / h2);
      w2 *= esc; h2 *= esc;
      var ajusta = function (c, tam, a, b) {          // desloca o centro só o suficiente para a medição caber
        var lo = a - 0.06 * tam, hi = b + 0.06 * tam;
        if (hi - lo >= tam) return (a + b) / 2;
        if (c - tam / 2 > lo) c = lo + tam / 2;
        if (c + tam / 2 < hi) c = hi - tam / 2;
        return c;
      };
      qcx = ajusta(qcx, w2, m0x, m1x); qcy = ajusta(qcy, h2, m0y, m1y);
    }
    var Cx = qcx * cos + qcy * sin, Cy = -qcx * sin + qcy * cos;   // centro da imagem no mundo (zoom 20)

    var W = 1080, S = W / w2, Hm = Math.round(h2 * S), F = Math.round(W * (area ? 0.245 : 0.19));
    var tit = ((opc && opc.titulo) || '').trim(), FT = tit ? Math.round(W * 0.085) : 0;   // faixa extra só quando há título
    var k = W / 900;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = Hm + FT + F;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, W, Hm);

    // tiles que cobrem a imagem (mesmo girada)
    var zt = Math.max(8, Math.min(20, Math.ceil(20 + Math.log(S) / Math.LN2 - 0.05)));
    var cantos = [[0, 0], [W, 0], [0, Hm], [W, Hm]].map(function (c) {
      var dx = c[0] - W / 2, dy = c[1] - Hm / 2;
      return [Cx + (dx * cos + dy * sin) / S, Cy + (-dx * sin + dy * cos) / S];
    });
    var bx0 = Math.min.apply(null, cantos.map(function (c) { return c[0]; })), bx1 = Math.max.apply(null, cantos.map(function (c) { return c[0]; }));
    var by0 = Math.min.apply(null, cantos.map(function (c) { return c[1]; })), by1 = Math.max.apply(null, cantos.map(function (c) { return c[1]; }));

    var rosaP = carregarImg(window.ROSA_SVG_URL, false);
    var osmP = loc ? buscarRuasOSM(bx0, bx1, by0, by1) : Promise.resolve(null);   // nomes de rua (só na imagem de localização)
    var fontes = fontesDeImagem(opc);
    var camadas = [];
    for (var bi = 0; bi < fontes.bases.length; bi++) {          // Google primeiro; se não carregar nada, cai para a Esri
      var cb = await prepararFonte(fontes.bases[bi], zt, bx0, bx1, by0, by1);
      if (cb.tiles.some(function (t) { return t.im; })) { camadas.push(cb); break; }
      console.warn('Sem imagens de', fontes.bases[bi].nome, '- tentando a próxima fonte.');
    }
    var ruasOSM = await osmP, usaOSM = !!(ruasOSM && ruasOSM.length);
    camadas = camadas.concat(await Promise.all(fontes.drone.concat(usaOSM ? [] : fontes.rotulos).map(function (f) { return prepararFonte(f, zt, bx0, bx1, by0, by1); })));
    var rosa = await rosaP;

    // desenha os tiles em coordenadas relativas ao centro (evita perder precisão com números enormes)
    var usados = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, Hm); ctx.clip();
    ctx.setTransform(S * cos, S * sin, -S * sin, S * cos, W / 2, Hm / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    camadas.forEach(function (cam) {
      var ov = 0.75 / S, algum = false, passes = cam.f.reforco ? 2 : 1;
      cam.tiles.forEach(function (t) {
        if (!t.im) return;
        algum = true;
        for (var pz = 0; pz < passes; pz++) ctx.drawImage(t.im, t.x * cam.T - Cx, t.y * cam.T - Cy, cam.T + ov, cam.T + ov);
      });
      if (algum && !cam.f.semCredito) usados.push(cam.f.nome);
    });
    ctx.restore();

    // medição por cima (no plano da imagem, sempre com texto em pé)
    function toImg(p) {
      var dx = p[0] - Cx, dy = p[1] - Cy;
      return [W / 2 + S * (dx * cos - dy * sin), Hm / 2 + S * (dx * sin + dy * cos)];
    }
    var Q = P.map(toImg);
    if (usaOSM) desenharRuasOSM(ctx, ruasOSM, toImg, W, Hm, k);     // nomes das ruas por baixo do contorno e da medição
    if (opc && opc.contorno) {                            // contorno da quadra (amarelo com halo branco, como no mapa)
      ctx.lineJoin = 'round';
      function trilhaAnel(anel) {
        ctx.beginPath();
        anel.forEach(function (c, i) { var q = toImg(mundo20(c)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.closePath();
      }
      opc.contorno.forEach(function (anel) { trilhaAnel(anel); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9 * k; ctx.stroke(); });
      opc.contorno.forEach(function (anel) { trilhaAnel(anel); ctx.strokeStyle = '#ffea00'; ctx.lineWidth = 4.5 * k; ctx.stroke(); });
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function trilha() {
      ctx.beginPath();
      Q.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      if (area) ctx.closePath();
    }
    if (Q.length >= 2) {
      trilha(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8 * k; ctx.stroke();
      trilha();
      if (area) { ctx.fillStyle = 'rgba(233,30,99,' + (loc ? 0.42 : 0.18) + ')'; ctx.fill(); }
      ctx.strokeStyle = COR; ctx.lineWidth = 4 * k; ctx.stroke();
    }
    if (!loc) Q.forEach(function (q) {
      ctx.beginPath(); ctx.arc(q[0], q[1], 7 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 4 * k; ctx.strokeStyle = COR; ctx.stroke();
    });

    // medida de cada lado: o texto acompanha a direção da linha (sempre de pé, nunca de cabeça para baixo).
    // Nenhuma medida some: se o lado é curto o texto encolhe; se ainda não cabe, vai para fora com uma linha-guia;
    // e os textos evitam ficar uns sobre os outros, sobre os pontos e sobre a rosa dos ventos.
    var fsL = Math.round(W * 0.026), fsMin = Math.round(W * 0.016);
    var FONTE = 'Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var nSeg = loc ? 0 : (area ? Q.length : Q.length - 1);     // na imagem de localização não há medidas de lado
    function dentroDaFigura(x, y) {                       // ponto dentro do polígono? (para colocar o texto do lado de fora)
      var dentro = false;
      for (var m = 0, n = Q.length, j = n - 1; m < n; j = m++) {
        if ((Q[m][1] > y) !== (Q[j][1] > y) &&
            x < (Q[j][0] - Q[m][0]) * (y - Q[m][1]) / (Q[j][1] - Q[m][1]) + Q[m][0]) dentro = !dentro;
      }
      return dentro;
    }
    var DR = Math.round(W * 0.17), rosaX = W - DR / 2 - 12 * k, rosaY = DR / 2 + 12 * k;
    var ocupado = [{ x: rosaX, y: rosaY, r: DR * 0.5 }];            // áreas que o texto deve evitar
    Q.forEach(function (q) { ocupado.push({ x: q[0], y: q[1], r: 11 * k }); });
    function livre(circs) {
      for (var ci = 0; ci < circs.length; ci++) {
        var c = circs[ci];
        if (c.x < c.r || c.x > W - c.r || c.y < c.r || c.y > Hm - c.r) return false;
        for (var oi = 0; oi < ocupado.length; oi++) {
          var o = ocupado[oi], ex = c.x - o.x, ey = c.y - o.y;
          if (ex * ex + ey * ey < (c.r + o.r) * (c.r + o.r)) return false;
        }
      }
      return true;
    }
    var lados = [];
    for (var i = 0; i < nSeg; i++) {
      var a = Q[i], b = Q[(i + 1) % Q.length];
      var ddx = b[0] - a[0], ddy = b[1] - a[1], comp = Math.sqrt(ddx * ddx + ddy * ddy);
      if (comp < 2) continue;                              // dois pontos praticamente no mesmo lugar
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var nx = -ddy / comp, ny = ddx / comp;              // perpendicular à linha
      if (area) {
        if (dentroDaFigura(mx + nx * 4 * k, my + ny * 4 * k)) { nx = -nx; ny = -ny; }   // aponta para fora
      } else if (ny > 0) { nx = -nx; ny = -ny; }          // medida de distância: texto acima da linha
      var ang = Math.atan2(ddy, ddx);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;   // texto sempre legível
      lados.push({ comp: comp, mx: mx, my: my, nx: nx, ny: ny, ang: ang,
                   txt: fmtDist(distancia(pontos[i], pontos[(i + 1) % pontos.length])) });
    }
    lados.sort(function (p, q) { return q.comp - p.comp; });   // os lados maiores escolhem o lugar primeiro
    lados.forEach(function (L) {
      var fs = fsL;
      ctx.font = 'bold ' + fs + 'px ' + FONTE;
      var tw = ctx.measureText(L.txt).width, disp = L.comp * 0.9;
      if (tw > disp) {                                    // lado curto: encolhe o texto (até o mínimo legível)
        fs = Math.max(fsMin, Math.floor(fsL * disp / tw));
        ctx.font = 'bold ' + fs + 'px ' + FONTE;
        tw = ctx.measureText(L.txt).width;
      }
      var cosA = Math.cos(L.ang), sinA = Math.sin(L.ang);
      var passo = fs * 0.7, qtd = Math.max(1, Math.round(tw / passo));
      function circulos(tx, ty) {
        var cs = [];
        for (var u = 0; u < qtd; u++) {
          var t = (u + 0.5) / qtd * tw - tw / 2;
          cs.push({ x: tx + t * cosA, y: ty + t * sinA, r: fs * 0.55 });
        }
        return cs;
      }
      var escolha = null, mults = [0.85, 1.9, 3, 4.2], primeira = null;
      for (var mi = 0; mi < mults.length && !escolha; mi++) {
        for (var lado = 1; lado >= -1 && !escolha; lado -= 2) {
          var d = fs * mults[mi] * lado;
          var cand = { x: L.mx + L.nx * d, y: L.my + L.ny * d, guia: mi > 0 };
          if (!primeira && (tw <= disp || mi > 0)) primeira = cand;
          if (livre(circulos(cand.x, cand.y))) escolha = cand;
        }
      }
      if (!escolha) escolha = primeira || { x: L.mx + L.nx * fs * 0.85, y: L.my + L.ny * fs * 0.85, guia: false };
      circulos(escolha.x, escolha.y).forEach(function (c) { ocupado.push(c); });
      if (escolha.guia) {                                 // linha-guia do meio do lado até o texto
        var gx = escolha.x - L.nx * fs * 0.5 * Math.sign((escolha.x - L.mx) * L.nx + (escolha.y - L.my) * L.ny || 1);
        var gy = escolha.y - L.ny * fs * 0.5 * Math.sign((escolha.x - L.mx) * L.nx + (escolha.y - L.my) * L.ny || 1);
        ctx.beginPath(); ctx.moveTo(L.mx, L.my); ctx.lineTo(gx, gy);
        ctx.lineWidth = 4 * k; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.lineWidth = 1.6 * k; ctx.strokeStyle = '#000000'; ctx.stroke();
      }
      ctx.save();
      ctx.translate(escolha.x, escolha.y); ctx.rotate(L.ang);
      ctx.font = 'bold ' + fs + 'px ' + FONTE;
      ctx.lineWidth = 6 * k; ctx.strokeStyle = '#ffffff'; ctx.strokeText(L.txt, 0, 0);
      ctx.fillStyle = '#000000'; ctx.fillText(L.txt, 0, 0);
      ctx.restore();
    });

    // rosa dos ventos no canto superior direito, sem fundo; um brilho branco suave destaca as letras sobre a foto
    if (rosa) {
      var D = DR, rx = rosaX, ry = rosaY;
      ctx.save();
      ctx.translate(rx, ry); ctx.rotate(rot);
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = 9 * k;
      ctx.drawImage(rosa, -D / 2, -D / 2, D, D);
      ctx.drawImage(rosa, -D / 2, -D / 2, D, D);        // segunda passada reforça o brilho
      ctx.restore();
    }

    // créditos das imagens de fundo
    if (usados.length || usaOSM) {
      var cred = (usados.length ? 'Imagens: ' + usados.join(' + ') : '') + (usaOSM ? (usados.length ? ' · ' : '') + 'Ruas: © OpenStreetMap' : '');
      var fsC = Math.round(W * 0.016);
      ctx.font = fsC + 'px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      var cw = ctx.measureText(cred).width;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(W - cw - 18, Hm - fsC - 14, cw + 18, fsC + 14);
      ctx.fillStyle = '#333333';
      ctx.fillText(cred, W - 9, Hm - 8);
    }

    // faixa com os resultados
    var l1, l2;
    if (area) {
      var per = 0;
      for (var j = 0; j < pontos.length; j++) per += distancia(pontos[j], pontos[(j + 1) % pontos.length]);
      l1 = 'Área: ' + fmtArea(areaEsferica(pontos));
      l2 = 'Perímetro: ' + fmtDist(per) + ' · ' + pontos.length + ' pontos';
    } else {
      var tot = 0;
      for (var j2 = 0; j2 < pontos.length - 1; j2++) tot += distancia(pontos[j2], pontos[j2 + 1]);
      l1 = 'Distância: ' + fmtDist(tot);
      l2 = pontos.length + ' pontos';
    }
    var q = quadraDaMedicao(pontos);
    var data = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var l3 = (q ? 'Quadra ' + q + '  ·  ' : '') + data;
    if (loc) {                                          // faixa da imagem de localização
      l2 = l1 + '  ·  ' + l2.replace(/\s*·\s*\d+ pontos$/, '');
      l1 = 'Localização na quadra' + (q ? ' ' + q : '');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, Hm, W, F + FT);
    ctx.fillStyle = COR;
    ctx.fillRect(0, Hm, W, 5 * k);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var pl = Math.round(W * 0.035);
    if (tit) {                                            // título escolhido pelo usuário (encolhe/abrevia se for longo)
      var fsT = Math.round(W * 0.05), maxT = W - 2 * pl, FONTE_T = 'Arial, Helvetica, sans-serif';
      ctx.font = 'bold ' + fsT + 'px ' + FONTE_T;
      while (ctx.measureText(tit).width > maxT && fsT > W * 0.03) { fsT -= 2; ctx.font = 'bold ' + fsT + 'px ' + FONTE_T; }
      var tt = tit;
      if (ctx.measureText(tt).width > maxT) {
        while (tt.length > 1 && ctx.measureText(tt + '…').width > maxT) tt = tt.slice(0, -1);
        tt = tt.replace(/\s+$/, '') + '…';
      }
      ctx.fillStyle = '#111111';
      ctx.fillText(tt, pl, Hm + FT * 0.68);
      ctx.fillStyle = '#e3e3e3';
      ctx.fillRect(pl, Hm + FT - 2 * k, W - 2 * pl, 1.5 * k);
    }
    var centro = area ? centroideLatLon(pontos) : null;
    var linhas = centro ? [0.29, 0.49, 0.68, 0.89] : [0.36, 0.62, 0.86];
    ctx.fillStyle = '#111111';
    ctx.font = 'bold ' + Math.round(W * 0.04) + 'px Arial, Helvetica, sans-serif';
    ctx.fillText(l1, pl, Hm + FT + F * linhas[0]);
    ctx.fillStyle = '#222222';
    ctx.font = Math.round(W * 0.028) + 'px Arial, Helvetica, sans-serif';
    ctx.fillText(l2, pl, Hm + FT + F * linhas[1]);
    if (centro) {
      ctx.fillText('Centro: ' + fmtCentro(centro), pl, Hm + FT + F * linhas[2]);
    }
    ctx.fillStyle = '#666666';
    ctx.font = Math.round(W * 0.023) + 'px Arial, Helvetica, sans-serif';
    ctx.fillText(l3, pl, Hm + FT + F * linhas[linhas.length - 1]);

    return await new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('imagem vazia')); }, 'image/png');
      } catch (e) { reject(e); }
    });
  }

  function chaveAtual() {
    return modo + '|' + (map.getView().getRotation() || 0).toFixed(4) + '|' +
      pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(';');
  }

  function baixar(blob, nome) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome || 'medicao-quadra.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // ---------- KML (Google Earth / Google Maps / QGIS): a área (ou linha) medida + contorno da quadra ----------
  function slug(t) {
    try { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); }
    catch (e) { return ''; }
  }
  function escXml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function coordsKml(lista, fechar) {
    var cs = lista.map(function (p) { var ll = ol.proj.toLonLat(p); return ll[0].toFixed(7) + ',' + ll[1].toFixed(7) + ',0'; });
    if (fechar && cs.length) cs.push(cs[0]);
    return cs.join(' ');
  }
  function gerarKml(pontos, modoUsado, texto, quadra, aneis, titulo) {
    var area = modoUsado === 'area' && pontos.length >= 3;
    var nome = titulo || ((area ? 'Área medida' : 'Distância medida') + (quadra ? ' - Quadra ' + quadra : ''));
    var x = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n' +
      '<name>' + escXml(nome) + '</name>\n' +
      '<Style id="medida"><LineStyle><color>ff631ee9</color><width>3</width></LineStyle><PolyStyle><color>66631ee9</color></PolyStyle></Style>\n' +
      '<Style id="quadra"><LineStyle><color>ff00eaff</color><width>3</width></LineStyle></Style>\n';
    if (area) {
      x += '<Placemark><name>' + escXml(nome) + '</name><description>' + escXml(texto) + '</description><styleUrl>#medida</styleUrl>' +
        '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + coordsKml(pontos, true) +
        '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n';
      var cc = centroideLatLon(pontos);
      if (cc) x += '<Placemark><name>Centro</name><description>' + escXml(fmtCentroPonto(cc)) + '</description><Point><coordinates>' +
        cc[1].toFixed(7) + ',' + cc[0].toFixed(7) + ',0</coordinates></Point></Placemark>\n';
    } else {
      x += '<Placemark><name>' + escXml(nome) + '</name><description>' + escXml(texto) + '</description><styleUrl>#medida</styleUrl>' +
        '<LineString><tessellate>1</tessellate><coordinates>' + coordsKml(pontos, false) + '</coordinates></LineString></Placemark>\n';
    }
    if (aneis && aneis[0]) {
      x += '<Placemark><name>' + escXml('Quadra ' + (quadra || '')) + '</name><styleUrl>#quadra</styleUrl>' +
        '<LineString><tessellate>1</tessellate><coordinates>' + coordsKml(aneis[0], true) + '</coordinates></LineString></Placemark>\n';
    }
    return x + '</Document></kml>\n';
  }

  // ---------- salvar a medição em "Minhas marcações" (painel do 15-camadas-marcacoes.js) ----------
  var salvaRef = null;                                   // última marcação criada a partir desta medição
  function textoMedicao(ps, md) {
    if (md === 'area' && ps.length >= 3) {
      var per = 0;
      for (var k = 0; k < ps.length; k++) per += distancia(ps[k], ps[(k + 1) % ps.length]);
      var t = 'Área: ' + fmtArea(areaEsferica(ps)) + ' | Perímetro: ' + fmtDist(per);
      var c = centroideLatLon(ps);
      if (c) t += ' | Centro: ' + fmtCentroPonto(c);
      return t;
    }
    var tot = 0;
    for (var j = 0; j < ps.length - 1; j++) tot += distancia(ps[j], ps[j + 1]);
    return 'Distância: ' + fmtDist(tot);
  }
  function salvarMarcacao(ps, md, titulo, editar) {
    var MQ = window.MQ;
    if (!MQ || !MQ.fonte) { aviso('O painel "Minhas marcações" não está carregado.'); return false; }
    var area = md === 'area' && ps.length >= 3;
    if (!area && ps.length < 2) { aviso('Marque ao menos 2 pontos para salvar.'); return false; }
    var chave = md + '|' + ps.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(';');
    var existente = salvaRef && salvaRef.chave === chave && MQ.fonte.getFeatures().indexOf(salvaRef.f) >= 0 ? salvaRef.f : null;
    if (existente) {                                     // mesma medição já salva: só atualiza o nome, não duplica
      if (titulo) existente.set('name', titulo);
      if (MQ.atualizar) MQ.atualizar();
      aviso('📌 Marcação atualizada em Minhas marcações');
      return true;
    }
    var q = quadraDaMedicao(ps), resumo = textoMedicao(ps, md);
    var nome = titulo || (resumo.split(' | ')[0].replace(':', '') + (q ? ' · Quadra ' + q : ''));
    var geom = area ? new ol.geom.Polygon([ps.concat([ps[0]]).map(function (p) { return [p[0], p[1]]; })])
                    : new ol.geom.LineString(ps.map(function (p) { return [p[0], p[1]]; }));
    var props = { name: nome, description: resumo + (q ? ' | Quadra ' + q : ''), medidas: true };   // já aparece com as medidas no mapa
    var f;
    if (MQ.adicionar) f = MQ.adicionar(geom, props, !!editar);
    else {                                               // versão antiga do 15-camadas-marcacoes.js
      f = new ol.Feature(geom);
      f.setId('m' + Date.now().toString(36));
      props.color = '#e53935'; props.visible = true; props.created = new Date().toISOString();
      f.setProperties(props);
      MQ.fonte.addFeature(f);
    }
    salvaRef = { chave: chave, f: f };
    aviso('📌 Salvo em Minhas marcações');
    return true;
  }
  btnSalvar.onclick = function () {
    if (!textoCopia) { aviso(modo === 'dist' ? 'Marque ao menos 2 pontos para salvar.' : 'Marque ao menos 3 pontos para salvar.'); return; }
    var t = tituloImg.trim();
    salvarMarcacao(pts.slice(), modo, t, !t);            // sem título: abre a marcação já em edição para dar o nome
  };

  // ---------- impressão: uma imagem por folha A4 ----------
  function imprimir(lista) {
    var urlsP = lista.map(function (i) { return URL.createObjectURL(i.blob); });
    var ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    ifr.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><title>Medição</title><style>' +
      '@page{size:A4 portrait;margin:10mm}html,body{margin:0;padding:0}' +
      '.p{text-align:center;break-after:page;page-break-after:always}.p:last-child{break-after:auto;page-break-after:auto}' +
      'img{max-width:100%;max-height:270mm;object-fit:contain}</style></head><body>' +
      urlsP.map(function (u) { return '<div class="p"><img src="' + u + '"></div>'; }).join('') + '</body></html>';
    function limpar() { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); urlsP.forEach(function (u) { URL.revokeObjectURL(u); }); }
    ifr.onload = function () {
      var w = ifr.contentWindow;
      var espera = Array.prototype.map.call(w.document.images, function (im) {
        return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
      });
      Promise.all(espera).then(function () { w.focus(); w.print(); });
    };
    document.body.appendChild(ifr);
    setTimeout(limpar, 180000);
  }

  // painel de pré-visualização: cada botão é um clique novo, então o navegador sempre permite copiar/salvar
  // imagens: [{ blob, arquivo, rotulo }, ...]   kml: { gerar(titulo) -> { blob, arquivo } }
  // opc: { passo, titulo, regerar(passo, titulo) -> Promise<imagens>, salvar(titulo) -> bool }
  function mostrarPrevia(imagens, texto, kml, opc) {
    var urls = [], arquivos = [], atual = 0, token = 0, nAbas = imagens.length;
    var passoAtual = opc.passo, tituloAtual = opc.titulo || '';
    function titulo() { return tituloAtual.trim(); }
    function textoFinal() { return (titulo() ? titulo() + '\n' : '') + texto; }
    function carregar(lista) {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      imagens = lista;
      urls = lista.map(function (i) { return URL.createObjectURL(i.blob); });
      arquivos = lista.map(function (i) { return new File([i.blob], i.arquivo, { type: 'image/png' }); });
      if (atual >= lista.length) atual = 0;
    }
    carregar(imagens);
    var fundo = document.createElement('div');
    fundo.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px';
    var cx = document.createElement('div');
    cx.style.cssText = 'background:#fff;border-radius:10px;padding:12px;max-width:min(560px,100%);max-height:100%;overflow:auto;font:14px sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5)';
    var abas = document.createElement('div');
    abas.style.cssText = 'display:flex;gap:6px;margin-bottom:8px';
    var img = document.createElement('img');
    img.src = urls[0];
    img.style.cssText = 'display:block;max-width:100%;max-height:48vh;margin:0 auto 10px;border-radius:6px;transition:opacity .15s';
    var msg = document.createElement('div');
    msg.style.cssText = 'min-height:18px;color:#555;font-size:13px;margin-bottom:8px;text-align:center';
    var linha = document.createElement('div');
    linha.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    var botoesAba = [];
    function escolherAba(n) {
      if (!imagens[n]) return;
      atual = n; img.src = urls[n]; msg.textContent = '';
      botoesAba.forEach(function (b, i) {
        b.style.background = i === n ? '#e91e63' : '#eee';
        b.style.color = i === n ? '#fff' : '#222';
      });
    }
    if (nAbas > 1) {
      imagens.forEach(function (im, i) {
        var b = document.createElement('button');
        b.textContent = im.rotulo;
        b.style.cssText = 'flex:1;padding:8px 6px;border:0;border-radius:6px;font-size:13px;cursor:pointer';
        b.onclick = function () { escolherAba(i); };
        abas.appendChild(b); botoesAba.push(b);
      });
      escolherAba(0);
      cx.appendChild(abas);
    }
    function fechar() { token++; clearTimeout(tUpd); urls.forEach(function (u) { URL.revokeObjectURL(u); }); document.body.removeChild(fundo); }
    function botao(rotulo, cor, fn) {
      var bt = document.createElement('button');
      bt.textContent = rotulo;
      bt.style.cssText = 'flex:1;min-width:110px;padding:10px 8px;border:0;border-radius:6px;font-size:14px;cursor:pointer;background:' + cor + ';color:' + (cor === '#eee' ? '#222' : '#fff');
      bt.onclick = fn;
      linha.appendChild(bt);
      return bt;
    }

    // refaz as imagens quando muda o zoom ou o título (agrupa pedidos seguidos)
    var tUpd = null;
    function pedirAtualizacao(atraso) {
      clearTimeout(tUpd);
      tUpd = setTimeout(async function () {
        var meu = ++token;
        msg.textContent = 'Atualizando…';
        img.style.opacity = '.45';
        try {
          var lista = await opc.regerar(passoAtual, titulo());
          if (meu !== token) return;                       // chegou um pedido mais novo
          carregar(lista);
          img.src = urls[atual];
          msg.textContent = '';
        } catch (e) {
          console.warn('Atualização da imagem:', e);
          if (meu === token) msg.textContent = 'Não foi possível atualizar a imagem.';
        } finally {
          if (meu === token) img.style.opacity = '1';
        }
      }, atraso);
    }
    cx.appendChild(img);

    // --- zoom do enquadramento (vale para as duas imagens) ---
    var zl = document.createElement('div');
    zl.style.cssText = 'display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:13px;color:#333';
    var BZ = 'width:30px;height:30px;border:0;border-radius:6px;background:#eee;font-size:18px;line-height:1;cursor:pointer;flex:none';
    var bMenos = document.createElement('button'); bMenos.textContent = '−'; bMenos.setAttribute('aria-label', 'Afastar'); bMenos.style.cssText = BZ;
    var bMais = document.createElement('button'); bMais.textContent = '+'; bMais.setAttribute('aria-label', 'Aproximar'); bMais.style.cssText = BZ;
    var rng = document.createElement('input');
    rng.type = 'range'; rng.min = -10; rng.max = 10; rng.step = 1; rng.value = passoAtual;
    rng.style.cssText = 'flex:1;min-width:0';
    var bPad = document.createElement('button'); bPad.textContent = 'Padrão';
    bPad.style.cssText = 'padding:0 8px;height:30px;border:0;border-radius:6px;background:#eee;font-size:12px;cursor:pointer;flex:none';
    var rotZ = document.createElement('span'); rotZ.textContent = '🔍 Zoom'; rotZ.style.cssText = 'flex:none;min-width:58px';
    [rotZ, bMenos, rng, bMais, bPad].forEach(function (e) { zl.appendChild(e); });
    function aplicarZoom(passo) {
      passoAtual = Math.max(-10, Math.min(10, passo));
      rng.value = passoAtual;
      pedirAtualizacao(250);
    }
    rng.onchange = function () { aplicarZoom(+rng.value); };
    bMenos.onclick = function () { aplicarZoom(+rng.value - 1); };
    bMais.onclick = function () { aplicarZoom(+rng.value + 1); };
    bPad.onclick = function () { aplicarZoom(0); };
    cx.appendChild(zl);

    // --- título (aparece na faixa de resultados das imagens, no KML e no nome da marcação salva) ---
    var tl = document.createElement('div');
    tl.style.cssText = 'display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:13px;color:#333';
    var rotT = document.createElement('span'); rotT.textContent = '✏️ Título'; rotT.style.cssText = 'flex:none;min-width:58px';
    var inpT = document.createElement('input');
    inpT.type = 'text'; inpT.maxLength = 80; inpT.value = tituloAtual;
    inpT.placeholder = 'Ex.: Lote da Rua Franklin (opcional)';
    inpT.style.cssText = 'flex:1;min-width:0;height:30px;box-sizing:border-box;border:1px solid #bbb;border-radius:6px;padding:0 8px;font-size:14px';
    var bLimpaT = document.createElement('button'); bLimpaT.textContent = '✕'; bLimpaT.setAttribute('aria-label', 'Limpar título');
    bLimpaT.style.cssText = 'width:30px;height:30px;border:0;border-radius:6px;background:#eee;font-size:14px;cursor:pointer;flex:none';
    inpT.oninput = function () { tituloAtual = inpT.value; pedirAtualizacao(800); };
    inpT.onkeydown = function (e) { if (e.key === 'Enter') { tituloAtual = inpT.value; pedirAtualizacao(0); inpT.blur(); } };
    bLimpaT.onclick = function () { inpT.value = ''; tituloAtual = ''; pedirAtualizacao(0); };
    [rotT, inpT, bLimpaT].forEach(function (e) { tl.appendChild(e); });
    cx.appendChild(tl);

    var toque = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);   // botão verde só no celular
    if (toque && navigator.canShare && navigator.canShare({ files: arquivos })) {
      botao('📤 Compartilhar' + (arquivos.length > 1 ? ' (' + arquivos.length + ' imagens)' : ''), '#25d366', async function () {
        try { await navigator.share({ files: arquivos, title: titulo() || 'Medição', text: textoFinal() }); }
        catch (e) { if (!e || e.name !== 'AbortError') msg.textContent = 'Não foi possível abrir o compartilhamento.'; }
      });
    }
    if (navigator.clipboard && window.ClipboardItem) {
      botao('📋 Copiar imagem', '#1e88e5', async function () {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagens[atual].blob })]);
          msg.textContent = 'Imagem copiada. Cole com Ctrl+V no WhatsApp Web ou no e-mail.';
        } catch (e) { console.warn(e); msg.textContent = 'Não foi possível copiar. Use "Salvar no computador".'; }
      });
    }
    botao('💾 Salvar imagem', '#e91e63', async function () {
      var blob = imagens[atual].blob, nome = imagens[atual].arquivo;
      if (titulo() && slug(titulo())) nome = slug(titulo()) + (atual === 0 ? '' : '-localizacao') + '.png';
      if (window.showSaveFilePicker) {
        try {
          var alvo = await window.showSaveFilePicker({
            suggestedName: nome,
            types: [{ description: 'Imagem PNG', accept: { 'image/png': ['.png'] } }]
          });
          var g = await alvo.createWritable(); await g.write(blob); await g.close();
          msg.textContent = 'Imagem salva.';
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      baixar(blob, nome);
      msg.textContent = 'Imagem baixada na pasta Downloads.';
    });

    // impressão: com duas imagens, a caixinha escolhe entre imprimir as duas (uma por folha) ou só a da aba aberta
    var chkDuas = null;
    cx.appendChild(msg);
    if (imagens.length > 1) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:#333;margin:0 0 8px;cursor:pointer';
      chkDuas = document.createElement('input'); chkDuas.type = 'checkbox'; chkDuas.checked = true;
      lbl.appendChild(chkDuas); lbl.appendChild(document.createTextNode('Imprimir as duas imagens (uma por folha)'));
      cx.appendChild(lbl);
    }
    botao('🖨️ Imprimir', '#6d4c41', function () {
      imprimir(chkDuas && chkDuas.checked ? imagens : [imagens[atual]]);
    });
    botao('📌 Salvar em marcações', '#8e24aa', function () {
      if (opc.salvar(titulo())) msg.textContent = 'Salvo em Minhas marcações.';
    });
    botao('🌍 Exportar KML', '#43a047', async function () {
      var k = kml.gerar(titulo());
      var arq = new File([k.blob], k.arquivo, { type: k.blob.type });
      if (toque && navigator.canShare && navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq], title: titulo() || 'Medição (KML)' }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      baixar(k.blob, k.arquivo);
      msg.textContent = 'KML baixado. Abra no Google Earth, no Google Maps (Meus mapas) ou no QGIS.';
    });
    botao('Fechar', '#eee', fechar);
    cx.appendChild(linha);
    fundo.appendChild(cx);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(); });
    document.body.appendChild(fundo);
  }

  var zoomPasso = 0;                                   // lembrado entre aberturas: -10 (afastar) … +10 (aproximar)
  function fatorZoom(v) { return Math.pow(1.15, -v); }

  async function compartilhar() {
    if (gerando) return;
    if (!textoCopia) {
      aviso(modo === 'dist' ? 'Marque ao menos 2 pontos para compartilhar.' : 'Marque ao menos 3 pontos para compartilhar.');
      return;
    }
    if (location.protocol === 'file:') {
      aviso('Para gerar a imagem, abra o mapa por um servidor (http://localhost:8000) ou pelo site publicado, não direto pelo arquivo.');
      return;
    }
    var base = chaveAtual(), texto = textoCopia, ptsC = pts.slice(), modoC = modo;
    var cc = (modoC === 'area') ? centroideLatLon(ptsC) : null;
    if (cc) texto += '\nCentro: ' + fmtCentro(cc) + '\nhttps://www.google.com/maps?q=' + fmtCentroPonto(cc).replace(' ', '');
    var aneis = (modoC === 'area') ? aneisDaQuadra(ptsC) : null;     // null = fora das quadras mapeadas (sem 2ª imagem)

    async function obter(passo, tit) {                               // gera (ou reaproveita) as imagens para este zoom/título
      var chave = base + '|z' + passo + '|t' + tit;
      if (imgCache && imgCache.chave === chave) return imgCache;
      var fz = fatorZoom(passo);
      var tarefas = [montarImagem(ptsC.slice(), modoC, { zoom: fz, titulo: tit })];
      if (aneis) {                                                   // 2ª imagem: a área dentro do enquadramento da quadra
        tarefas.push(montarImagem(ptsC.slice(), modoC, { localizacao: true, enquadrar: aneis[0], contorno: aneis, zoom: fz, titulo: tit })
          .catch(function (e) { console.warn('Imagem de localização:', e); return null; }));
      }
      var r = await Promise.all(tarefas);
      imgCache = { chave: chave, blob: r[0], blob2: r[1] || null };
      return imgCache;
    }
    function lista(c) {
      var l = [{ blob: c.blob, arquivo: 'medicao-quadra.png', rotulo: '📏 Medidas' }];
      if (c.blob2) l.push({ blob: c.blob2, arquivo: 'localizacao-quadra.png', rotulo: '📍 Localização na quadra' });
      return l;
    }

    var c, t0 = tituloImg.trim();
    gerando = true;
    rotuloBtn('Gerando imagem…');
    try {
      c = await obter(zoomPasso, t0);
    } catch (e) {
      console.error('Imagem da medição:', e);
      aviso('Não foi possível gerar a imagem.');
      return;
    } finally {
      gerando = false;
      rotuloBtn();
    }
    var q = quadraDaMedicao(ptsC);
    var kml = {
      gerar: function (tit) {
        var txt = gerarKml(ptsC, modoC, texto, q, aneis, tit);
        var nomeArq = slug(tit) || ((modoC === 'area' ? 'area' : 'distancia') + (q ? '-quadra-' + q : ''));
        return { blob: new Blob([txt], { type: 'application/vnd.google-earth.kml+xml' }), arquivo: nomeArq + '.kml' };
      }
    };
    mostrarPrevia(lista(c), texto, kml, {
      passo: zoomPasso,
      titulo: t0,
      regerar: async function (passo, tit) { zoomPasso = passo; tituloImg = tit; return lista(await obter(passo, tit)); },
      salvar: function (tit) { tituloImg = tit; return salvarMarcacao(ptsC, modoC, tit, false); }
    });
  }
  btnShare.onclick = compartilhar;

  // exporta o KML direto do painel, sem precisar gerar as imagens
  async function exportarKml() {
    if (!textoCopia) {
      aviso(modo === 'dist' ? 'Marque ao menos 2 pontos para exportar.' : 'Marque ao menos 3 pontos para exportar.');
      return;
    }
    var q = quadraDaMedicao(pts), aneis = (modo === 'area') ? aneisDaQuadra(pts) : null, tk = tituloImg.trim();
    var kmlTxt = gerarKml(pts.slice(), modo, textoCopia, q, aneis, tk);
    var arquivo = (slug(tk) || ((modo === 'area' ? 'area' : 'distancia') + (q ? '-quadra-' + q : ''))) + '.kml';
    var blob = new Blob([kmlTxt], { type: 'application/vnd.google-earth.kml+xml' });
    var toque = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    if (toque && navigator.canShare) {                              // celular: abre o compartilhamento (WhatsApp, Drive...)
      var arq = new File([blob], arquivo, { type: blob.type });
      if (navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq], title: 'Medição (KML)' }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
    }
    baixar(blob, arquivo);
    aviso('KML baixado. Abra no Google Earth, no Google Maps (Meus mapas) ou no QGIS.');
  }
  btnKml.onclick = exportarKml;

  // ---------- toque / clique ----------
  // Antes: map.on('singleclick'). O OpenLayers segura o singleclick ~250 ms (espera um possível duplo-clique)
  // e, no celular, qualquer tremida do dedo vira "arrasto" e o toque é descartado. Além disso, o mesmo evento
  // dispara o handler da camada de quadras (forEachFeatureAtPixel), que concorre com o desenho do ponto.
  // Agora o toque é detectado direto nos eventos de ponteiro: é imediato, tolera tremida do dedo
  // e não depende dos outros handlers do mapa.
  var TOL_TOQUE = 12, TOL_MOUSE = 5, TEMPO_MAX = 600, tap = null;

  function aoTocar(pixel, coord) {
    if (apagando) {                                   // apaga o ponto mais próximo do toque (até ~22 px)
      var melhor = -1, dmin = 22 * 22;
      for (var j = 0; j < pts.length; j++) {
        var pj = map.getPixelFromCoordinate(pts[j]);
        if (!pj) continue;
        var d2 = Math.pow(pj[0] - pixel[0], 2) + Math.pow(pj[1] - pixel[1], 2);
        if (d2 <= dmin) { dmin = d2; melhor = j; }
      }
      if (melhor >= 0) { pts.splice(melhor, 1); modoApagar(false); desenhar(); }
      else aviso('Toque bem em cima do ponto que quer apagar.');
      return;
    }
    for (var i = 0; i < pts.length; i++) {            // toque sobre um ponto existente = arrastar, não criar outro
      var px = map.getPixelFromCoordinate(pts[i]);
      if (px && Math.pow(px[0] - pixel[0], 2) + Math.pow(px[1] - pixel[1], 2) < 144) return;
    }
    pts.push(coord);
    desenhar();
  }

  var vp = map.getViewport();
  vp.addEventListener('pointerdown', function (e) {
    if (!ativo || !e.isPrimary) { tap = null; return; }          // 2º dedo (pinça) cancela o toque
    if (e.pointerType === 'mouse' && e.button !== 0) { tap = null; return; }
    if (e.target.closest && e.target.closest('.ol-overlaycontainer-stopevent')) { tap = null; return; }  // controles/balões
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(),
            tol: e.pointerType === 'mouse' ? TOL_MOUSE : TOL_TOQUE };
  }, true);
  vp.addEventListener('pointermove', function (e) {
    if (!tap || e.pointerId !== tap.id) return;
    if (Math.abs(e.clientX - tap.x) > tap.tol || Math.abs(e.clientY - tap.y) > tap.tol) tap = null;   // virou arrasto
  }, true);
  vp.addEventListener('pointercancel', function () { tap = null; }, true);
  vp.addEventListener('pointerup', function (e) {
    if (!tap || e.pointerId !== tap.id) return;
    var t = tap; tap = null;
    if (!ativo || Date.now() - t.t > TEMPO_MAX) return;           // toque longo não conta
    var pixel = map.getEventPixel(e);
    var coord = map.getCoordinateFromPixel(pixel);
    if (coord) aoTocar(pixel, coord);
  }, true);
})();
