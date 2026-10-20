# Landing page

- `landing.template.html`: the page (used for both the private claude.ai preview and the public site).
- `build_site.py`: builds the public site into `/docs` (served by GitHub Pages).
- `signup.js`: public sign-up form, posts to a Formspree endpoint.

## Rebuild
```bash
cd dropship-app/mobile && EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir /tmp/web
python3 dropship-app/landing/build_site.py /tmp/web docs
```

## Turn on GitHub Pages
Repo **Settings > Pages > Build and deployment**: Source **Deploy from a branch**, branch `claude/trusting-turing-2xgi7q`
(or `main` once merged), folder **/docs**, Save. The site appears at https://hlulanij.github.io/hlulanij/ in a minute or two.

## Turn on sign-ups
1. Create a free form at https://formspree.io (sign in, New form, set the email that should receive sign-ups).
2. Copy the form URL (looks like `https://formspree.io/f/abcdwxyz`).
3. Put it in `docs/config.js` as `window.DROPIT_FORM_ENDPOINT = "...";` and commit.
Until then the form shows "Sign-ups open soon" and cannot be submitted.
