mosaicos.forEach(function (m) {
  var optMosaico = {
    title: m.nome,
    zIndex: 5,
    source: new ol.source.XYZ({
      minZoom: m.minZoom,
      maxZoom: m.maxZoom,
      transition: 0,
      tileUrlFunction: function (tc) {
        var z = tc[0], x = tc[1], y = tc[2];
        var yTms = (1 << z) - 1 - y;   // gdal2tiles sem --xyz usa Y invertido
        return MOSAICOS_BASE + m.pasta + '/' + z + '/' + x + '/' + yTms + '.' + MOSAICOS_EXT;
      }
    })
  };
  if (m.extensao) optMosaico.extent = ol.proj.transformExtent(m.extensao, 'EPSG:4326', 'EPSG:3857');
  map.addLayer(new ol.layer.Tile(optMosaico));
});
// ---- nomes de ruas por cima do mosaico (camada só de rótulos, fundo transparente) ----
var FONTE_ROTULOS = 'google';   // 'google' ou 'carto' (OpenStreetMap)
var EXTENSAO_ROTULOS = (mosaicos.length === 1 && mosaicos[0].extensao) ? mosaicos[0].extensao : null;    // opcional: limita os rótulos à área do mosaico, [oeste, sul, leste, norte] em graus
var FONTES_ROTULOS = {
  google: { url: 'https://mt{0-3}.google.com/vt/lyrs=h&hl=pt-BR&x={x}&y={y}&z={z}', max: 21, attr: null },
  carto:  { url: 'https://{a-d}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png', max: 20,
            attr: '© OpenStreetMap contributors © CARTO' }
};
(function () {
  var f = FONTES_ROTULOS[FONTE_ROTULOS];
  if (!f) return;
  function criarFonte(def) {
    return new ol.source.XYZ({ url: def.url, maxZoom: def.max, attributions: def.attr, transition: 0 });
  }
  var opcoes = {
    title: 'Nomes de ruas',
    zIndex: 11,                                  // acima do mosaico (5) e das quadras (10)
    minZoom: Math.min.apply(null, mosaicos.map(function (m) { return m.minZoom; })) - 0.01,   // abaixo disso não há mosaico
    source: criarFonte(f)
  };
  if (EXTENSAO_ROTULOS) opcoes.extent = ol.proj.transformExtent(EXTENSAO_ROTULOS, 'EPSG:4326', 'EPSG:3857');
  // Os nomes de ruas só aparecem na área da camada de quadras (extensão = retângulo que envolve todas as quadras).
  // Fora dela o mapa fica só com a imagem de satélite. Para voltar a mostrar em todo lugar: NOMES_SO_NA_AREA_DAS_QUADRAS = false.
  var NOMES_SO_NA_AREA_DAS_QUADRAS = true;
  var MARGEM_NOMES_M = 300;                       // folga ao redor das quadras, em metros (para não cortar o nome da rua na borda)
  if (NOMES_SO_NA_AREA_DAS_QUADRAS && window.lyr_Quadras_1 && lyr_Quadras_1.getSource().getFeatures().length) {
    opcoes.extent = ol.extent.buffer(lyr_Quadras_1.getSource().getExtent(), MARGEM_NOMES_M);
    delete opcoes.minZoom;                        // com a extensão limitada, os nomes valem em qualquer zoom
  }
  var camadaRotulos = new ol.layer.Tile(opcoes);
  map.addLayer(camadaRotulos);

  // se os tiles do Google não carregarem, troca sozinho para o CARTO (OpenStreetMap)
  var ok = 0, erros = 0, trocou = false;
  function vigiar(fonte, nome) {
    fonte.on('tileloadend', function () { ok++; });
    fonte.on('tileloaderror', function () {
      erros++;
      if (!trocou && nome === 'google' && ok === 0 && erros >= 3) {
        trocou = true;
        console.warn('Rótulos do Google não carregaram; usando CARTO.');
        var novo = criarFonte(FONTES_ROTULOS.carto);
        camadaRotulos.setSource(novo);
        vigiar(novo, 'carto');
      }
    });
  }
  vigiar(opcoes.source, FONTE_ROTULOS);
})();

// sobe todas as camadas vetoriais (quadras, ruas etc.) acima do mosaico
function subirVetores(layers) {
  layers.forEach(function (l) {
    if (l.getLayers) { subirVetores(l.getLayers().getArray()); return; }
    if (l instanceof ol.layer.Vector) l.setZIndex(10);
  });
}
subirVetores(map.getLayers().getArray());
