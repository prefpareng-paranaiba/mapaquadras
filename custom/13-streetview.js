// ================= STREET VIEW EM PAINEL (lado a lado, sem API e sem chave) =================
// Marque um ponto no mapa (📍 / toque longo / botão direito) e toque em "Street View" no cartão da coordenada.
// O marcador azul mostra o ponto; ARRASTE o marcador no mapa para mudar o lugar do Street View.
// 
(function () {
  var mapaEl = document.getElementById('map');
  var view = map.getView();
  var painel = null, divPano = null, quadro = null, elStatus = null, elLinkMaps = null;
  var heading = 0;

  // ---------- marcador no mapa ----------
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<circle cx="32" cy="32" r="22" fill="rgba(30,136,229,.25)"/>' +
    '<circle cx="32" cy="32" r="11" fill="#1e88e5" stroke="#fff" stroke-width="4"/></svg>';
  var estiloSV = new ol.style.Style({ image: new ol.style.Icon({
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), imgSize: [64, 64], anchor: [0.5, 0.5]
  }) });
  var fonteSV = new ol.source.Vector();
  var pontoSV = new ol.Feature(new ol.geom.Point([0, 0]));
  map.addLayer(new ol.layer.Vector({ source: fonteSV, zIndex: 9998, style: function () { return estiloSV; } }));
  var mover = new ol.interaction.Translate({ features: new ol.Collection([pontoSV]), hitTolerance: 14 });
  mover.on('translateend', function () {                      // soltou o marcador: o Street View vai para lá
    var ll = ol.proj.toLonLat(pontoSV.getGeometry().getCoordinates());
    abrirSV(ll[1], ll[0]);
  });

  function mostrar(msg) { if (elStatus) elStatus.textContent = msg; }

  // ---------- painel ----------
  function criarPainel() {
    painel = document.createElement('div');
    painel.style.cssText = 'position:fixed;z-index:10020;background:#222;display:flex;flex-direction:column;box-shadow:0 0 12px rgba(0,0,0,.5)';
    var barra = document.createElement('div');
    barra.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;background:#222;color:#fff;font:14px sans-serif';
    var tit = document.createElement('strong'); tit.textContent = 'Street View';
    elStatus = document.createElement('span');
    elStatus.style.cssText = 'flex:1;min-width:80px;font-size:13px;color:#cfd8dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    function botao(txt, tit2, fn) {
      var b = document.createElement('button');
      b.textContent = txt; b.title = tit2;
      b.style.cssText = 'padding:7px 11px;border:0;border-radius:6px;background:#444;color:#fff;font-size:16px;cursor:pointer';
      b.onclick = fn; return b;
    }
    var aqui = botao('🎯', 'Levar o Street View para o centro do mapa', function () {
      var c = ol.proj.toLonLat(view.getCenter()); abrirSV(c[1], c[0]);
    });
    elLinkMaps = document.createElement('a');
    elLinkMaps.textContent = 'Abrir no Google Maps'; elLinkMaps.target = '_blank'; elLinkMaps.rel = 'noopener';
    elLinkMaps.style.cssText = 'color:#8ec5ff;font-size:13px';
    var x = botao('✕', 'Fechar', function () { fechar(); });
    barra.appendChild(tit); barra.appendChild(elStatus); barra.appendChild(aqui); barra.appendChild(elLinkMaps); barra.appendChild(x);
    var corpo = document.createElement('div');
    corpo.style.cssText = 'flex:1;position:relative;background:#555;min-height:0';
    divPano = corpo;
    painel.appendChild(barra); painel.appendChild(corpo);
    document.body.appendChild(painel);
    quadro = document.createElement('iframe');
    quadro.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#333';
    quadro.allow = 'fullscreen';
    quadro.referrerPolicy = 'no-referrer-when-downgrade';
    divPano.appendChild(quadro);
    map.addInteraction(mover);
    document.addEventListener('keydown', tecla);
    dock.sv = painel; dock.layout();
  }

  function tecla(e) { if (e.key === 'Escape') fechar(); }

  function fechar() {
    if (!painel) return;
    document.removeEventListener('keydown', tecla);
    map.removeInteraction(mover);
    quadro.src = 'about:blank';
    if (painel.parentNode) painel.parentNode.removeChild(painel);
    painel = null; divPano = null; quadro = null; elStatus = null; elLinkMaps = null;
    fonteSV.clear();
    dock.sv = null; dock.layout();                                 // devolve o espaço (ou o PDF ocupa tudo)
  }

  // ---------- abrir / mudar de lugar ----------
  function abrirSV(lat, lng) {
    if (!painel) {
      criarPainel();
      heading = (((-(view.getRotation() || 0) * 180 / Math.PI) % 360) + 360) % 360;   // começa olhando para o "alto" do mapa
    }
    quadro.src = 'https://www.google.com/maps?layer=c&cbll=' + lat.toFixed(6) + ',' + lng.toFixed(6) +
      '&cbp=12,' + Math.round(heading) + ',0,0,0&output=svembed';
    pontoSV.getGeometry().setCoordinates(ol.proj.fromLonLat([lng, lat]));
    if (!fonteSV.getFeatures().length) fonteSV.addFeature(pontoSV);
    mostrar(lat.toFixed(6) + ', ' + lng.toFixed(6) + '  ·  arraste o marcador azul para mudar o lugar');
    elLinkMaps.href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' +
      lat.toFixed(6) + ',' + lng.toFixed(6) + '&heading=' + Math.round(heading);
  }
  window.abrirStreetView = abrirSV;

  // o botão "Street View" do cartão da coordenada abre o painel
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#coordStreet');
    if (!a) return;
    var m = /viewpoint=(-?[\d.]+),(-?[\d.]+)/.exec(a.href || '');
    if (!m) return;
    e.preventDefault();
    abrirSV(parseFloat(m[1]), parseFloat(m[2]));
  }, true);
})();
