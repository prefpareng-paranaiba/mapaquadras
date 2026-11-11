// ================= COORDENADA POR TOQUE LONGO / BOTÃO DIREITO + COMPARTILHAR =================
(function () {
  var TEMPO_MS = 600;     // tempo de segurar para ativar
  var TOLERANCIA_PX = 8;  // se o dedo andar mais que isso, é arrasto e cancela

  var PARAMS = new URLSearchParams(location.search);
  var EMBED = PARAMS.get('embed') === '1';                 // modo "recorte" (usado dentro de <iframe>)
  // Endereço público do mapa (GitHub Pages). Se ficar vazio, usa o endereço da página aberta.
  // Exemplo: var URL_PUBLICA = 'https://prefpareng-paranaiba.github.io/mapaquadras/';
  var URL_PUBLICA = 'https://prefpareng-paranaiba.github.io/mapaquadras/';
  var ENDERECO_LOCAL = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|\[?::1)/i;
  var BASE_LOCAL = !URL_PUBLICA && (location.protocol === 'file:' || ENDERECO_LOCAL.test(location.hostname));
  var BASE_URL = (function () {
    var b = (URL_PUBLICA || location.href.split(/[?#]/)[0]).replace(/index\.html?$/i, '');
    if (!BASE_LOCAL) b = b.replace(/^http:\/\//i, 'https://');   // sempre https fora do computador local
    return b;
  })();
  var ZOOMS_EMBED = [['19', 'Bem perto'], ['18', 'Perto'], ['17', 'Médio'], ['16', 'Amplo']];
  var ZOOM_EMBED_PADRAO = '18';
  var TAMANHOS_EMBED = [['400x300', 'Pequeno'], ['600x450', 'Médio'], ['800x600', 'Grande']];
  var TAMANHO_EMBED_PADRAO = '600x450';

  // marcador laranja do ponto escolhido
  var fonteCoord = new ol.source.Vector();
  map.addLayer(new ol.layer.Vector({
    source: fonteCoord,
    interactive: false,
    zIndex: 9997,
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 8,
        fill: new ol.style.Fill({ color: '#fb8c00' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
      })
    })
  }));

  // ---------- balão de informações do ponto (#infoPino): tirar campos técnicos e permitir fechar ----------
  var RE_OCULTAR = /^\s*(fid|link\s*pdf|mapa\s*pdf|link[_\s]*exter\w*)\s*:/i;

  function limparNo(raiz) {
    var remover = [], linha = [], txt = '';
    function fimLinha(br) {
      if (RE_OCULTAR.test(txt)) { linha.forEach(function (n) { remover.push(n); }); if (br) remover.push(br); }
      linha = []; txt = '';
    }
    Array.prototype.slice.call(raiz.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && n.getAttribute('data-mq')) return;            // nosso botão ×
      if (n.nodeName === 'BR') { fimLinha(n); return; }
      if (n.nodeType === 1 && /^(DIV|P|LI|TR|UL|OL|TABLE|TBODY|SECTION)$/.test(n.nodeName)) {
        fimLinha(null);
        if (RE_OCULTAR.test(n.textContent)) remover.push(n); else limparNo(n);
        return;
      }
      linha.push(n); txt += n.textContent;
    });
    fimLinha(null);
    remover.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  function prepararInfo() {
    var info = document.getElementById('infoPino'); if (!info) return;
    limparNo(info);
    if (!info.querySelector('[data-mq=fechar]')) {
      if (getComputedStyle(info).position === 'static') info.style.position = 'relative';
      info.style.paddingRight = '38px';
      var x = document.createElement('button');
      x.setAttribute('data-mq', 'fechar');
      x.setAttribute('aria-label', 'Fechar informações');
      x.title = 'Fechar';
      x.textContent = '×';
      x.style.cssText = 'position:absolute;top:2px;right:2px;width:36px;height:36px;border:0;background:none;' +
        'font-size:24px;line-height:1;color:#555;cursor:pointer;padding:0';
      x.onclick = function (e) {
        e.stopPropagation();
        info.style.display = 'none';
        info.dataset.fechado = '1';
      };
      info.appendChild(x);
    }
  }
  var obsInfo = new MutationObserver(function (recs) {
    var info = document.getElementById('infoPino'); if (!info) return;
    var mudou = recs.some(function (r) { return info.contains(r.target); });
    if (mudou || !info.querySelector('[data-mq=fechar]')) {
      if (mudou) info.dataset.fechado = '';        // conteúdo novo de outro ponto: pode aparecer de novo
      prepararInfo();
      obsInfo.takeRecords();                       // ignora as mudanças que nós mesmos fizemos
    }
  });
  obsInfo.observe(document.body, { childList: true, subtree: true, characterData: true });
  prepararInfo();

  // ---------- cartão com a coordenada ----------
  var BTN_AZUL = 'flex:1;padding:8px 4px;border:0;border-radius:4px;background:#1e88e5;color:#fff;font-size:13px;cursor:pointer';
  var BTN_LINK = 'flex:1;padding:8px 4px;border-radius:4px;background:#eee;color:#222;text-align:center;text-decoration:none;font-size:13px';

  var cartao = document.createElement('div');
  cartao.id = 'cartaoCoord';
  cartao.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10001;' +
    'display:none;background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
    'padding:10px 14px;font:14px sans-serif;width:400px;max-width:calc(100vw - 24px)';
  cartao.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
    '<div><div id="coordTexto" style="font-size:16px;font-weight:bold"></div>' +
    '<div id="coordQuadra" style="color:#555;margin-top:2px"></div></div>' +
    '<button id="coordFechar" aria-label="Fechar" style="border:0;background:none;font-size:20px;line-height:1;cursor:pointer;padding:0 0 0 12px">×</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:10px">' +
    '<button id="coordCopiar" style="' + BTN_AZUL + '">Copiar</button>' +
    '<button id="coordCompartilhar" style="' + BTN_AZUL + '">Compartilhar</button>' +
    '<a id="coordMaps" target="_blank" rel="noopener" style="' + BTN_LINK + '">Google Maps</a>' +
    '<a id="coordStreet" target="_blank" rel="noopener" style="' + BTN_LINK + '">Street View</a></div>';
  document.body.appendChild(cartao);

  var textoEl = document.getElementById('coordTexto');
  var quadraEl = document.getElementById('coordQuadra');
  var btnCopiar = document.getElementById('coordCopiar');
  var linkMaps = document.getElementById('coordMaps');
  var linkStreet = document.getElementById('coordStreet');
  var atual = '', linkAtual = '', llAtual = '', quadraAtual = '', coordAtual = null;

  function copiar(texto) {
    function fallback() {
      try {
        var t = document.createElement('textarea');
        t.value = texto; t.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(t); t.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(t);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  function marcarCopiado(ok) {
    btnCopiar.textContent = ok ? 'Copiado ✓' : 'Copiar';
    if (ok) setTimeout(function () { btnCopiar.textContent = 'Copiar'; }, 2000);
  }

  // descobre a quadra (usa as funções da busca, se existirem)
  function quadraDoPonto(coord) {
    if (typeof camadasDeQuadras !== 'function') return null;
    var achou = null;
    camadasDeQuadras().forEach(function (l) {
      if (achou) return;
      var feats = l.getSource().getFeatures();
      var campo = detectarCampo(feats);
      if (!campo) return;
      feats.forEach(function (f) {
        if (achou) return;
        var g = f.getGeometry();
        if (g && g.intersectsCoordinate && g.intersectsCoordinate(coord)) {
          var v = f.get(campo);
          if (v !== null && v !== undefined && VALORES_INVALIDOS.indexOf(String(v).trim()) < 0) achou = String(v).trim();
        }
      });
    });
    return achou;
  }

  // ---------- janela "Compartilhar" (estilo Google Maps) ----------
  var estiloModal = document.createElement('style');
  estiloModal.textContent =
    '#mqShare{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font:14px/1.35 Arial,sans-serif;color:#202124}' +
    '#mqShare .mqs-dlg{background:#eef3f6;border-radius:24px;padding:18px 22px 22px;width:420px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.4);box-sizing:border-box}' +
    '#mqShare .mqs-top{display:flex;align-items:center;gap:6px;margin-bottom:14px}' +
    '#mqShare h2{flex:1;margin:0;font:normal 22px Arial,sans-serif}' +
    '#mqShare .mqs-x,#mqShare .mqs-back{width:40px;height:40px;border:0;border-radius:50%;background:none;font-size:26px;line-height:1;color:#202124;cursor:pointer;padding:0}' +
    '#mqShare .mqs-x:hover,#mqShare .mqs-back:hover{background:rgba(0,0,0,.07)}' +
    '#mqShare .mqs-prev{background:#dfe5e8;border-radius:18px;padding:22px 18px}' +
    '#mqShare .mqs-card{display:flex;background:#f1f8fb;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);min-height:130px;cursor:pointer;transition:box-shadow .15s,transform .1s;-webkit-tap-highlight-color:transparent}' +
    '#mqShare .mqs-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.4)}' +
    '#mqShare .mqs-card:active{transform:scale(.99)}' +
    '#mqShare .mqs-dica{color:#5f6368;font-size:12px;margin-top:4px}' +
    '#mqShare .mqs-dica.ok{color:#188038;font-weight:bold}' +
    '#mqShare .mqs-aviso{margin-top:12px;background:#fff3cd;border:1px solid #e0c36a;border-radius:12px;padding:8px 12px;font-size:12px;color:#5b4a00}' +
    '#mqShare .mqs-thumb{flex:0 0 42%;background:#cfd8dc center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:34px;border-right:2px solid #1f2a30}' +
    '#mqShare .mqs-info{flex:1;min-width:0;padding:14px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px}' +
    '#mqShare .mqs-coord{font-size:15px;font-weight:bold;word-break:break-word}' +
    '#mqShare .mqs-sub{color:#5f6368;font-size:13px}' +
    '#mqShare .mqs-url{color:#0b7285;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#mqShare .mqs-acoes{display:flex;flex-wrap:wrap;justify-content:space-around;gap:10px 6px;background:#fff;border-radius:18px;padding:14px 8px 12px;margin-top:14px}' +
    '#mqShare .mqs-ac{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;cursor:pointer;font:12px/1.2 Arial,sans-serif;color:#3c4043;width:78px;padding:0;text-align:center}' +
    '#mqShare .mqs-ic{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:filter .15s}' +
    '#mqShare .mqs-ac:hover .mqs-ic{filter:brightness(.92)}' +
    '#mqShare .mqs-box{background:#fff;border-radius:18px;padding:14px}' +
    '#mqShare .mqs-linha{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:13px;color:#5f6368}' +
    '#mqShare select{margin-left:4px;padding:6px;border:1px solid #bbb;border-radius:6px;font-size:13px;background:#fff}' +
    '#mqShare .mqs-frame{border:1px solid #dadce0;border-radius:10px;overflow:hidden;height:190px;background:#e8eaed}' +
    '#mqShare .mqs-frame iframe{width:100%;height:100%;border:0;display:block}' +
    '#mqShare textarea{width:100%;box-sizing:border-box;margin-top:10px;border:1px solid #bbb;border-radius:8px;padding:8px;font:12px/1.35 monospace;resize:none;color:#202124}' +
    '#mqShare .mqs-txtbtn{border:0;background:none;color:#1a73e8;font:bold 13px Arial,sans-serif;letter-spacing:.4px;cursor:pointer;padding:8px 10px;border-radius:6px}' +
    '#mqShare .mqs-txtbtn:hover{background:#e8f0fe}';
  document.head.appendChild(estiloModal);

  var SVG_LINK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>';
  var SVG_ZAP = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path fill="#fff" d="M9 8.2c.2-.4.6-.4.9-.3l.7 1.6c.1.3 0 .5-.2.7l-.5.5c.6 1.2 1.6 2.1 2.8 2.7l.6-.6c.2-.2.5-.2.7-.1l1.5.8c.3.2.4.5.2.9-.4.9-1.3 1.4-2.2 1.2-2.8-.6-5-2.7-5.7-5.5-.1-.8.2-1.4.7-1.9z"/></svg>';
  var SVG_MAIL = '<svg width="26" height="26" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="1.5" fill="#fff" stroke="#d93025" stroke-width="1.6"/><path d="M3.6 6.4 12 13l8.4-6.6" fill="none" stroke="#d93025" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var SVG_CODE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>';
  var SVG_MAIS = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>';

  function botaoAcao(id, fundo, svg, rotulo, borda) {
    return '<button class="mqs-ac" id="' + id + '"><span class="mqs-ic" style="background:' + fundo + (borda ? ';box-shadow:inset 0 0 0 1px #dadce0' : '') + '">' + svg + '</span><span>' + rotulo + '</span></button>';
  }
  function opcoes(lista, padrao) {
    return lista.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === padrao ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }

  var modal = document.createElement('div');
  modal.id = 'mqShare';
  modal.innerHTML =
    '<div class="mqs-dlg" role="dialog" aria-modal="true" aria-labelledby="mqsTitulo">' +
      '<div class="mqs-top">' +
        '<button class="mqs-back" id="mqsVoltar" aria-label="Voltar" style="display:none">←</button>' +
        '<h2 id="mqsTitulo">Compartilhar</h2>' +
        '<button class="mqs-x" id="mqsX" aria-label="Fechar">×</button>' +
      '</div>' +
      '<div id="mqsVistaLink">' +
        '<div class="mqs-prev"><div class="mqs-card" id="mqsCard" role="button" tabindex="0" title="Copiar link">' +
          '<div class="mqs-thumb" id="mqsThumb"></div>' +
          '<div class="mqs-info"><div class="mqs-coord" id="mqsCoord"></div><div class="mqs-sub" id="mqsQuadra"></div><div class="mqs-url" id="mqsUrl"></div><div class="mqs-dica" id="mqsDica">Toque aqui para copiar o link</div></div>' +
        '</div></div>' +
        '<div class="mqs-acoes">' +
          botaoAcao('mqsCopiar', '#0b7285', SVG_LINK, 'Copiar link') +
          botaoAcao('mqsWhats', '#25d366', SVG_ZAP, 'WhatsApp') +
          botaoAcao('mqsGmail', '#fff', SVG_MAIL, 'Gmail', true) +
          botaoAcao('mqsEmbed', '#0f4c5c', SVG_CODE, 'Incorporar um mapa') +
          (navigator.share ? botaoAcao('mqsMais', '#5f6368', SVG_MAIS, 'Mais opções') : '') +
        '</div>' +
      '</div>' +
      '<div id="mqsVistaEmbed" style="display:none"><div class="mqs-box">' +
        '<div class="mqs-linha">' +
          '<label>Tamanho<select id="mqsTam">' + opcoes(TAMANHOS_EMBED, TAMANHO_EMBED_PADRAO) + '</select></label>' +
          '<label>Aproximação<select id="mqsZoom">' + opcoes(ZOOMS_EMBED, ZOOM_EMBED_PADRAO) + '</select></label>' +
        '</div>' +
        '<div class="mqs-frame"><iframe id="mqsFrame" title="Pré-visualização do recorte"></iframe></div>' +
        '<textarea id="mqsCodigo" readonly rows="3"></textarea>' +
        '<div style="text-align:right;margin-top:6px"><button class="mqs-txtbtn" id="mqsCopiarCod">COPIAR HTML</button></div>' +
      '</div></div>' +
    '</div>';
  document.body.appendChild(modal);

  var elThumb = document.getElementById('mqsThumb');
  var vistaLink = document.getElementById('mqsVistaLink');
  var vistaEmbed = document.getElementById('mqsVistaEmbed');
  var btnVoltar = document.getElementById('mqsVoltar');
  var tituloEl = document.getElementById('mqsTitulo');
  var tamSel = document.getElementById('mqsTam');
  var zoomSel = document.getElementById('mqsZoom');
  var frameEl = document.getElementById('mqsFrame');
  var codigoEl = document.getElementById('mqsCodigo');
  var dicaEl = document.getElementById('mqsDica');
  var cartaoPrev = document.getElementById('mqsCard');
  var avisoLocal = document.createElement('div');
  avisoLocal.className = 'mqs-aviso';
  avisoLocal.style.display = 'none';
  avisoLocal.textContent = 'modo (localhost).' +
    'Para compartilhar, abra o mapa pelo endereço do GitHub ou preencha URL_PUBLICA no início do arquivo 04-coordenada.js.';
  vistaLink.appendChild(avisoLocal);

  function urlEmbed(z) { return BASE_URL + '?embed=1&ll=' + llAtual + '&z=' + z; }
  function atualizarEmbed() {
    var url = urlEmbed(zoomSel.value), t = tamSel.value.split('x');
    codigoEl.value = '<iframe src="' + url + '" width="' + t[0] + '" height="' + t[1] + '" style="border:0" loading="lazy" allowfullscreen></iframe>';
    frameEl.src = url;
  }
  // texto sem emoji (alguns aparelhos mostram "�") e com o link sozinho na última linha,
  // para o WhatsApp reconhecer o endereço completo como link clicável
  function textoPonto() {
    return 'Localização' + (quadraAtual ? ' - Quadra ' + quadraAtual : '') + '\n' + atual;
  }
  function mensagem() {
    return textoPonto() + '\n\n' + linkAtual;
  }
  function mostrarVista(qual) {
    var emb = qual === 'embed';
    vistaLink.style.display = emb ? 'none' : 'block';
    vistaEmbed.style.display = emb ? 'block' : 'none';
    btnVoltar.style.display = emb ? '' : 'none';
    tituloEl.textContent = emb ? 'Incorporar um mapa' : 'Compartilhar';
    if (emb) atualizarEmbed(); else frameEl.removeAttribute('src');
  }

  // miniatura: recorte da imagem do mapa em volta do ponto (se o navegador bloquear, usa o ícone 📍)
  function miniatura(coord) {
    try {
      map.renderSync();
      var size = map.getSize(), px = map.getPixelFromCoordinate(coord);
      if (!size || !px || px[0] < 0 || px[1] < 0 || px[0] > size[0] || px[1] > size[1]) return null;
      var full = document.createElement('canvas'); full.width = size[0]; full.height = size[1];
      var ctx = full.getContext('2d');
      Array.prototype.forEach.call(map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'), function (c) {
        if (c.width > 0) {
          var op = (c.parentNode && c.parentNode.style.opacity) || c.style.opacity;
          ctx.globalAlpha = op === '' || op === undefined ? 1 : Number(op);
          var tr = c.style.transform, mt = tr && tr.match(/^matrix\(([^\(]*)\)$/);
          var m = mt ? mt[1].split(',').map(Number) : [parseFloat(c.style.width) / c.width, 0, 0, parseFloat(c.style.height) / c.height, 0, 0];
          ctx.setTransform.apply(ctx, m);
          ctx.drawImage(c, 0, 0);
        }
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      var out = document.createElement('canvas'); out.width = 240; out.height = 208;
      out.getContext('2d').drawImage(full, px[0] - 120, px[1] - 104, 240, 208, 0, 0, 240, 208);
      return out.toDataURL('image/jpeg', 0.8);       // dá erro se alguma camada bloquear a cópia → cai no catch
    } catch (e) { return null; }
  }

  function abrirModal() {
    if (!coordAtual) return;
    document.getElementById('mqsCoord').textContent = atual;
    document.getElementById('mqsQuadra').textContent = quadraAtual ? 'Quadra ' + quadraAtual : 'Fora das quadras mapeadas';
    document.getElementById('mqsUrl').textContent = linkAtual.replace(/^https?:\/\//, '');
    dicaEl.textContent = 'Toque aqui para copiar o link'; dicaEl.className = 'mqs-dica';
    avisoLocal.style.display = BASE_LOCAL ? 'block' : 'none';
    var img = miniatura(coordAtual);
    if (img) { elThumb.style.backgroundImage = 'url(' + img + ')'; elThumb.textContent = ''; }
    else { elThumb.style.backgroundImage = 'none'; elThumb.textContent = '📍'; }
    mostrarVista('link');
    modal.style.display = 'flex';
  }
  function fecharModal() {
    modal.style.display = 'none';
    frameEl.removeAttribute('src');
  }
  function modalAberto() { return modal.style.display === 'flex'; }

  function retorno(btn, ok, rotulo) {
    var span = btn.querySelector('span:last-child') || btn;
    span.textContent = ok ? 'Copiado ✓' : rotulo;
    if (ok) setTimeout(function () { span.textContent = rotulo; }, 2000);
  }
  document.getElementById('coordCompartilhar').onclick = abrirModal;
  // o cartão de prévia é um botão: toque e o link já vai para a área de transferência
  function copiarPeloCartao() {
    copiar(linkAtual).then(function (ok) {
      dicaEl.textContent = ok ? 'Link copiado ✓' : 'Não foi possível copiar - use "Copiar link"';
      dicaEl.className = 'mqs-dica' + (ok ? ' ok' : '');
      if (ok) setTimeout(function () { dicaEl.textContent = 'Toque aqui para copiar o link'; dicaEl.className = 'mqs-dica'; }, 2500);
    });
  }
  cartaoPrev.onclick = copiarPeloCartao;
  cartaoPrev.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copiarPeloCartao(); } };
  document.getElementById('mqsX').onclick = fecharModal;
  modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });   // toque fora fecha
  btnVoltar.onclick = function () { mostrarVista('link'); };
  var btnCopLink = document.getElementById('mqsCopiar');
  btnCopLink.onclick = function () { copiar(linkAtual).then(function (ok) { retorno(btnCopLink, ok, 'Copiar link'); }); };
  document.getElementById('mqsWhats').onclick = function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(mensagem()), '_blank', 'noopener');
  };
  document.getElementById('mqsGmail').onclick = function () {
    var assunto = 'Ponto no mapa' + (quadraAtual ? ' - Quadra ' + quadraAtual : '');
    window.open('https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(mensagem()), '_blank', 'noopener');
  };
  document.getElementById('mqsEmbed').onclick = function () { mostrarVista('embed'); };
  var btnMais = document.getElementById('mqsMais');
  if (btnMais) btnMais.onclick = function () {
    try {
      navigator.share({ title: 'Ponto no mapa', text: textoPonto(), url: linkAtual }).catch(function () {});
    } catch (e) {}
  };
  tamSel.onchange = atualizarEmbed;
  zoomSel.onchange = atualizarEmbed;
  var btnCopCod = document.getElementById('mqsCopiarCod');
  btnCopCod.onclick = function () { copiar(codigoEl.value).then(function (ok) { retorno(btnCopCod, ok, 'COPIAR HTML'); }); };

  // ---------- abrir / fechar o cartão ----------
  function abrir(coord, semCopiar) {
    var ll = ol.proj.toLonLat(coord);
    coordAtual = coord;
    atual = ll[1].toFixed(6) + ', ' + ll[0].toFixed(6);   // mesmo formato do LatLong do AppSheet
    llAtual = ll[1].toFixed(6) + ',' + ll[0].toFixed(6);
    fonteCoord.clear();
    fonteCoord.addFeature(new ol.Feature(new ol.geom.Point(coord)));
    textoEl.textContent = atual;
    var q = quadraDoPonto(coord);
    quadraAtual = q || '';
    quadraEl.textContent = q ? 'Quadra ' + q : 'Fora das quadras mapeadas';
    linkMaps.href = 'https://www.google.com/maps?q=' + llAtual;
    linkStreet.href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + llAtual;
    // link deste mapa já aberto no ponto (o parâmetro ?ll= é lido pelo script do pino)
    linkAtual = BASE_URL + '?ll=' + llAtual;
    fecharModal();
    var info = document.getElementById('infoPino');
    if (info) info.style.display = 'none';
    cartao.style.display = 'block';
    if (!semCopiar) copiar(atual).then(marcarCopiado);    // copia na hora (se o navegador permitir)
  }

  function fechar() {
    cartao.style.display = 'none';
    fecharModal();
    fonteCoord.clear();
    var info = document.getElementById('infoPino');
    if (info && info.dataset.fechado !== '1') info.style.display = '';   // se a pessoa fechou o balão, ele continua fechado
  }

  window.mostrarCoordenada = abrir;                      // usado pela caixa de busca
  window.fecharCoordenada = fechar;                      // usado pela ferramenta de medição
  window.copiarTexto = copiar;
  btnCopiar.onclick = function () { copiar(atual).then(marcarCopiado); };
  document.getElementById('coordFechar').onclick = fechar;
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modalAberto()) { fecharModal(); return; }        // primeiro fecha a janela de compartilhar
    fechar();
  });

  // ---------- modo recorte (embed): mapa limpo, centrado no ponto ----------
  if (EMBED) {
    document.body.classList.add('mq-embed');
    var st = document.createElement('style');
    st.textContent =
      'body.mq-embed > :not(:has(#map)):not(#map):not(script):not(style):not(#mqLinkEmbed){display:none!important}' +
      'body.mq-embed .ol-control,body.mq-embed #ctlZoom,body.mq-embed #mqBotoes,body.mq-embed #mqPainel,' +
      'body.mq-embed #cartaoCoord,body.mq-embed #mqShare,body.mq-embed #infoPino,body.mq-embed .ol-popup{display:none!important}';
    document.head.appendChild(st);

    var m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(PARAMS.get('ll') || '');
    if (m) {
      var coordE = ol.proj.fromLonLat([parseFloat(m[2]), parseFloat(m[1])]);
      var zE = parseFloat(PARAMS.get('z')) || parseFloat(ZOOM_EMBED_PADRAO);
      fonteCoord.addFeature(new ol.Feature(new ol.geom.Point(coordE)));
      var centrar = function () { var v = map.getView(); v.setCenter(coordE); v.setZoom(zE); };
      centrar(); setTimeout(centrar, 500); setTimeout(centrar, 1500);   // reforça caso outro script reposicione o mapa
      var abrirCompleto = document.createElement('a');
      abrirCompleto.id = 'mqLinkEmbed';
      abrirCompleto.href = BASE_URL + '?ll=' + m[1] + ',' + m[2];
      abrirCompleto.target = '_blank'; abrirCompleto.rel = 'noopener';
      abrirCompleto.textContent = 'Abrir mapa completo ↗';
      abrirCompleto.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:10001;background:#fff;color:#1565c0;' +
        'font:12px sans-serif;padding:5px 9px;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.4);text-decoration:none';
      document.body.appendChild(abrirCompleto);
    }
    return;   // no recorte não há gestos de coordenada
  }

  // --- gestos: toque longo (celular), segurar o clique ou botão direito ou Ctrl+clique (PC) ---
  var vp = map.getViewport();
  var estado = { timer: null, x: 0, y: 0, tol: TOLERANCIA_PX, disparou: false, quando: 0 };

  function cancelar() { clearTimeout(estado.timer); estado.timer = null; }

  function fecharPopupQgis() {
    setTimeout(function () {
      var c = document.getElementById('popup-closer');
      if (c) c.click();
    }, 120);
  }

  // abre a partir da posição da tela (não depende do evento original, que fica velho após 0,6 s)
  function abrirEm(x, y) {
    try {
      var coord = map.getEventCoordinate({ clientX: x, clientY: y });
      if (coord) abrir(coord);
    } catch (err) {
      console.error('Ferramenta de coordenada:', err);
    }
  }

  vp.addEventListener('pointerdown', function (e) {
    if (window.medindo) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;      // botão direito é tratado abaixo
    if (e.isPrimary === false) { cancelar(); return; }            // segundo dedo = zoom, cancela
    estado.x = e.clientX; estado.y = e.clientY;
    estado.tol = e.pointerType === 'mouse' ? 15 : TOLERANCIA_PX;  // mouse tem mais tremor
    estado.disparou = false;
    cancelar();
    estado.timer = setTimeout(function () {
      estado.disparou = true;
      estado.quando = Date.now();
      abrirEm(estado.x, estado.y);
    }, TEMPO_MS);
  });

  vp.addEventListener('pointermove', function (e) {
    if (!estado.timer) return;
    if (Math.abs(e.clientX - estado.x) > estado.tol || Math.abs(e.clientY - estado.y) > estado.tol) cancelar();
  });

  ['pointerup', 'pointercancel'].forEach(function (nome) {
    vp.addEventListener(nome, function () {
      cancelar();
      if (estado.disparou) {
        if (nome === 'pointerup') copiar(atual).then(marcarCopiado);   // ao soltar, o navegador libera a cópia
        fecharPopupQgis();                                             // fecha o balão que o mesmo toque pode abrir
        estado.disparou = false;
      }
    });
  });

  // botão direito no PC (e toque longo em alguns Androids, que também dispara contextmenu)
  vp.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (window.medindo) return;
    if (Date.now() - estado.quando < 1500) return;                   // já tratado pelo toque longo
    estado.quando = Date.now();
    abrirEm(e.clientX, e.clientY);
  });

  // Ctrl+clique (ou Cmd+clique) no PC: atalho imediato, sem esperar
  vp.addEventListener('click', function (e) {
    if (window.medindo || !(e.ctrlKey || e.metaKey)) return;
    estado.quando = Date.now();
    abrirEm(e.clientX, e.clientY);
    fecharPopupQgis();
  });
})();
