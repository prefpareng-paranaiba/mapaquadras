// ================= COORDENADA POR TOQUE LONGO / BOTÃO DIREITO =================
(function () {
  var TEMPO_MS = 600;     // tempo de segurar para ativar
  var TOLERANCIA_PX = 8;  // se o dedo andar mais que isso, é arrasto e cancela

  // marcador laranja do ponto escolhido
  var fonteCoord = new ol.source.Vector();
  map.addLayer(new ol.layer.Vector({
    source: fonteCoord,
    interactive: false,
    zIndex: 9997,
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 8,
        fill: new ol.style.Fill({ color: '#fb8c00' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
      })
    })
  }));

  // cartão com a coordenada
  var cartao = document.createElement('div');
  cartao.id = 'cartaoCoord';
  cartao.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10001;' +
    'display:none;background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
    'padding:10px 14px;font:14px sans-serif;width:400px;max-width:calc(100vw - 24px)';
  cartao.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
    '<div><div id="coordTexto" style="font-size:16px;font-weight:bold"></div>' +
    '<div id="coordQuadra" style="color:#555;margin-top:2px"></div></div>' +
    '<button id="coordFechar" aria-label="Fechar" style="border:0;background:none;font-size:20px;line-height:1;cursor:pointer;padding:0 0 0 12px">×</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:10px">' +
    '<button id="coordCopiar" style="flex:1;padding:8px 4px;border:0;border-radius:4px;background:#1e88e5;color:#fff;font-size:13px;cursor:pointer">Copiar</button>' +
    '<button id="coordLink" style="flex:1;padding:8px 4px;border:0;border-radius:4px;background:#1e88e5;color:#fff;font-size:13px;cursor:pointer">Copiar link</button>' +
    '<a id="coordMaps" target="_blank" rel="noopener" style="flex:1;padding:8px 4px;border-radius:4px;background:#eee;color:#222;text-align:center;text-decoration:none;font-size:13px">Google Maps</a>' +
    '<a id="coordStreet" target="_blank" rel="noopener" style="flex:1;padding:8px 4px;border-radius:4px;background:#eee;color:#222;text-align:center;text-decoration:none;font-size:13px">Street View</a></div>';
  document.body.appendChild(cartao);

  var textoEl = document.getElementById('coordTexto');
  var quadraEl = document.getElementById('coordQuadra');
  var btnCopiar = document.getElementById('coordCopiar');
  var linkMaps = document.getElementById('coordMaps');
  var linkStreet = document.getElementById('coordStreet');
  var btnLink = document.getElementById('coordLink');
  var atual = '', linkAtual = '';

  function copiar(texto) {
    function fallback() {
      try {
        var t = document.createElement('textarea');
        t.value = texto; t.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(t); t.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(t);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  function marcarCopiado(ok) {
    btnCopiar.textContent = ok ? 'Copiado ✓' : 'Copiar';
    if (ok) setTimeout(function () { btnCopiar.textContent = 'Copiar'; }, 2000);
  }

  // descobre a quadra (usa as funções da busca, se existirem)
  function quadraDoPonto(coord) {
    if (typeof camadasDeQuadras !== 'function') return null;
    var achou = null;
    camadasDeQuadras().forEach(function (l) {
      if (achou) return;
      var feats = l.getSource().getFeatures();
      var campo = detectarCampo(feats);
      if (!campo) return;
      feats.forEach(function (f) {
        if (achou) return;
        var g = f.getGeometry();
        if (g && g.intersectsCoordinate && g.intersectsCoordinate(coord)) {
          var v = f.get(campo);
          if (v !== null && v !== undefined && VALORES_INVALIDOS.indexOf(String(v).trim()) < 0) achou = String(v).trim();
        }
      });
    });
    return achou;
  }

  function abrir(coord, semCopiar) {
    var ll = ol.proj.toLonLat(coord);
    atual = ll[1].toFixed(6) + ', ' + ll[0].toFixed(6);   // mesmo formato do LatLong do AppSheet
    fonteCoord.clear();
    fonteCoord.addFeature(new ol.Feature(new ol.geom.Point(coord)));
    textoEl.textContent = atual;
    var q = quadraDoPonto(coord);
    quadraEl.textContent = q ? 'Quadra ' + q : 'Fora das quadras mapeadas';
    linkMaps.href = 'https://www.google.com/maps?q=' + ll[1].toFixed(6) + ',' + ll[0].toFixed(6);
    linkStreet.href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' +
      ll[1].toFixed(6) + ',' + ll[0].toFixed(6);
    // link deste mapa já aberto no ponto (o parâmetro ?ll= é lido pelo script do pino)
    linkAtual = location.origin + location.pathname + '?ll=' + ll[1].toFixed(6) + ',' + ll[0].toFixed(6);
    var info = document.getElementById('infoPino');
    if (info) info.style.display = 'none';
    cartao.style.display = 'block';
    if (!semCopiar) copiar(atual).then(marcarCopiado);    // copia na hora (se o navegador permitir)
  }

  function fechar() {
    cartao.style.display = 'none';
    fonteCoord.clear();
    var info = document.getElementById('infoPino');
    if (info) info.style.display = '';
  }

  window.mostrarCoordenada = abrir;                      // usado pela caixa de busca
  window.fecharCoordenada = fechar;                      // usado pela ferramenta de medição
  window.copiarTexto = copiar;
  btnLink.onclick = function () {
    copiar(linkAtual).then(function (ok) {
      btnLink.textContent = ok ? 'Link copiado ✓' : 'Copiar link';
      if (ok) setTimeout(function () { btnLink.textContent = 'Copiar link'; }, 2000);
    });
  };
  btnCopiar.onclick = function () { copiar(atual).then(marcarCopiado); };
  document.getElementById('coordFechar').onclick = fechar;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

  // --- gestos: toque longo (celular), segurar o clique ou botão direito ou Ctrl+clique (PC) ---
  var vp = map.getViewport();
  var estado = { timer: null, x: 0, y: 0, tol: TOLERANCIA_PX, disparou: false, quando: 0 };

  function cancelar() { clearTimeout(estado.timer); estado.timer = null; }

  function fecharPopupQgis() {
    setTimeout(function () {
      var c = document.getElementById('popup-closer');
      if (c) c.click();
    }, 120);
  }

  // abre a partir da posição da tela (não depende do evento original, que fica velho após 0,6 s)
  function abrirEm(x, y) {
    try {
      var coord = map.getEventCoordinate({ clientX: x, clientY: y });
      if (coord) abrir(coord);
    } catch (err) {
      console.error('Ferramenta de coordenada:', err);
    }
  }

  vp.addEventListener('pointerdown', function (e) {
    if (window.medindo) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;      // botão direito é tratado abaixo
    if (e.isPrimary === false) { cancelar(); return; }            // segundo dedo = zoom, cancela
    estado.x = e.clientX; estado.y = e.clientY;
    estado.tol = e.pointerType === 'mouse' ? 15 : TOLERANCIA_PX;  // mouse tem mais tremor
    estado.disparou = false;
    cancelar();
    estado.timer = setTimeout(function () {
      estado.disparou = true;
      estado.quando = Date.now();
      abrirEm(estado.x, estado.y);
    }, TEMPO_MS);
  });

  vp.addEventListener('pointermove', function (e) {
    if (!estado.timer) return;
    if (Math.abs(e.clientX - estado.x) > estado.tol || Math.abs(e.clientY - estado.y) > estado.tol) cancelar();
  });

  ['pointerup', 'pointercancel'].forEach(function (nome) {
    vp.addEventListener(nome, function () {
      cancelar();
      if (estado.disparou) {
        if (nome === 'pointerup') copiar(atual).then(marcarCopiado);   // ao soltar, o navegador libera a cópia
        fecharPopupQgis();                                             // fecha o balão que o mesmo toque pode abrir
        estado.disparou = false;
      }
    });
  });

  // botão direito no PC (e toque longo em alguns Androids, que também dispara contextmenu)
  vp.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (window.medindo) return;
    if (Date.now() - estado.quando < 1500) return;                   // já tratado pelo toque longo
    estado.quando = Date.now();
    abrirEm(e.clientX, e.clientY);
  });

  // Ctrl+clique (ou Cmd+clique) no PC: atalho imediato, sem esperar
  vp.addEventListener('click', function (e) {
    if (window.medindo || !(e.ctrlKey || e.metaKey)) return;
    estado.quando = Date.now();
    abrirEm(e.clientX, e.clientY);
    fecharPopupQgis();
  });
})();
