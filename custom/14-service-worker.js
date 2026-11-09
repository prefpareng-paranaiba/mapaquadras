// DESEMPENHO: cache offline/rápido dos recursos do site e dos tiles do mosaico (ver sw.js)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Service worker:', e); });
  });
}
