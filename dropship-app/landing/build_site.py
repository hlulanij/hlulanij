"""Builds the public GitHub Pages site into <repo>/docs from landing.template.html.

Usage: python3 build_site.py <expo-web-export-dir> <repo-docs-dir>
  Export the app first:  cd ../mobile && EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir /tmp/web
"""
import glob, json, os, shutil, sys

web, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
page = open(os.path.join(here, 'landing.template.html'), encoding='utf-8').read()

# Drop the claude.ai-only meta tag; the live app becomes a separate cacheable file.
page = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
start = page.index("<script>\n(function(){")
end = page.index('<script>{{BUNDLE}}</script>')
page = page[:start] + '<script src="config.js"></script>\n<script src="signup.js" defer></script>\n' + '<script src="app.js" defer></script>' + page[end + len('<script>{{BUNDLE}}</script>'):]

# The artifact version says only the owner can read sign-ups through claude.ai; on the web it is the form service.
page = page.replace('Only the DropIt owner can see them.', 'We never share them.')

# Real download options on the public site (the claude.ai preview keeps the "coming soon" badges).
def swap(old, new):
    global page
    assert page.count(old) == 1, old[:60]
    page = page.replace(old, new)
swap("The iPhone and Android apps are being prepared for release. You can use the full app in your browser today, and join the list to hear the day it lands in your app store.",
     "Review it today: install the Android preview, or add the web app to the home screen of any phone. Both use sample data. Join the list to hear when the App Store and Google Play versions land.")
i0 = page.index('<div class="stores"'); i1 = page.index('</div>\n        <div class="cta">', i0)
j1 = page.index('</div>', i1 + 6) + len('</div>')
page = page[:i0] + '''<div class="cta">
          <a class="btn" href="app/">Open the web app</a>
          <a class="btn ghost" href="https://github.com/hlulanij/hlulanij/releases/download/preview/dropit-preview.apk">Download for Android</a>
        </div>
        <p class="fine" style="margin-top:14px">Android: open the downloaded file and allow "install unknown apps" if asked. iPhone: open the web app in Safari, tap Share, then Add to Home Screen. No account needed.</p>''' + page[j1:]

favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23d6001f'/%3E%3Cpath d='M9 8h8a7 7 0 0 1 0 14H9z' fill='none' stroke='white' stroke-width='3.5' stroke-linejoin='round'/%3E%3C/svg%3E"
head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="DropIt: order food, groceries, pharmacy items, shopping and parcels from stores near you, delivered by local drivers.">
<meta name="theme-color" content="#d6001f">
<meta property="og:title" content="DropIt">
<meta property="og:description" content="From the corner store to your front door. Preview build with sample data.">
<link rel="icon" href="{favicon}">
<style>:root{{color-scheme:light}}body{{margin:0}}</style>
'''
# template starts with <title>…; everything else follows inside the head, then body starts at <header>
i = page.index('<header class="wrap nav">')
html = head + page[:i] + '</head>\n<body>\n' + page[i:] + '\n</body>\n</html>\n'
html = html.replace('<noscript>', '')  # none present; keeps the replace harmless
html = html.replace('<main id="top">', '<noscript><p style="padding:16px">DropIt needs JavaScript for the live preview and the sign-up form.</p></noscript>\n<main id="top">', 1)

os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
shutil.copy(glob.glob(os.path.join(web, '_expo/static/js/web/*.js'))[0], os.path.join(out, 'app.js'))
open(os.path.join(out, '.nojekyll'), 'w').close()

cfg = os.path.join(out, 'config.js')
if not os.path.exists(cfg):  # never overwrite the owner's endpoint
    open(cfg, 'w').write('''// Paste your Formspree form URL here (see dropship-app/landing/README.md), e.g.
//   window.DROPIT_FORM_ENDPOINT = "https://formspree.io/f/abcdwxyz";
window.DROPIT_FORM_ENDPOINT = "";
''')
shutil.copy(os.path.join(here, 'signup.js'), os.path.join(out, 'signup.js'))

# ---- installable web app (PWA) at <out>/app/
app = os.path.join(out, 'app')
os.makedirs(app, exist_ok=True)
shutil.copy(os.path.join(out, 'app.js'), os.path.join(app, 'app.js'))
from PIL import Image
icon = Image.open(os.path.join(here, '..', 'mobile', 'assets', 'icon.png')).convert('RGB')
for name, px in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
    icon.resize((px, px), Image.LANCZOS).save(os.path.join(app, name))
open(os.path.join(app, 'manifest.webmanifest'), 'w').write(json.dumps({
    'name': 'DropIt', 'short_name': 'DropIt', 'description': 'Order food, groceries, pharmacy, shopping and parcels. Preview with sample data.',
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#f6f6f8', 'theme_color': '#e4002b',
    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
              {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=2))
# Network-first so a new release is never hidden behind a stale cache; cache is only the offline fallback.
open(os.path.join(app, 'sw.js'), 'w').write('''const CACHE = 'dropit-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
''')
open(os.path.join(app, 'index.html'), 'w', encoding='utf-8').write('''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>DropIt</title>
<meta name="theme-color" content="#e4002b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DropIt">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
<style>html,body{height:100%;margin:0;background:#f6f6f8;overflow:hidden}#root{display:flex;height:100%;flex:1}
#bar{position:fixed;left:0;right:0;bottom:0;background:#15161d;color:#f3f3f6;font:13px/1.4 system-ui,sans-serif;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));display:flex;gap:12px;align-items:center;justify-content:space-between;z-index:9}
#bar button{font:inherit;border:0;background:transparent;color:#ff9aa9;font-weight:700;padding:4px 8px}
#root{padding-bottom:0}</style>
</head>
<body>
<div id="root"></div>
<noscript>DropIt needs JavaScript.</noscript>
<div id="bar" hidden><span id="msg"></span><button id="x" type="button">Hide</button></div>
<script src="app.js" defer></script>
<script>
(function () {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var bar = document.getElementById('bar'), msg = document.getElementById('msg');
  document.getElementById('x').onclick = function () { bar.hidden = true; document.getElementById('root').style.paddingBottom = '0'; };
  function show(t) { if (standalone) return; msg.textContent = t; bar.hidden = false; document.getElementById('root').style.paddingBottom = '44px'; }
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) show('Install: tap Share, then Add to Home Screen.');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); show('Install DropIt on this device.');
    var b = document.createElement('button'); b.textContent = 'Install'; b.onclick = function () { e.prompt(); }; bar.insertBefore(b, document.getElementById('x'));
  });
})();
</script>
</body>
</html>
''')
print('built', out)
