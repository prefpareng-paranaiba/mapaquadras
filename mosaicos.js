// =====================================================================================
// mosaicos.js — LISTA DE MOSAICOS;
//
//
// Para adicionar um mosaico novo:
//   1) gere os tiles (gdal2tiles) e coloque a pasta em  mosaicos/<nome_da_pasta>/z/x/y.webp
//   2) acrescente uma linha na lista abaixo (veja o exemplo comentado)
//
// MOSAICOS_BASE: de onde os tiles são baixados.
//   ''            -> mesma pasta do site (precisa subir as pastas de tiles junto)
//   'https://meu-bucket.exemplo.com/mosaicos/' -> tiles hospedados à parte (site leve, tiles no R2/S3/Pages)
// =====================================================================================
var MOSAICOS_BASE = 'mosaicos/';
var MOSAICOS_EXT = 'webp';

var mosaicos = [
  { nome: 'Santa Mônica', pasta: 'santa_monica', minZoom: 15, maxZoom: 21, extensao: [-51.20305, -19.68226, -51.19432, -19.67535] /* [oeste, sul, leste, norte] em graus; PREENCHA p/ evitar pedidos 404 fora do mosaico */ }
  // outro bairro: { nome: 'Outro Bairro (drone)', pasta: 'outro_bairro', minZoom: 15, maxZoom: 21 }
];
