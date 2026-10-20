// Public sign-up form: posts JSON to a form service (Formspree-compatible). No keys in the page.
(function () {
  var form = document.getElementById('signup'), btn = document.getElementById('su-btn'), st = document.getElementById('su-status');
  if (!form) return;
  var endpoint = (window.DROPIT_FORM_ENDPOINT || '').trim();
  var valid = /^https:\/\/(formspree\.io\/f\/|api\.web3forms\.com\/)/.test(endpoint);
  function say(t, k) { st.textContent = t; st.className = 'status' + (k ? ' ' + k : ''); }

  // Honeypot against bots: hidden, real people leave it empty.
  var trap = document.createElement('input');
  trap.type = 'text'; trap.name = '_gotcha'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(trap);

  if (!valid) { btn.disabled = true; say('Sign-ups open soon. In the meantime, try the live preview above.'); return; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = document.getElementById('su-name').value.trim();
    var email = document.getElementById('su-email').value.trim();
    if (name.length < 2) { say('Enter your full name.', 'err'); document.getElementById('su-name').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Enter a valid email address, like name@example.com.', 'err'); document.getElementById('su-email').focus(); return; }
    if (trap.value) { say("You're on the list.", 'good'); return; }
    btn.disabled = true; say('Saving…');
    try {
      var res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name, email: email,
          role: document.getElementById('su-role').value,
          area: document.getElementById('su-area').value.trim(),
          _subject: 'DropIt sign-up'
        })
      });
      if (!res.ok) throw new Error('bad status ' + res.status);
      form.reset();
      say("You're on the list. We'll email you when DropIt launches.", 'good');
    } catch (err) {
      say('We could not save your sign-up. Check your connection and try again.', 'err');
    } finally { btn.disabled = false; }
  });
})();
