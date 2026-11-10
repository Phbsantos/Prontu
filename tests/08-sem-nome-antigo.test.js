// Guarda: o nome antigo do produto não pode voltar a aparecer em nenhum arquivo
// de texto nem em nome de arquivo. O termo é montado em partes para este próprio
// arquivo não conter a palavra.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const PROIBIDOS = [['equi', 'tar'], ['eq', 'tr']].map((p) => new RegExp(p.join(''), 'i'));
const IGNORAR = new Set(['.git', 'node_modules']);
const BINARIA = /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip)$/i;

function arquivos(dir, acumulado = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORAR.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) arquivos(p, acumulado); else acumulado.push(p);
    }
    return acumulado;
}

const TODOS = arquivos(h.ROOT).map((p) => path.relative(h.ROOT, p).split(path.sep).join('/'));

test('nenhum nome de arquivo ou pasta contém o nome antigo', () => {
    assert.deepEqual(TODOS.filter((f) => PROIBIDOS.some((re) => re.test(f))), []);
});

test('nenhum conteúdo de arquivo de texto menciona o nome antigo', () => {
    const achados = TODOS.filter((f) => !BINARIA.test(f))
        .filter((f) => PROIBIDOS.some((re) => re.test(fs.readFileSync(h.abs(f), 'utf8'))));
    assert.deepEqual(achados, []);
});

test('identificadores técnicos usam o prefixo atual (banco, usuário, credencial, workflows)', () => {
    const cred = JSON.parse(h.read('db/n8n-workflows/_reference/credential_postgres.example.json'))[0];
    assert.equal(cred.id, 'prtPgCredential01');
    assert.equal(cred.data.database, 'prontu_db');
    assert.equal(cred.data.user, 'prontu_user');
    for (const w of h.workflows()) assert.match(w.wf.id, /^prt\d{2}[A-Z]/, w.arquivo);
});
