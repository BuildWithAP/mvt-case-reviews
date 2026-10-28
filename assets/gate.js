/* Aster MVT case reviews: passphrase gate, shared by every case folder.
   Each case ships encrypted (<case>/content.enc.js sets window.CASE_ENC). This prompts
   for the passphrase, derives a key (PBKDF2-SHA256, 310k iterations) and decrypts
   (AES-256-GCM) in the browser. The repo and the published site only hold ciphertext,
   and the passphrase never leaves the device.
   The unlocked page is kept in sessionStorage so a reload in the same tab doesn't
   re-prompt. It clears when the tab closes. */
(function () {
  var ENC = window.CASE_ENC;
  /* Key the cached copy to this case and this build. The salt changes on every
     encrypt, so a republished page replaces any copy held in an open tab. */
  var SKEY = 'mvt_case_' + location.pathname + '_' + (ENC && ENC.salt ? ENC.salt.slice(0, 12) : 'none');

  var PKEY = 'mvt_case_team_pass';

  function b64ToBuf(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  async function decrypt(pass) {
    var enc = new TextEncoder();
    var base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64ToBuf(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(ENC.iv) }, key, b64ToBuf(ENC.ct));
    return new TextDecoder().decode(pt);
  }

  /* document.open() is ignored while the HTML parser is still running, so wait for
     load before swapping the gate for the case page. */
  function whenParsed(fn) {
    if (document.readyState === 'complete') fn();
    else window.addEventListener('load', fn, { once: true });
  }

  function launch(html) {
    try { sessionStorage.setItem(SKEY, html); } catch (e) {}
    whenParsed(function () {
      document.open();
      document.write(html);
      document.close();
    });
  }

  function showGate() {
    var form = document.getElementById('gate-form');
    var input = document.getElementById('gate-pass');
    var err = document.getElementById('gate-err');
    var btn = form.querySelector('button');
    var btnLabel = btn.textContent;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pass = input.value.trim();
      if (!pass) return;
      btn.disabled = true; btn.textContent = 'Unlocking…'; err.textContent = '';
      try {
        launch(await decrypt(pass));
        try { sessionStorage.setItem(PKEY, pass); } catch (e) {}
      } catch (ex) {
        err.textContent = 'That passphrase is not right. Check it with the MVT team and try again.';
        btn.disabled = false; btn.textContent = btnLabel;
        input.select();
      }
    });
    input.focus();
  }

  if (!window.isSecureContext || !window.crypto || !crypto.subtle) {
    document.getElementById('gate-err').textContent =
      'This page needs a secure (https) connection to decrypt. Open the published link rather than a local file.';
    return;
  }

  var cached = null;
  try { cached = sessionStorage.getItem(SKEY); } catch (e) {}
  if (cached) { launch(cached); return; }

  if (!ENC) {
    document.getElementById('gate-err').textContent = 'The encrypted file is missing from this deployment.';
    return;
  }

  /* New case pages share the team passphrase. Once it has opened one page in this tab,
     try it on the next before asking (a case with its own passphrase still prompts). */
  var known = null;
  try { known = sessionStorage.getItem(PKEY); } catch (e) {}
  if (known) {
    decrypt(known).then(launch, showGate);
  } else {
    showGate();
  }
})();
