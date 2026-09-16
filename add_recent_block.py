"""BadgeIA : insere un bloc 'Derniers articles' (maillage interne) dans chaque
article du blog. Idempotent (marqueur recent-articles). Les liens sont relatifs
(les articles vivent tous dans /blog/)."""
import glob, os, re, html as htmllib

DATE_RE = re.compile(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"')
H1_RE = re.compile(r'<h1[^>]*>(.*?)</h1>', re.S)
TAG_RE = re.compile(r'<[^>]+>')

arts = {}
for path in sorted(glob.glob('blog/*.html')):
    fn = os.path.basename(path)
    if fn in ('index.html',):
        continue
    txt = open(path, encoding='utf-8').read()
    m = DATE_RE.search(txt)
    h = H1_RE.search(txt)
    if not m or not h:
        print('SKIP (pas de date/h1):', fn)
        continue
    title = htmllib.unescape(TAG_RE.sub('', h.group(1))).strip()
    arts[fn] = (m.group(1), title)

print(f'{len(arts)} articles dates')
recent = sorted(arts.items(), key=lambda kv: kv[1][0], reverse=True)[:9]
print('recents:', [f for f, _ in recent])

def block_for(fn):
    picks = [(f, t) for f, (d, t) in recent if f != fn][:6]
    links = ' · '.join(f'<a href="{f}">{htmllib.escape(t, quote=False)}</a>' for f, t in picks)
    return ('        <hr class="recent-articles">\n'
            f'        <p><strong>Derniers articles :</strong> {links}</p>\n')

changed, skipped = [], []
for fn in arts:
    path = f'blog/{fn}'
    txt = open(path, encoding='utf-8').read()
    if 'recent-articles' in txt:
        skipped.append(fn)
        continue
    block = block_for(fn)
    # insertion avant le <hr> qui precede "Guides par plateforme", sinon avant
    # le DERNIER <hr> du fichier (bandeau de navigation de fin), sinon </article>
    m = re.search(r'\n(\s*)<hr>\s*\n\s*<p>Guides par plateforme', txt)
    if m:
        txt = txt[:m.start()] + '\n' + block + txt[m.start() + 1:]
    elif '<hr>' in txt:
        i = txt.rfind('<hr>')
        txt = txt[:i] + block.rstrip() + '\n          ' + txt[i:]
    elif '</article>' in txt:
        txt = txt.replace('</article>', block + '      </article>', 1)
    else:
        print('SKIP (pas de point d insertion):', fn)
        continue
    open(path, 'w', encoding='utf-8').write(txt)
    changed.append(fn)

print(f'{len(changed)} modifies, {len(skipped)} deja faits')

# verif : tous les liens inseres pointent vers des fichiers existants
bad = []
for fn in changed:
    txt = open(f'blog/{fn}', encoding='utf-8').read()
    m = re.search(r'<hr class="recent-articles">\s*<p>(.*?)</p>', txt, re.S)
    for href in re.findall(r'href="([^"]+)"', m.group(1)):
        if not os.path.isfile(f'blog/{href}'):
            bad.append((fn, href))
    if fn in re.findall(r'href="([^"]+)"', m.group(1)):
        bad.append((fn, 'AUTO-LIEN'))
print('liens casses:', bad or 'aucun')
assert not bad
