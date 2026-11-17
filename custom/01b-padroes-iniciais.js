// ================= PADRÕES INICIAIS: o que aparece quando o mapa abre =================
// Carregar DEPOIS de 01-mosaicos.js (que cria os mosaicos e "Nomes de ruas") e ANTES de 15-camadas-marcacoes.js
// (o painel guarda o estado daqui como "padrão" do botão "Restaurar camadas ao padrão").
// Fica fora dos arquivos do qgis2web: reexportar o projeto (atualizar.py) não desfaz estes ajustes.
(function () {
  'use strict';

  // ---------- 1) Vista inicial ----------
  var CENTRO_INICIAL = [-51.1835, -19.6775];   // [longitude, latitude] — meio da cidade (centro do conjunto de quadras)
  var ZOOM_INICIAL = 16.5;                     // maior = mais perto. A partir de 16 o número das quadras já aparece (ver perf.js)

  // ---------- 2) Camadas ligadas ao abrir ----------
  // Só estas começam LIGADAS (comparadas pelo nome que aparece no painel). Todo o resto começa DESLIGADO
  // (lotes, área construída, mosaicos de drone...) e é ligado quando a pessoa quiser, pelo painel de camadas.
  var LIGADAS = [
    /^quadras?$/i,            // Quadras
    /^google/i,               // Google Satélite
    /^nomes de ruas$/i        // Nomes de ruas
  ];

  function nome(l) { return String(l.get('title') || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }

  (function percorrer(lista) {
    lista.forEach(function (l) {
      if (l.getLayers) { percorrer(l.getLayers().getArray()); return; }
      var n = nome(l);
      if (!n) return;                          // camadas internas, sem título, não são mexidas
      l.setVisible(LIGADAS.some(function (re) { return re.test(n); }));
    });
  })(map.getLayers().getArray());

  var view = map.getView();
  view.setCenter(ol.proj.fromLonLat(CENTRO_INICIAL));
  view.setZoom(ZOOM_INICIAL);
})();
