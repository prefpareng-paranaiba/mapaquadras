export default {
  async fetch(request) {
    const u = new URL(request.url);
    const z = u.searchParams.get('z'), x = u.searchParams.get('x'), y = u.searchParams.get('y');
    if (![z, x, y].every(v => /^\d+$/.test(v || ''))) return new Response('parâmetros inválidos', { status: 400 });
    const r = await fetch(`https://mt${(+x + +y) % 4}.google.com/vt/lyrs=s&hl=pt-BR&x=${x}&y=${y}&z=${z}`);
    return new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  }
};
