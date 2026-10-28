# MVT case reviews

Passphrase-gated case review pages for Aster Medical Value Travel, served by GitHub Pages.

Every case page is encrypted before it is committed (AES-256-GCM, key derived from the passphrase with PBKDF2-SHA256 at 310,000 iterations). The browser decrypts it with WebCrypto, so this repo and the published site hold only ciphertext. Plaintext pages never enter the repo.

## Layout

- `index.html` + `content.enc.js` (site root): the **patient list**, gated by the team passphrase. Built from the MVT lead tracker by the private `mvt-case-reviews-src/` folder (`./publish.sh`), never edited here.
- `assets/`: the shared gate (`gate.js`, `gate.css`) and logo
- `enq-###/`: one folder per case page (ENQ-061 onward appear in the list), named by enquiry reference, never by patient name (URLs are not encrypted). `index.html` is the gate, `content.enc.js` is the encrypted page
- `tools/encrypt-case.js`: encrypts a plaintext page into a case folder

## Add or update a case

```bash
node tools/encrypt-case.js enq-062 /path/outside/repo/review.html "passphrase"
```

New case pages are published with the `mvt-case-review` skill (`~/.claude/skills/mvt-case-review/scripts/publish_case.sh`), which creates the gate from a template and encrypts with the **team passphrase**, the same one that opens the list. Once a tab has unlocked one page, the gate tries that passphrase on the next page before prompting. ENQ-062 predates this and keeps its own passphrase.

To take a case down, delete its folder and push. Copies already opened in a browser tab, and the git history, still exist. If a passphrase leaks, re-encrypt with a new passphrase and rewrite the history.
