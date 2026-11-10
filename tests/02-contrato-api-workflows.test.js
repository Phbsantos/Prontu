// Contrato frontend ↔ backend: todo endpoint do config.js tem workflow n8n
// correspondente (método + path), e todo workflow é consumido pelo frontend.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const CONFIG = h.carregarConfig();
const WFS = h.workflows();
const ENDPOINTS = CONFIG.ENDPOINTS;

// Chaves que o config.js declara só como referência (sem workflow, sem uso).
const ORFAS_DOCUMENTADAS = ['SUPERVISOR_EQUIPE_DIA', 'COORDENACAO_METRICAS'];

// Endpoints com workflow pronto no backend, mas sem nenhuma tela que os consuma
// ainda (cadastro de plano/especialidade só existia via seed). Se uma tela passar
// a usar, o teste abaixo falha e a chave deve sair desta lista.
const BACKEND_SEM_UI = ['LISTAR_PLANOS', 'PLANO_REGISTRAR', 'ESPECIALIDADE_REGISTRAR'];

// Método HTTP esperado pela convenção do nome da chave / path.
function metodoEsperado(chave, path) {
    if (path.startsWith('/listar/')) return 'GET';
    if (/_REMOVER$/.test(chave)) return 'DELETE';
    return 'POST';
}

const usadosNoCodigo = new Set(
    [...h.arquivosJs(), ...h.paginasHtml()]
        .flatMap((a) => [...h.read(a).matchAll(/ENDPOINTS\.([A-Z_]+)/g)].map((m) => m[1])),
);

test('config.js: API_BASE é HTTPS e aponta para o backend da VPS', () => {
    assert.match(CONFIG.API_BASE, /^https:\/\//);
    assert.equal(CONFIG.API_BASE, 'https://38-72-132-152.sslip.io/webhook');
});

test('config.js: nenhum backend antigo/inseguro referenciado', () => {
    const fonte = h.read('js/config.js').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(fonte, /localhost|127\.0\.0\.1|http:\/\/|phbsantos/);
});

test('config.js: todo path de endpoint começa com "/" e usa kebab-case', () => {
    for (const [chave, p] of Object.entries(ENDPOINTS)) {
        assert.match(p, /^\/[a-z]+(\/[a-z-]+)+$/, `${chave}: ${p}`);
    }
});

test('config.js: não há dois endpoints com o mesmo path', () => {
    const paths = Object.values(ENDPOINTS);
    assert.deepEqual(paths.filter((p, i) => paths.indexOf(p) !== i), []);
});

test('config.js: todas as feature flags são booleanas', () => {
    for (const [k, v] of Object.entries(CONFIG.FEATURES)) {
        assert.equal(typeof v, 'boolean', k);
    }
});

for (const [chave, path] of Object.entries(ENDPOINTS)) {
    if (ORFAS_DOCUMENTADAS.includes(chave)) continue;

    test(`endpoint ${chave} (${path}) tem workflow com o mesmo método e path`, () => {
        const wf = WFS.find((w) => `/${w.caminho}` === path);
        assert.ok(wf, `nenhum workflow expõe ${path}`);
        assert.equal(wf.metodo, metodoEsperado(chave, path), `método do workflow ${wf.arquivo}`);
    });

    if (BACKEND_SEM_UI.includes(chave)) continue;

    test(`endpoint ${chave} é usado em algum arquivo do frontend`, () => {
        assert.ok(usadosNoCodigo.has(chave), `${chave} não é referenciado — remover ou usar`);
    });
}

test('endpoints órfãos documentados continuam sem workflow (senão remover da lista)', () => {
    for (const chave of ORFAS_DOCUMENTADAS) {
        assert.ok(ENDPOINTS[chave], `${chave} saiu do config; atualizar a lista do teste`);
        assert.ok(!WFS.some((w) => `/${w.caminho}` === ENDPOINTS[chave]));
        assert.ok(!usadosNoCodigo.has(chave), `${chave} passou a ser usado`);
    }
});

test('endpoints "backend sem UI" continuam sem uso (senão remover da lista)', () => {
    for (const chave of BACKEND_SEM_UI) assert.ok(!usadosNoCodigo.has(chave), `${chave} agora é usado`);
});

test('todo workflow é consumido por um endpoint do config.js', () => {
    const pathsConfig = new Set(Object.values(ENDPOINTS));
    const sobrando = WFS.filter((w) => !pathsConfig.has(`/${w.caminho}`)).map((w) => w.arquivo);
    assert.deepEqual(sobrando, []);
});

test('todo ENDPOINTS.X usado no código existe no config.js', () => {
    const inexistentes = [...usadosNoCodigo].filter((c) => !(c in ENDPOINTS));
    assert.deepEqual(inexistentes, []);
});
