        // DESEMPENHO: celulares com tela 3x desenhariam 9x mais pixels que 1x; limita a 2x (precisa rodar ANTES do ol.js)
        (function () {
          try {
            var d = window.devicePixelRatio || 1;
            if (d > 2 && window.matchMedia && matchMedia('(pointer:coarse)').matches) {
              Object.defineProperty(window, 'devicePixelRatio', { get: function () { return 2; }, configurable: true });
            }
          } catch (e) {}
        })();
        