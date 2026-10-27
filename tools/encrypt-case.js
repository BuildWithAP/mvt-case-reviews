/* Encrypt one case page into its folder.
   Reads a self-contained plaintext HTML file (kept OUTSIDE this repo), encrypts it
   (AES-256-GCM, key from PBKDF2-SHA256 x310k, fresh salt + IV every run) and writes
   <case>/content.enc.js. Stamps <case>/index.html asset URLs with a build hash so
   colleagues who opened an earlier version get the new one.

   Usage:  node tools/encrypt-case.js <case-folder> <plaintext.html> "<passphrase>"
   e.g.    node tools/encrypt-case.js enq-062 ~/cases/review.html "four-random-words-12"

   Name case folders by enquiry reference (enq-062), never by patient name: the
   URL path is not encrypted. To start a new case, copy enq-062/index.html into the
   new folder and change the reference line. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [dir, src, pass] = process.argv.slice(2);
if (!dir || !src || !pass) {
  console.error('Usage: node tools/encrypt-case.js <case-folder> <plaintext.html> "<passphrase>"');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const caseDir = path.join(root, dir);
if (!fs.existsSync(path.join(caseDir, 'index.html'))) {
  console.error('Missing ' + dir + '/index.html (copy it from an existing case folder).');
  process.exit(1);
}
if (path.resolve(src).startsWith(path.resolve(root) + path.sep)) {
  console.error('Keep the plaintext outside the repo.');
  process.exit(1);
}

const html = fs.readFileSync(src);
const ITER = 310000;
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pass, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(html), cipher.final()]);
const tag = cipher.getAuthTag();   // appended, which is the layout WebCrypto expects

const out = {
  v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: ITER,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: Buffer.concat([ct, tag]).toString('base64')
};
fs.writeFileSync(path.join(caseDir, 'content.enc.js'), 'window.CASE_ENC = ' + JSON.stringify(out) + ';\n');
console.log('Wrote ' + dir + '/content.enc.js (' + (html.length / 1024).toFixed(0) + ' KB plaintext).');

const build = crypto.createHash('sha256').update(out.ct).digest('hex').slice(0, 8);
const indexPath = path.join(caseDir, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8')
  .replace(/((?:\.\.\/assets\/(?:gate\.css|gate\.js))|content\.enc\.js)(\?v=[^"]*)?"/g, (m, f) => `${f}?v=${build}"`);
fs.writeFileSync(indexPath, index);
console.log('Stamped ' + dir + '/index.html with build ' + build + '.');
