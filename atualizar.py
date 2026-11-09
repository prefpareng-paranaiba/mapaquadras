#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atualizar.py — traz uma NOVA exportação do qgis2web para dentro do site SEM perder nada seu.

USO (no Windows, pelo Prompt do OSGeo4W / "Python Console" do QGIS, ou qualquer Python 3):
    python atualizar.py "C:\\caminho\\da\\pasta_exportada_pelo_qgis2web"
    python atualizar.py "C:\\caminho\\da\\exportacao" --simular      (só mostra o que faria)

O QUE ELE FAZ
  Substitui (vindo do qgis2web):   layers/   styles/   resources/   e as linhas <script> de dados/estilo no index.html
  NÃO TOCA em:                     custom/  mosaicos.js  mosaicos/  perf.js  sw.js  ruas.json  README.txt
                                   e o resto do index.html (o seu index.html é o "mestre"; o do qgis2web é ignorado)
  Sem backup por padrão (o Git guarda o histórico). Com --backup, copia o que vai ser trocado para _backup/AAAA-MM-DD_HHMM/
"""
import os, re, sys, shutil, datetime, tempfile

SITE = os.path.dirname(os.path.abspath(__file__))
SRC_RE = re.compile(r'''<script[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*</script>''', re.I)
DADOS_RE = re.compile(r'^(?:\./)?(layers|styles)/')

def ler(p):
    with open(p, encoding='utf-8') as f: return f.read()
def gravar(p, s):
    with open(p, 'w', encoding='utf-8', newline='') as f: f.write(s)
def norm(s): return re.sub(r'^\./', '', s)

def tags_dados(html):
    return [m.group(1) for m in SRC_RE.finditer(html) if DADOS_RE.match(m.group(1))]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    simular = '--simular' in sys.argv
    fazer_backup = '--backup' in sys.argv      # por padrão NÃO cria backup: o histórico do Git já guarda tudo
    if not args:
        print(__doc__); sys.exit(1)
    exp = os.path.abspath(args[0])
    for need in ('index.html', 'layers', 'styles', 'resources'):
        if not os.path.exists(os.path.join(exp, need)):
            sys.exit('ERRO: "%s" não parece ser uma exportação do qgis2web (falta %s).' % (exp, need))
    if os.path.samefile(exp, SITE):
        sys.exit('ERRO: a pasta exportada não pode ser a mesma pasta do site. Exporte para outra pasta.')

    idx_site = os.path.join(SITE, 'index.html')
    html_site, html_exp = ler(idx_site), ler(os.path.join(exp, 'index.html'))
    velhos, novos = tags_dados(html_site), tags_dados(html_exp)

    # 0) ESTILO FALTANDO na exportação (o qgis2web às vezes falha ao converter regras do QGIS, ex.: $id = @atlas_featureid)
    #    -> mantém o arquivo de estilo que já está no site, para o mapa não quebrar.
    manter_estilos = []
    for x in novos:
        x = norm(x)
        if x.startswith('styles/') and not os.path.exists(os.path.join(exp, x)):
            if os.path.exists(os.path.join(SITE, x)):
                manter_estilos.append(x)
                print('AVISO: a exportação NÃO gerou %s (erro de estilo no QGIS). Mantendo o arquivo atual do site.' % x)
            else:
                sys.exit('ERRO: a exportação não gerou %s e o site não tem uma cópia antiga. Corrija o estilo no QGIS e exporte de novo. Nada foi alterado.' % x)
    guardados = {}
    for x in manter_estilos:
        with open(os.path.join(SITE, x), 'rb') as f: guardados[x] = f.read()

    stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M')
    bkp = os.path.join(SITE, '_backup', stamp)
    def log(*a): print(('[simulação] ' if simular else '') + ' '.join(a))

    # 1) backup do que será substituído
    for d in (('layers', 'styles', 'resources') if fazer_backup else ()):
        if os.path.isdir(os.path.join(SITE, d)):
            log('backup:', d, '->', os.path.relpath(os.path.join(bkp, d), SITE))
            if not simular: shutil.copytree(os.path.join(SITE, d), os.path.join(bkp, d))
    if fazer_backup and not simular and os.path.isdir(bkp): shutil.copy2(idx_site, os.path.join(bkp, 'index.html'))

    # 2) layers/ e styles/ são espelhados (apaga o que não existe mais na exportação); resources/ só sobrescreve
    for d, espelho in (('layers', True), ('styles', True), ('resources', False)):
        log('copiando', d + '/', '(espelho)' if espelho else '(sobrescreve)')
        if simular: continue
        dst = os.path.join(SITE, d)
        if espelho and os.path.isdir(dst): shutil.rmtree(dst)
        shutil.copytree(os.path.join(exp, d), dst, dirs_exist_ok=True)
    if not simular:
        for x, dados in guardados.items():
            with open(os.path.join(SITE, x), 'wb') as f: f.write(dados)
    if os.path.isdir(os.path.join(exp, 'webfonts')) and not simular:
        shutil.copytree(os.path.join(exp, 'webfonts'), os.path.join(SITE, 'webfonts'), dirs_exist_ok=True)

    # 3) linhas <script> de dados/estilo no index.html (nova camada, camada renomeada, camada removida)
    if [norm(x) for x in velhos] != [norm(x) for x in novos]:
        log('index.html: atualizando linhas <script> das camadas:')
        for x in novos: log('    +', x)
        if not simular:
            achou = [False]
            def troca(m):
                if not DADOS_RE.match(m.group(1)): return m.group(0)
                if achou[0]: return ''
                achou[0] = True
                return ('\n' + ' ' * 8).join('<script src="%s"></script>' % x for x in novos)
            novo_html = SRC_RE.sub(troca, html_site)
            gravar(idx_site, novo_html)
    else:
        log('index.html: linhas das camadas iguais, nada a mudar.')

    # 4) camada RENOMEADA no QGIS: ajusta o nome nas variáveis lyr_/json_/style_ usadas pelo seu código
    dv = [norm(x)[7:-3] for x in velhos if norm(x).startswith('layers/') and not x.endswith('layers.js')]
    dn = [norm(x)[7:-3] for x in novos if norm(x).startswith('layers/') and not x.endswith('layers.js')]
    if dv != dn:
        if len(dv) == 1 and len(dn) == 1:
            log('camada renomeada: %s -> %s ; ajustando perf.js e custom/*.js' % (dv[0], dn[0]))
            if not simular:
                alvos = [os.path.join(SITE, 'perf.js')] + [os.path.join(SITE, 'custom', f) for f in os.listdir(os.path.join(SITE, 'custom'))]
                for a in alvos:
                    if a.endswith('.js') and os.path.exists(a):
                        s = ler(a)
                        if dv[0] in s: gravar(a, s.replace(dv[0], dn[0]))
        else:
            print('\nATENÇÃO: o conjunto de camadas mudou (%s -> %s).' % (dv, dn))
            print('         Confira em perf.js e custom/*.js se algum nome "lyr_..." precisa ser ajustado.')

    print('\nPronto.' + (' (nada foi alterado)' if simular else ' Abra o index.html (ou rode um servidor local) e confira.'))
    if fazer_backup and not simular: print('Backup do que foi trocado: _backup/%s' % stamp)
    elif not simular: print('Sem backup (use --backup se quiser). Para desfazer: descarte as mudanças no GitHub Desktop.')

if __name__ == '__main__':
    main()
