"""Builds the public GitHub Pages site into <repo>/docs from landing.template.html.

Usage: python3 build_site.py <expo-web-export-dir> <repo-docs-dir>
  Export the app first:  cd ../mobile && EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir /tmp/web
"""
import glob, os, shutil, sys

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
print('built', out)
