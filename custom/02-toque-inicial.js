setTimeout(function () {
  var param = new URLSearchParams(location.search).get('ll');
  if (!param) return;

  var c = param.replace(/\s/g, '').split(',').map(Number);
  if (c.length !== 2 || isNaN(c[0]) || isNaN(c[1])) return;
  var lat = c[0], lng = c[1];

  // converte lat/long (GPS) para a projeção do mapa (EPSG:3857)
  var coord = ol.proj.fromLonLat([lng, lat]);

  // pino: ponto vermelho com borda branca
  var marcador = new ol.layer.Vector({
    interactive: false,
    source: new ol.source.Vector({
      features: [new ol.Feature(new ol.geom.Point(coord))]
    }),
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 9,
        fill: new ol.style.Fill({ color: '#e53935' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
      })
    }),
    zIndex: 9999
  });
  map.addLayer(marcador);

  // aproxima o zoom no ponto
  map.getView().setCenter(coord);
  map.getView().setZoom(19);

  // descobre em qual quadra o ponto caiu
  var props = null;
  function varrer(layers) {
    layers.forEach(function (l) {
      if (props) return;
      if (l.getLayers) { varrer(l.getLayers().getArray()); return; }
      var src = l.getSource && l.getSource();
      if (!src || !src.getFeatures || l === marcador) return;
      src.getFeatures().forEach(function (f) {
        var g = f.getGeometry();
        if (!props && g && g.intersectsCoordinate && g.intersectsCoordinate(coord)) {
          props = f.getProperties();
        }
      });
    });
  }
  varrer(map.getLayers().getArray());

  // faixa de informação no topo da tela
  var html = '<b>Ponto da reclamação</b>: ' + lat + ', ' + lng;
  if (props) {
    Object.keys(props).forEach(function (k) {
      if (k === 'geometry' || props[k] === null || props[k] === '') return;
      html += '<br>' + k + ': <b>' + props[k] + '</b>';
    });
  } else {
    html += '<br><i>Ponto fora das quadras mapeadas.</i>';
  }
  var box = document.createElement('div');
  box.id = 'infoPino';
  box.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'z-index:10000;background:rgba(255,255,255,.95);padding:8px 14px;border-radius:6px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.4);font:14px sans-serif;max-width:90vw';
  box.innerHTML = html;
  document.body.appendChild(box);
}, 500);
