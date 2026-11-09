// ================= POPUP DA QUADRA: título "Quadra N", sem campos internos, PDF do Drive em visualizador próprio =================
(function () {
  var MOSTRAR_ROTULO_PDF = '📄 Ver PDF da quadra';

  function idDrive(url) {
    var m = /\/d\/([\w-]{10,})/.exec(url) || /[?&]id=([\w-]{10,})/.exec(url);
    return m ? m[1] : null;
  }

  // ---------- painel do PDF ao lado do mapa (no celular em pé: embaixo), com girar e zoom ----------
  var painelPDF = null;
  // com o PDF aberto, o painel de medição fica dentro da área do mapa (não atrás do PDF)
  var stPdf = document.createElement('style');
  stPdf.textContent = '';   // (o deslocamento dos painéis agora é feito pelo "dock" do final do arquivo)
  document.head.appendChild(stPdf);

  function ladoALado() { return window.innerWidth >= 800 && window.innerWidth > window.innerHeight; }

  // posição de onde o popup foi aberto e, se achar, a quadra que contém esse ponto
  function alvoDaQuadra() {
    var pos = null;
    map.getOverlays().getArray().forEach(function (o) {
      var e = o.getElement && o.getElement();
      if (e && e.id === 'popup' && o.getPosition()) pos = o.getPosition();
    });
    if (!pos) return null;
    var ext = null;
    try {
      if (typeof camadasDeQuadras === 'function') {
        camadasDeQuadras().some(function (l) {
          return l.getSource().getFeatures().some(function (f) {
            var g = f.getGeometry();
            if (g && g.intersectsCoordinate && g.intersectsCoordinate(pos)) { ext = g.getExtent(); return true; }
            return false;
          });
        });
      }
    } catch (e) { console.warn(e); }
    return { pos: pos, ext: ext };
  }

  function centralizarQuadra() {
    var alvo = alvoDaQuadra();
    if (!alvo) return;
    var v = map.getView();
    if (alvo.ext) v.fit(alvo.ext, { size: map.getSize(), padding: [50, 50, 50, 50], maxZoom: v.getZoom(), duration: 250 });
    else v.animate({ center: alvo.pos, duration: 250 });
  }

  // A página do PDF é mostrada como imagem (miniatura grande do Drive): assim ela gira, dá zoom e arrasta
  // sem inverter os comandos. O botão "PDF completo" troca para o visualizador original do Drive.
  function abrirVisualizador(id, original, titulo) {
    if (painelPDF) { painelPDF.trocar(id, original, titulo); return; }
    var mapaEl = document.getElementById('map');
    var rot = 0, s = 1, tx = 0, ty = 0, nw = 0, nh = 0, modo = 'img', idAtual = id, tentativa = 0;
    var TAMANHOS = ['w3000', 'w1600'];

    var fundo = document.createElement('div');
    fundo.style.cssText = 'position:fixed;z-index:10020;background:#222;display:flex;flex-direction:column;box-shadow:0 0 12px rgba(0,0,0,.5)';
    var barra = document.createElement('div');
    barra.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px;background:#222;color:#fff;font:14px sans-serif';
    function bt(txt, fn, tit) {
      var b = document.createElement('button');
      b.textContent = txt; b.title = tit || txt;
      b.style.cssText = 'padding:7px 11px;border:0;border-radius:6px;background:#444;color:#fff;font-size:16px;cursor:pointer';
      b.onclick = fn; barra.appendChild(b); return b;
    }
    var rotulo = document.createElement('strong');
    rotulo.style.cssText = 'margin-right:4px';
    barra.appendChild(rotulo);
    var info = document.createElement('span');
    info.style.cssText = 'min-width:46px;text-align:center';

    var palco = document.createElement('div');
    palco.style.cssText = 'flex:1;overflow:hidden;position:relative;background:#555;touch-action:none;user-select:none;-webkit-user-select:none';
    var aviso = document.createElement('div');
    aviso.style.cssText = 'position:absolute;left:0;right:0;top:12px;text-align:center;color:#fff;font:13px sans-serif;pointer-events:none';
    var ref = document.createElement('div');                       // origem = centro do painel
    ref.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;transform-origin:0 0';
    var img = document.createElement('img');
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.style.cssText = 'position:absolute;max-width:none;display:none;background:#fff;pointer-events:none';
    ref.appendChild(img);
    var fr = document.createElement('iframe');
    fr.allow = 'fullscreen';
    fr.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#fff;display:none';
    palco.appendChild(ref); palco.appendChild(fr); palco.appendChild(aviso);

    function aplicar() {
      ref.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + rot + 'deg) scale(' + s + ')';
      info.textContent = nw ? Math.round(s / encaixe() * 100) + '%' : '';
    }
    function encaixe() {                                            // escala em que a página (girada em qualquer ângulo) cabe no painel
      var a = rot * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
      var W = nw * c + nh * sn, H = nw * sn + nh * c;
      return Math.min(palco.clientWidth / W, palco.clientHeight / H) || 1;
    }
    function giraEm(px, py, graus) {                                // gira a vista em torno de um ponto (relativo ao centro do painel)
      var a = graus * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      var vx = tx - px, vy = ty - py;
      tx = px + vx * c - vy * sn; ty = py + vx * sn + vy * c;
      rot = ((rot + graus) % 360 + 360) % 360;
    }
    function vistaInicial() { if (!nw) return; tx = 0; ty = 0; s = encaixe(); aplicar(); }
    function zoomEm(px, py, novo) {                                 // px, py: ponto fixo, relativo ao centro do painel
      var f = encaixe();
      novo = Math.max(f * 0.4, Math.min(f * 12, novo));
      var k = novo / s;
      tx = px - (px - tx) * k; ty = py - (py - ty) * k; s = novo; aplicar();
    }
    function girar(d) { if (modo !== 'img' || !nw) return; rot = (((Math.round(rot / 90) * 90 + d) % 360) + 360) % 360; vistaInicial(); }

    function carregar() {
      aviso.textContent = 'Carregando a página…';
      img.style.display = 'none';
      img.src = 'https://drive.google.com/thumbnail?id=' + idAtual + '&sz=' + TAMANHOS[tentativa];
    }
    img.onload = function () {
      nw = img.naturalWidth; nh = img.naturalHeight;
      img.style.width = nw + 'px'; img.style.height = nh + 'px';
      img.style.left = (-nw / 2) + 'px'; img.style.top = (-nh / 2) + 'px';
      img.style.display = 'block'; aviso.textContent = '';
      vistaInicial();
    };
    img.onerror = function () {
      if (tentativa + 1 < TAMANHOS.length) { tentativa++; carregar(); return; }
      aviso.textContent = 'Não foi possível carregar a imagem; mostrando o PDF original.';
      mudarModo('pdf');
    };

    var btModo = bt('📄 PDF completo', function () { mudarModo(modo === 'img' ? 'pdf' : 'img'); }, 'Alternar entre imagem da página e PDF original do Drive');
    function mudarModo(m) {
      modo = m;
      var pdf = m === 'pdf';
      fr.style.display = pdf ? 'block' : 'none';
      ref.style.display = pdf ? 'none' : 'block';
      if (pdf && !fr.src) fr.src = 'https://drive.google.com/file/d/' + idAtual + '/preview';
      btModo.textContent = pdf ? '🖼 Imagem' : '📄 PDF completo';
      [btE, btD, btMenos, btMais, btAj].forEach(function (b) { b.style.opacity = pdf ? '.35' : '1'; });
    }

    // divide a tela: mapa de um lado, PDF do outro
    function layout() {
      if (window.dock) { dock.pdf = fundo; dock.pdfRefit = vistaInicial; dock.layout(); }
      else { vistaInicial(); }
    }

    var btE = bt('⟲', function () { girar(-90); }, 'Girar para a esquerda');
    var btD = bt('⟳', function () { girar(90); }, 'Girar para a direita');
    var btMenos = bt('−', function () { if (modo === 'img' && nw) zoomEm(0, 0, s / 1.25); }, 'Diminuir');
    barra.appendChild(info);
    var btMais = bt('+', function () { if (modo === 'img' && nw) zoomEm(0, 0, s * 1.25); }, 'Aumentar');
    var btAj = bt('Ajustar', function () { if (modo !== 'img') return; rot = 0; vistaInicial(); }, 'Voltar ao tamanho original');
    var abrir = document.createElement('a');
    abrir.textContent = 'Abrir em nova aba'; abrir.target = '_blank'; abrir.rel = 'noopener';
    abrir.style.cssText = 'color:#8ec5ff;font-size:13px;margin-left:4px';
    barra.appendChild(abrir);
    var fechar = bt('✕', function () { sair(); }, 'Fechar');
    fechar.style.marginLeft = 'auto';

    // arrastar com um dedo, pinçar com dois, roda do mouse para zoom
    var ptrs = {};
    function relativo(x, y) {
      var r = palco.getBoundingClientRect();
      return [x - r.left - r.width / 2, y - r.top - r.height / 2];
    }
    palco.addEventListener('pointerdown', function (e) {
      if (modo !== 'img') return;
      try { palco.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    palco.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId];
      if (!p || !nw) return;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) {
        tx += e.clientX - p.x; ty += e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        aplicar();
      } else {
        var A = ptrs[ids[0]], B = ptrs[ids[1]];
        var d0 = Math.hypot(A.x - B.x, A.y - B.y), mx0 = (A.x + B.x) / 2, my0 = (A.y + B.y) / 2;
        var g0 = Math.atan2(B.y - A.y, B.x - A.x);
        p.x = e.clientX; p.y = e.clientY;
        var d1 = Math.hypot(A.x - B.x, A.y - B.y), mx1 = (A.x + B.x) / 2, my1 = (A.y + B.y) / 2;
        var g1 = Math.atan2(B.y - A.y, B.x - A.x);
        var dg = (g1 - g0) * 180 / Math.PI;
        if (dg > 180) dg -= 360; else if (dg < -180) dg += 360;
        tx += mx1 - mx0; ty += my1 - my0;                            // arrasta junto com os dedos
        var c = relativo(mx1, my1);
        giraEm(c[0], c[1], dg);                                      // gira com o movimento de pinça
        zoomEm(c[0], c[1], d0 > 0 ? s * d1 / d0 : s);                // e amplia/reduz
      }
    });
    function soltar(e) {
      var eraPinca = Object.keys(ptrs).length >= 2;
      delete ptrs[e.pointerId];
      if (eraPinca && nw) {                                          // perto de 0/90/180/270 graus: encaixa reto
        var alvo = Math.round(rot / 90) * 90, dif = alvo - rot;
        if (Math.abs(dif) <= 6) { giraEm(0, 0, dif); aplicar(); }
      }
    }
    palco.addEventListener('pointerup', soltar);
    palco.addEventListener('pointercancel', soltar);
    palco.addEventListener('wheel', function (e) {
      if (modo !== 'img' || !nw) return;
      e.preventDefault();
      var c = relativo(e.clientX, e.clientY);
      zoomEm(c[0], c[1], s * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    palco.addEventListener('dblclick', function (e) {
      if (modo !== 'img' || !nw) return;
      var c = relativo(e.clientX, e.clientY), f = encaixe();
      if (s > f * 1.2) vistaInicial(); else zoomEm(c[0], c[1], f * 2.5);
    });

    function sair() {
      window.removeEventListener('resize', layout);
      document.removeEventListener('keydown', tecla);
      fr.src = 'about:blank';
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      if (window.dock) { dock.pdf = null; dock.pdfRefit = null; dock.layout(); }   // devolve o espaço (ou o Street View ocupa tudo)
      else { mapaEl.style.width = ''; mapaEl.style.height = ''; map.updateSize(); }
      painelPDF = null;
    }
    function tecla(e) { 
      if (e.key === 'Escape') {
        var closer = document.getElementById('popup-closer');
        var conteudo = document.getElementById('popup-content');
        
        // Se o pop-up da quadra estiver aberto, fecha ele primeiro
        if (conteudo && conteudo.innerHTML.trim() !== '' && closer) {
          closer.click();
        } 
        // Caso contrário, se o painel do PDF estiver aberto, fecha o PDF
        else if (painelPDF) {
          sair();
        }
      } 
    }

    function trocar(novoId, original, tit) {
      idAtual = novoId; tentativa = 0; rot = 0; nw = 0; nh = 0;
      rotulo.textContent = tit || 'PDF';
      abrir.href = original;
      fr.removeAttribute('src');
      mudarModo('img');
      carregar();
      centralizarQuadra();
    }
    painelPDF = { trocar: trocar, sair: sair };
    window.fecharPainelPDF = function () { if (painelPDF) painelPDF.sair(); };   // usado pelo painel do Street View

    window.addEventListener('resize', layout);
    document.addEventListener('keydown', tecla);
    fundo.appendChild(barra); fundo.appendChild(palco);
    document.body.appendChild(fundo);
    layout();
    trocar(id, original, titulo);
  }

  // ---------- ajustes no conteúdo do popup do QGIS2Web ----------
  function textos(raiz) {
    var lista = [], w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) lista.push(w.currentNode);
    return lista;
  }
  function removerLinha(no) {
    var el = no.nodeType === 3 ? no.parentNode : no;
    var tr = el.closest ? el.closest('tr') : null;
    (tr || el).parentNode.removeChild(tr || el);
  }

  function ajustar(conteudo) {
    // número da quadra: célula ao lado do rótulo "Quadra"
    var numero = null;
    textos(conteudo).some(function (t) {
      if (t.data.trim() !== 'Quadra') return false;
      var cel = t.parentNode.closest ? t.parentNode.closest('td,th') : null;
      if (cel && cel.nextElementSibling) { numero = cel.nextElementSibling.textContent.trim(); return !!numero; }
      return false;
    });
    if (!numero) {
      var m = /\bQuadra\s+(\S+)/.exec(conteudo.innerText || '');
      if (m) numero = m[1];
    }

    // 1) título
    textos(conteudo).forEach(function (t) {
      if (/^\s*Quadras NOVO\b/i.test(t.data)) t.data = 'Quadra' + (numero ? ' ' + numero : '');
    });

    // 2) endereço interno (10.1.1.4...) e a palavra "Disponivel"
    Array.prototype.slice.call(conteudo.querySelectorAll('a')).forEach(function (a) {
      if (/10\.1\.1\.4/.test(a.getAttribute('href') || '') || /10\.1\.1\.4/.test(a.textContent)) removerLinha(a);
    });
    textos(conteudo).forEach(function (t) {
      if (!t.parentNode) return;
      if (/^\s*10\.1\.1\.4/.test(t.data) || /^\s*dispon[ií]vel\s*$/i.test(t.data)) {
        if (t.parentNode === conteudo) conteudo.removeChild(t); else removerLinha(t);
      }
    });

    // 3) link do Drive: abre o visualizador em vez de outra guia
    Array.prototype.slice.call(conteudo.querySelectorAll('a[href*="drive.google.com"]')).forEach(function (a) {
      if (a.getAttribute('data-pdf')) return;
      var href = a.getAttribute('href'), id = idDrive(href);
      a.setAttribute('data-pdf', '1');
      if (!id) return;                                   // formato desconhecido: deixa o link normal
      a.textContent = MOSTRAR_ROTULO_PDF;
      a.removeAttribute('target');
      a.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        abrirVisualizador(id, href, 'Quadra' + (numero ? ' ' + numero : ''));
      });
    });
  }

  function iniciar() {
    var conteudo = document.getElementById('popup-content');
    if (!conteudo) return;
    var obs = new MutationObserver(function () {
      obs.disconnect();
      try { ajustar(conteudo); } catch (e) { console.warn('Ajuste do popup:', e); }
      obs.observe(conteudo, { childList: true, subtree: true, characterData: true });
      obs.takeRecords();
    });
    obs.observe(conteudo, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
