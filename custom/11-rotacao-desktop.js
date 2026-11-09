// ================= ROTAÇÃO NO COMPUTADOR (estilo Google Earth) =================
// - segurar o botão do meio do mouse e arrastar para os lados gira o mapa
// - controle circular no canto superior direito: arraste o anel, ou use as setas ◀ ▶ (segure para girar contínuo);
//   a rosa dos ventos no centro gira junto com o mapa e, ao clicar, volta para o norte
(function () {
  var view = map.getView();
  var ROSA = window.ROSA_SVG_URL;

  // 1) o OpenLayers "gruda" no norte quando a rotação chega perto de 0 (a sensação de snap): desliga essa restrição
  try {
    if (view.constraints_ && typeof view.constraints_.rotation === 'function') {
      view.constraints_.rotation = function (r) { return r; };
    }
  } catch (e) { console.warn('Rotação livre:', e); }
  // 2) no celular, o giro com dois dedos só começava depois de ~17° de torção e então "pulava": começa quase de imediato
  try {
    map.getInteractions().getArray().slice().forEach(function (i) {
      if (i instanceof ol.interaction.PinchRotate) map.removeInteraction(i);
    });
    map.addInteraction(new ol.interaction.PinchRotate({ threshold: 0.04 }));
  } catch (e) { console.warn('Giro com dois dedos:', e); }

  var st = document.createElement('style');
  st.textContent =
    '#ctlRotacao{display:none;position:fixed;right:10px;top:10px;z-index:10000;width:88px;height:88px;border-radius:50%;' +
      'background:rgba(255,255,255,.92);box-shadow:0 1px 6px rgba(0,0,0,.45);user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab}' +
    '#ctlRotacao.girando{cursor:grabbing}' +
    '#ctlRotacao .rotCentro{position:absolute;left:19px;top:19px;width:50px;height:50px;border-radius:50%;background:#fff;' +
      'box-shadow:inset 0 0 0 1px #cfd8dc;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
    '#ctlRotacao .rotCentro img{width:42px;height:42px;pointer-events:none;display:block}' +
    '#ctlRotacao .rotSeta{position:absolute;top:30px;width:19px;height:28px;border:0;background:none;color:#37474f;font-size:13px;' +
      'line-height:28px;padding:0;cursor:pointer;text-align:center}' +
    '#ctlRotacao .rotSeta:hover{color:#1e88e5}#ctlRotacao .rotSeta:active{color:#0d47a1}' +
    '#ctlRotacao .rotE{left:0}#ctlRotacao .rotD{right:0}' +
    // só no computador (mouse): o controle circular substitui a rosa simples; no celular continua a rosa de antes
    '@media (hover:hover) and (pointer:fine){#rosaVentos{display:none !important}#ctlRotacao{display:block}}' +
    '';
  document.head.appendChild(st);

  var el = document.createElement('div');
  el.id = 'ctlRotacao';
  el.title = 'Arraste o anel para girar o mapa (ou segure o botão do meio do mouse no mapa)';
  el.innerHTML =
    '<button class="rotSeta rotE" aria-label="Girar para a esquerda" title="Girar para a esquerda (segure)">◀</button>' +
    '<button class="rotSeta rotD" aria-label="Girar para a direita" title="Girar para a direita (segure)">▶</button>' +
    '<div class="rotCentro" role="button" aria-label="Voltar o mapa para o norte" title="Voltar para o norte"><img alt="" draggable="false"></div>';
  document.body.appendChild(el);
  var img = el.querySelector('img');
  img.src = ROSA;

  function rot() { return view.getRotation() || 0; }
  function pintar() { img.style.transform = 'rotate(' + rot() + 'rad)'; }
  view.on('change:rotation', pintar);
  pintar();

  // centro: volta para o norte pelo caminho mais curto
  el.querySelector('.rotCentro').addEventListener('click', function (e) {
    e.stopPropagation();
    var v = 2 * Math.PI, r = rot();
    view.setRotation(r - v * Math.round(r / v));
    view.animate({ rotation: 0, duration: 300 });
  });
  el.querySelector('.rotCentro').addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  // setas: um toque gira 5°; segurando, gira continuamente
  function seta(botao, sinal) {
    var t1 = null, t2 = null;
    function parar() { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; }
    botao.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      view.setRotation(rot() + sinal * 5 * Math.PI / 180);
      t1 = setTimeout(function () {
        t2 = setInterval(function () { view.setRotation(rot() + sinal * 0.035); }, 30);
      }, 350);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { botao.addEventListener(n, parar); });
  }
  seta(el.querySelector('.rotE'), -1);
  seta(el.querySelector('.rotD'), +1);

  // anel: arrastar em volta do centro gira o mapa acompanhando o dedo/mouse
  var giro = null;
  function angulo(e) {
    var r = el.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }
  el.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    giro = { a: angulo(e), r: rot() };
    el.classList.add('girando');
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', function (e) {
    if (!giro) return;
    var d = angulo(e) - giro.a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    giro.a = angulo(e); giro.r += d;
    view.setRotation(giro.r);
  });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    el.addEventListener(n, function () { giro = null; el.classList.remove('girando'); });
  });

  // botão do meio do mouse no mapa: arrastar para os lados gira
  var vp = map.getViewport(), meio = null;
  vp.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });   // evita o "rolagem automática" do navegador
  vp.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
  vp.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 1) return;
    e.preventDefault();
    meio = { x: e.clientX, r: rot() };
    try { vp.setPointerCapture(e.pointerId); } catch (x) {}
  });
  vp.addEventListener('pointermove', function (e) {
    if (!meio) return;
    if (!(e.buttons & 4)) { meio = null; return; }
    view.setRotation(meio.r + (e.clientX - meio.x) * 0.008);
  });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    vp.addEventListener(n, function (e) { if (meio && (n === 'pointercancel' || e.button === 1)) meio = null; });
  });
})();
