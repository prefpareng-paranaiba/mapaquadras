// ================= ZOOM (+ / − com número) E LOCALIZAÇÃO EM TEMPO REAL =================
(function () {
  var view = map.getView();
  var st = document.createElement('style');
  st.textContent = '.ol-zoom{display:none !important}' +
    '#ctlZoom button{display:block;width:38px;height:38px;border:0;background:#fff;color:#333;font-size:22px;line-height:1;cursor:pointer;padding:0}' +
    '#ctlZoom button:active{background:#e8f0fe}';
  document.head.appendChild(st);

  var el = document.createElement('div');
  el.id = 'ctlZoom';
  el.style.cssText = 'position:fixed;top:10px;left:8px;z-index:10001;width:38px;background:#fff;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.4);overflow:hidden;font:12px sans-serif;text-align:center';
  el.innerHTML =
    '<button id="zMais" aria-label="Aumentar zoom" title="Aumentar zoom">+</button>' +
    '<div id="zNum" title="Nível de zoom atual" style="padding:3px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-weight:bold;color:#333;background:#f7f7f7"></div>' +
    '<button id="zMenos" aria-label="Diminuir zoom" title="Diminuir zoom">−</button>' +
    '<div id="locPrec" style="display:none;padding:2px 0;font-size:10px;color:#555;border-top:1px solid #ddd"></div>';
  document.body.appendChild(el);

  var zNum = document.getElementById('zNum');
  function pintarZoom() {
    var z = view.getZoom();
    zNum.textContent = (z === undefined) ? '' : String(Math.round(z * 10) / 10);
  }
  view.on('change:resolution', pintarZoom);
  pintarZoom();
  // o mapa estava configurado para "encaixar" o zoom em números inteiros ao fim de cada toque/arrasto;
  // desliga isso para o nível de zoom (ex.: 19,5) permanecer como está
  try {
    if (typeof view.setConstrainResolution === 'function') view.setConstrainResolution(false);
    else console.warn('Esta versão do OpenLayers não tem setConstrainResolution.');
  } catch (e) { console.warn('Zoom contínuo:', e); }

  // passo de 0,5 em 0,5 (e se o zoom estiver "quebrado" por causa do pinça, vai para o próximo múltiplo de 0,5)
  var PASSO_ZOOM = 0.5;
  function irParaZoom(z) {
    var mx = view.getMaxZoom(), mn = view.getMinZoom();
    if (isFinite(mx)) z = Math.min(z, mx);
    if (isFinite(mn)) z = Math.max(z, mn);
    view.animate({ zoom: z, duration: 200 });
  }
  document.getElementById('zMais').onclick = function () {
    irParaZoom((Math.floor(view.getZoom() / PASSO_ZOOM + 1e-6) + 1) * PASSO_ZOOM);
  };
  document.getElementById('zMenos').onclick = function () {
    irParaZoom((Math.ceil(view.getZoom() / PASSO_ZOOM - 1e-6) - 1) * PASSO_ZOOM);
  };
  // duplo toque/clique e teclado (+/−) também passam a usar 0,5
  try {
    map.getInteractions().getArray().slice().forEach(function (i) {
      if (i instanceof ol.interaction.DoubleClickZoom) { map.removeInteraction(i); map.addInteraction(new ol.interaction.DoubleClickZoom({ delta: PASSO_ZOOM, duration: 200 })); }
      if (i instanceof ol.interaction.KeyboardZoom) { map.removeInteraction(i); map.addInteraction(new ol.interaction.KeyboardZoom({ delta: PASSO_ZOOM, duration: 200 })); }
    });
  } catch (e) { console.warn('Zoom 0,5:', e); }

  // ---------- localização em tempo real ----------
  var btnLoc = document.getElementById('btnLoc'), locPrec = document.getElementById('locPrec');
  var fonte = new ol.source.Vector();
  var ponto = new ol.Feature(new ol.geom.Point([0, 0]));
  var camada = new ol.layer.Vector({
    source: fonte, interactive: false, zIndex: 9996,
    style: function (f, res) {
      var acc = f.get('acc') || 0, lat = f.get('lat') || 0;
      var r = acc / Math.max(0.2, Math.cos(lat * Math.PI / 180)) / res;
      var estilos = [];
      if (r > 6 && r < 800) estilos.push(new ol.style.Style({ image: new ol.style.Circle({
        radius: r,
        fill: new ol.style.Fill({ color: 'rgba(30,136,229,0.15)' }),
        stroke: new ol.style.Stroke({ color: 'rgba(30,136,229,0.45)', width: 1 })
      }) }));
      estilos.push(new ol.style.Style({ image: new ol.style.Circle({
        radius: 9,
        fill: new ol.style.Fill({ color: '#1e88e5' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
      }) }));
      return estilos;
    }
  });
  map.addLayer(camada);

  var watchId = null, ativo = false, seguir = false, primeira = true;
  function aviso(t) { if (typeof avisarBusca === 'function') avisarBusca(t); }
  function pintarBotao() {
    btnLoc.style.background = !ativo ? '#fff' : (seguir ? '#1e88e5' : '#bbdefb');
    btnLoc.style.filter = (ativo && seguir) ? 'brightness(0) invert(1)' : 'none';
    btnLoc.title = !ativo ? 'Minha localização' : (seguir ? 'Parar localização' : 'Centralizar em mim');
  }
  function parar() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; ativo = false; seguir = false; primeira = true;
    fonte.clear(); locPrec.style.display = 'none';
    pintarBotao();
    window.dispatchEvent(new Event('resize'));
  }
  function aoReceber(pos) {
    var c = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]);
    ponto.getGeometry().setCoordinates(c);
    ponto.set('acc', pos.coords.accuracy || 0);
    ponto.set('lat', pos.coords.latitude);
    if (!fonte.getFeatures().length) fonte.addFeature(ponto);
    ponto.changed();
    locPrec.textContent = '±' + Math.round(pos.coords.accuracy || 0) + ' m';
    if (locPrec.style.display !== 'block') { locPrec.style.display = 'block'; window.dispatchEvent(new Event('resize')); }
    if (primeira) {
      primeira = false;
      view.animate({ center: c, zoom: Math.max(view.getZoom(), 19), duration: 500 });
    } else if (seguir) {
      view.animate({ center: c, duration: 300 });
    }
  }
  function aoFalhar(err) {
    if (err.code === 1) { aviso('Localização negada. Libere o acesso à localização nas configurações do navegador.'); parar(); }
    else if (err.code === 2) aviso('Posição indisponível no momento.');
    else aviso('Procurando sinal de GPS…');
  }
  btnLoc.onclick = function () {
    if (!navigator.geolocation || !window.isSecureContext) {
      aviso('A localização só funciona em página segura (https) e em navegador compatível.');
      return;
    }
    if (!ativo) {
      ativo = true; seguir = true; primeira = true; pintarBotao();
      aviso('Procurando sua localização…');
      watchId = navigator.geolocation.watchPosition(aoReceber, aoFalhar,
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    } else if (!seguir) {                           // estava solto: volta a seguir
      seguir = true; pintarBotao();
      var g = ponto.getGeometry().getCoordinates();
      if (fonte.getFeatures().length) view.animate({ center: g, duration: 300 });
    } else {                                        // já seguindo: desliga
      parar();
    }
  };
  // arrastar o mapa solta o "seguir" (o ponto continua atualizando)
  map.on('pointerdrag', function () { if (ativo && seguir) { seguir = false; pintarBotao(); } });
  pintarBotao();

  window.dispatchEvent(new Event('resize'));        // reposiciona a rosa dos ventos abaixo do novo controle
})();
