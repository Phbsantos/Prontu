// Utilitários compartilhados pelos testes. Zero dependências: só Node (node:test).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

const abs = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
const exists = (rel) => fs.existsSync(abs(rel));
const list = (rel, filtro = () => true) =>
    fs.readdirSync(abs(rel)).filter(filtro).sort();

const paginasHtml = () => list('.', (f) => f.endsWith('.html'));
const arquivosJs = () => [
    ...list('js', (f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...list('js/components', (f) => f.endsWith('.js')).map((f) => `js/components/${f}`),
];

// Carrega scripts do frontend num contexto isolado e devolve os globais pedidos.
function carregarGlobais(arquivos, nomes, extras = {}) {
    const ctx = vm.createContext({ console, URLSearchParams, Date, ...extras });
    for (const arq of arquivos) {
        vm.runInContext(read(arq), ctx, { filename: arq });
    }
    const saida = {};
    for (const nome of nomes) saida[nome] = vm.runInContext(nome, ctx);
    return saida;
}

const carregarConfig = () => carregarGlobais(['js/config.js'], ['CONFIG']).CONFIG;

// Scripts <script src> de uma página, na ordem, separando externos de locais.
function scriptsDaPagina(html) {
    const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    return {
        todos: srcs,
        locais: srcs.filter((s) => !/^https?:/.test(s)),
        externos: srcs.filter((s) => /^https?:/.test(s)),
    };
}

function workflows() {
    return list('db/n8n-workflows', (f) => /^\d+_.*\.json$/.test(f)).map((arquivo) => {
        const wf = JSON.parse(read(`db/n8n-workflows/${arquivo}`));
        const webhook = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
        return {
            arquivo,
            numero: parseInt(arquivo, 10),
            wf,
            webhook,
            metodo: webhook && webhook.parameters.httpMethod,
            caminho: webhook && webhook.parameters.path,
        };
    });
}

const migrations = () => list('db/migrations', (f) => f.endsWith('.sql'));

module.exports = {
    ROOT, abs, read, exists, list, paginasHtml, arquivosJs,
    carregarGlobais, carregarConfig, scriptsDaPagina, workflows, migrations,
};
