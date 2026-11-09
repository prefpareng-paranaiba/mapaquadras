// ================= "DOCK" À DIREITA (ou embaixo, no celular): PDF DA QUADRA + STREET VIEW, JUNTOS OU SEPARADOS =================
// - só um painel aberto: ocupa a área toda (como antes)
// - os dois abertos: dividem a área (PDF em cima, Street View embaixo); arraste a barrinha entre eles para mudar a proporção
// - arraste a barra entre o MAPA e o painel para mudar a largura do painel (de lado a lado) ou a altura (no celular em pé)
// - o mapa, a rosa dos ventos, o painel de medição e o cartão da coordenada se ajustam ao espaço que sobra
(function () {
  var mapaEl = document.getElementById('map');
  var dock = window.dock = { pdf: null, sv: null, pdfRefit: null, ratio: 0.5, layout: layout };
  var divisor = null, divMapa = null;

  var st = document.createElement('style');
  st.textContent =
    'body.dock-lado #medPainel, body.dock-lado #cartaoCoord{left:calc(var(--mapw) / 2) !important;max-width:calc(var(--mapw) - 24px) !important}' +
    'body.dock-baixo #medPainel{bottom:calc(var(--dockh) + 8px) !important}' +
    'body.dock-baixo #cartaoCoord{bottom:calc(var(--dockh) + 24px) !important}' +
    'body.dock-lado #rosaVentos, body.dock-lado #ctlRotacao{right:calc(100vw - var(--mapw) + 10px) !important}';
  document.head.appendChild(st);

  function ladoALado() { return window.innerWidth >= 800 && window.innerWidth > window.innerHeight; }
  function posicionar(el, x, y, w, h) {
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    var mudou = el.__w !== w || el.__h !== h;
    el.__w = w; el.__h = h;
    return mudou;
  }

  // barra entre o mapa e o painel: arrastar para os lados (ou para cima/baixo no celular em pé) muda o tamanho do painel
  function barraMapa(lado, mw, mh) {
    if (!divMapa) {
      divMapa = document.createElement('div');
      var g = false;
      divMapa.addEventListener('pointerdown', function (e) {
        g = true; try { divMapa.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
      });
      divMapa.addEventListener('pointermove', function (e) {
        if (!g) return;
        if (dock.__lado) dock.fw = Math.max(0.25, Math.min(0.8, e.clientX / window.innerWidth));
        else dock.fh = Math.max(0.2, Math.min(0.75, e.clientY / window.innerHeight));
        layout();
      });
      ['pointerup', 'pointercancel'].forEach(function (nm) { divMapa.addEventListener(nm, function () { g = false; }); });
      document.body.appendChild(divMapa);
    }
    divMapa.title = lado ? 'Arraste para os lados para mudar a largura do painel'
                         : 'Arraste para cima ou para baixo para mudar a altura do painel';
    divMapa.style.cssText = lado
      ? 'position:fixed;z-index:10023;touch-action:none;cursor:col-resize;top:0;height:100vh;width:14px;left:' + (mw - 7) + 'px;' +
        'background:linear-gradient(to right,transparent 5px,#8ec5ff 5px,#8ec5ff 9px,transparent 9px)'
      : 'position:fixed;z-index:10023;touch-action:none;cursor:row-resize;left:0;width:100vw;height:14px;top:' + (mh - 7) + 'px;' +
        'background:linear-gradient(to bottom,transparent 5px,#8ec5ff 5px,#8ec5ff 9px,transparent 9px)';
  }

  function layout() {
    var P = dock.pdf, S = dock.sv, n = (P ? 1 : 0) + (S ? 1 : 0);
    var W = window.innerWidth, H = window.innerHeight, b = document.body;
    b.classList.remove('dock-lado', 'dock-baixo');
    if (!n) {
      mapaEl.style.width = ''; mapaEl.style.height = '';           // volta ao CSS original (100vw x 100vh)
      b.style.removeProperty('--mapw'); b.style.removeProperty('--dockh');
      if (divisor && divisor.parentNode) divisor.parentNode.removeChild(divisor);
      divisor = null;
      if (divMapa && divMapa.parentNode) divMapa.parentNode.removeChild(divMapa);
      divMapa = null;
      map.updateSize();
      return;
    }
    var lado = ladoALado(), mw, mh, rx, ry, rw, rh;
    var fw = dock.fw != null ? dock.fw : (n === 2 ? 0.44 : 0.54);       // fração da largura que o MAPA ocupa (de lado a lado)
    var fh = dock.fh != null ? dock.fh : (n === 2 ? 0.34 : 0.54);       // fração da altura que o MAPA ocupa (celular em pé)
    dock.__lado = lado;
    if (lado) { mw = Math.round(W * fw); mh = H; rx = mw; ry = 0; rw = W - mw; rh = H; b.classList.add('dock-lado'); }
    else      { mw = W; mh = Math.round(H * fh); rx = 0; ry = mh; rw = W; rh = H - mh; b.classList.add('dock-baixo'); }
    mapaEl.style.width = mw + 'px'; mapaEl.style.height = mh + 'px';
    barraMapa(lado, mw, mh);
    b.style.setProperty('--mapw', mw + 'px'); b.style.setProperty('--dockh', rh + 'px');

    var pdfMudou = false;
    if (n === 1) {
      pdfMudou = posicionar(P || S, rx, ry, rw, rh) && !!P;
      if (divisor && divisor.parentNode) divisor.parentNode.removeChild(divisor);
      divisor = null;
    } else {
      var h1 = Math.round(rh * dock.ratio);
      pdfMudou = posicionar(P, rx, ry, rw, h1);
      posicionar(S, rx, ry + h1, rw, rh - h1);
      if (!divisor) {
        divisor = document.createElement('div');
        divisor.title = 'Arraste para mudar a divisão entre o PDF e o Street View';
        divisor.style.cssText = 'position:fixed;z-index:10022;height:12px;cursor:row-resize;touch-action:none;' +
          'background:linear-gradient(to bottom,transparent 4px,#8ec5ff 4px,#8ec5ff 8px,transparent 8px)';
        var g = null;
        divisor.addEventListener('pointerdown', function (e) {
          g = { y0: dock.__ry, h: dock.__rh }; try { divisor.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
        });
        divisor.addEventListener('pointermove', function (e) {
          if (!g) return;
          dock.ratio = Math.max(0.2, Math.min(0.8, (e.clientY - g.y0) / g.h));
          layout();
        });
        ['pointerup', 'pointercancel'].forEach(function (nm) { divisor.addEventListener(nm, function () { g = null; }); });
        document.body.appendChild(divisor);
      }
      dock.__ry = ry; dock.__rh = rh;
      divisor.style.left = rx + 'px'; divisor.style.width = rw + 'px'; divisor.style.top = (ry + h1 - 6) + 'px';
    }
    map.updateSize();
    if (P && pdfMudou && dock.pdfRefit) dock.pdfRefit();            // reajusta a página do PDF só se o painel mudou de tamanho
  }
  window.addEventListener('resize', layout);
})();
