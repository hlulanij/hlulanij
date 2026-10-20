import glob, sys
S = sys.argv[1]
js = open(glob.glob(f'{S}/web/_expo/static/js/web/*.js')[0], encoding='utf-8').read().replace('</script', '<\\/script')
page = open(f'{S}/landing.html', encoding='utf-8').read().replace('{{BUNDLE}}', '__B__')
page = page.replace('__B__', js)
open(f'{S}/art/dropit.html','w',encoding='utf-8').write(page)
open(f'{S}/art/test.html','w',encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'+page+'</body></html>')
print(len(page)//1024,'KB')
