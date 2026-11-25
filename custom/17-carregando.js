// Remove o aviso "Carregando…" quando o mapa termina o primeiro desenho
(function () {
  function tirar() { var el = document.getElementById('carregando'); if (el) el.remove(); }
  map.once('rendercomplete', tirar);
  setTimeout(tirar, 8000);   // garantia caso algum tile falhe
})();
