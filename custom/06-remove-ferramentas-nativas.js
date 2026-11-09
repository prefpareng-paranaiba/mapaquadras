// ================= REMOVE AS FERRAMENTAS NATIVAS DO QGIS2WEB =================
// Mantém o zoom (+/-). Troque para false o que também quiser remover.
(function () {
  var MANTER_SELETOR_CAMADAS = true;    // botão para ligar/desligar camadas (mosaico, nomes de ruas...)
  var MANTER_ATRIBUICAO = true;         // créditos do mapa (exigidos por algumas fontes)

  function manter(c) {
    if (c instanceof ol.control.Zoom) return true;
    if (MANTER_ATRIBUICAO && c instanceof ol.control.Attribution) return true;
    if (MANTER_SELETOR_CAMADAS) {
      if (typeof ol.control.LayerSwitcher === 'function' && c instanceof ol.control.LayerSwitcher) return true;
      if (c.element && /layer-switcher/.test(String(c.element.className))) return true;
    }
    return false;
  }
  map.getControls().getArray().slice().forEach(function (c) {
    if (!manter(c)) map.removeControl(c);
  });

  // garantia extra por CSS, caso algum controle não esteja registrado no mapa
  var st = document.createElement('style');
  st.textContent = '.measure-control, .search-layer, .gcd-gl-container, .photon-geocoder-autocomplete, .geolocate-control {display:none !important}';
  document.head.appendChild(st);
})();
