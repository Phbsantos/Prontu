// Banco de dados: migrations bem formadas e consistência enum ↔ frontend ↔ workflows.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const MIGS = h.migrations();
const SQL_TODO = MIGS.map((m) => h.read(`db/migrations/${m}`)).join('\n');

// Valores finais de um enum: CREATE TYPE (001) + ALTER TYPE ADD VALUE (002, 005…).
function valoresDoEnum(nome) {
    const criar = SQL_TODO.match(new RegExp(`CREATE TYPE ${nome} AS ENUM \\(([^)]*)\\)`));
    assert.ok(criar, `enum ${nome} não encontrado`);
    const base = [...criar[1].replace(/--.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const extras = [...SQL_TODO.matchAll(new RegExp(`ALTER TYPE ${nome} ADD VALUE IF NOT EXISTS '([^']+)'`, 'g'))]
        .map((m) => m[1]);
    return [...base, ...extras];
}

test('migrations: numeração sequencial de 3 dígitos, sem buracos', () => {
    MIGS.forEach((m, i) => assert.match(m, new RegExp(`^${String(i + 1).padStart(3, '0')}_[a-z0-9_]+\\.sql$`)));
});

for (const m of MIGS) {
    test(`${m}: começa com cabeçalho de comentário explicando a mudança`, () => {
        const sql = h.read(`db/migrations/${m}`);
        assert.match(sql, /^--/);
        assert.ok(sql.split('\n').filter((l) => l.startsWith('--')).length >= 3, 'cabeçalho curto demais');
    });

    test(`${m}: sem DROP TABLE/TRUNCATE/DELETE sem WHERE`, () => {
        const sql = h.read(`db/migrations/${m}`).replace(/--.*$/gm, '');
        assert.doesNotMatch(sql, /\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\s+\w+\s*;/i);
    });
}

test('ALTER TYPE ... ADD VALUE nunca está dentro de BEGIN/COMMIT', () => {
    for (const m of MIGS) {
        const sql = h.read(`db/migrations/${m}`).replace(/--.*$/gm, '');
        if (/ALTER TYPE .* ADD VALUE/i.test(sql)) assert.doesNotMatch(sql, /\bBEGIN\b/i, m);
    }
});

test('toda tabela com updated_at tem trigger set_updated_at', () => {
    const tabelas = [...SQL_TODO.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)];
    assert.ok(tabelas.length >= 10);
    for (const [, nome, corpo] of tabelas) {
        if (/updated_at/.test(corpo)) {
            assert.match(SQL_TODO, new RegExp(`CREATE TRIGGER \\w+\\s+BEFORE UPDATE ON ${nome}\\b`), `falta trigger em ${nome}`);
        }
    }
});

test('senha só existe como hash (sem coluna "senha" em texto)', () => {
    assert.match(SQL_TODO, /senha_hash/);
    assert.doesNotMatch(SQL_TODO.replace(/--.*$/gm, ''), /\bsenha\s+(TEXT|VARCHAR)/i);
});

test('FKs de usuario/paciente nas tabelas de negócio não usam CASCADE (entidades se inativam)', () => {
    const casc = [...SQL_TODO.matchAll(/(\w+)\s+INTEGER[^,\n]*REFERENCES (\w+)\(id\) ON DELETE CASCADE/g)]
        .map((m) => `${m[1]}->${m[2]}`);
    // Permitidos: dados puramente dependentes.
    const permitidos = /^(usuario_id->usuarios|paciente_id->pacientes|recorrencia_id->recorrencias|especialidade_id->especialidades)$/;
    for (const c of casc) assert.match(c, permitidos, `CASCADE inesperado: ${c}`);
});

test('enum status_presenca == mapa do ApiService (nenhum valor sem tratamento no frontend)', () => {
    const valores = valoresDoEnum('status_presenca');
    const { ApiService } = h.carregarGlobais(['js/api.js'], ['ApiService']);
    for (const v of valores) {
        // mapApiStatusToInternal cai em 'pending' por padrão; garantir que o mapeamento é explícito.
        assert.match(h.read('js/api.js'), new RegExp(`['"]?${v}['"]?:\\s*'`), `${v} sem mapeamento explícito`);
        assert.ok(['pending', 'realizado', 'falta', 'desmarcado', 'cancelado'].includes(ApiService.mapApiStatusToInternal(v)));
    }
});

test('valores do <select> de tipo de atendimento existem no enum tipo_atendimento', () => {
    const enumVals = valoresDoEnum('tipo_atendimento');
    for (const pagina of ['coordenacao.html', 'supervisor.html']) {
        const html = h.read(pagina);
        const sel = html.match(/<select[^>]*id="[^"]*tipo[^"]*"[^>]*>([\s\S]*?)<\/select>/);
        if (!sel) continue;
        for (const [, v] of sel[1].matchAll(/<option value="([^"]+)"/g)) {
            assert.ok(enumVals.includes(v), `${pagina}: tipo "${v}" não existe no enum (bug do migration 002)`);
        }
    }
});

test('valores do <select> de status de presença (editar relatório) existem no enum', () => {
    const enumVals = valoresDoEnum('status_presenca');
    const html = h.read('coordenacao.html');
    const opcoes = [...html.matchAll(/<option value="([^"]+)">(?:Agendado|Realizado|Falta sem Aviso|Desmarcado com Aviso|Cancelado pelo Terapeuta)</g)].map((m) => m[1]);
    assert.ok(opcoes.length >= 5);
    for (const v of opcoes) assert.ok(enumVals.includes(v), v);
});

test('perfil_role do banco == perfis tratados no role-guard', () => {
    const doBanco = valoresDoEnum('perfil_role').sort();
    const guard = h.read('js/role-guard.js');
    const nosGuard = [...guard.matchAll(/^\s{8}(Terapeuta|Supervisor|Coordenador|Admin):/gm)].map((m) => m[1]).sort();
    assert.deepEqual(nosGuard, doBanco);
});

test('seeds: o realista é destrutivo e avisa isso no cabeçalho', () => {
    const sql = h.read('db/seed/002_seed_realista.sql');
    assert.match(sql, /TRUNCATE/);
    assert.match(sql.split('\n').slice(0, 12).join('\n'), /reset completo/i);
});

test('seeds: nenhum seed contém senha em texto puro nem hash real', () => {
    for (const f of h.list('db/seed', (x) => x.endsWith('.sql'))) {
        const sql = h.read(`db/seed/${f}`);
        assert.doesNotMatch(sql, /senha\s*=\s*'[^']{4,}'/i);
    }
});
