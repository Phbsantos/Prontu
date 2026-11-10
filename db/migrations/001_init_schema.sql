-- 001_init_schema.sql
-- Schema inicial do Prontu em Postgres, substituindo o Airtable.
-- Redesenhado do zero (não é migração 1:1) pra corrigir os problemas
-- encontrados na base antiga:
--   - links resolvidos por nome (Paciente_Nome/Terapeuta_Nome etc.) viram
--     FK de verdade aqui, sem depender de lookup/nome pra resolver.
--   - Nivel_Engajamento e Recomendacao_Pos_Sessao ganham coluna própria em
--     Atendimentos (antes só existiam concatenados em texto no Conteudo do
--     Relatorio).
--   - Justificativa_Falta deixa de existir duplicada em dois lugares — só
--     em Atendimentos agora.
--   - Editado_Por (Relatorios) vira FK real pra Usuarios, não texto solto.
--   - Senha vira senha_hash (bcrypt), nunca texto puro.
--   - Status_Presenca ganha um enum canônico único — a base antiga tinha
--     variantes de grafia ("Desmarcado com Aviso" x "Desmarcado c/ Aviso")
--     que o frontend precisava mapear na mão.
--   - Recorrencia vira tabela de verdade (na base antiga não existia
--     tabela nem endpoint — a feature rodava inteira em sessionStorage).
--   - Especialidade vira catálogo próprio (antes texto livre em Usuarios),
--     porque agora também é referenciada pelas sugestões por paciente.
--   - Plano vira tabela própria (antes texto livre em Pacientes.Plano_Saude).
--   - Sugestão de quantidade/especialidade de atendimento é uma feature nova
--     (pedida por Roseane em 2026-09-07): é individual por PACIENTE, não um
--     modelo reaproveitável por Plano — dois pacientes no mesmo convênio
--     podem ter quantidades autorizadas diferentes. Fica salva independente
--     de a agenda do paciente seguir ou não o que foi sugerido.
--
-- Chaves primárias: SERIAL (inteiro autoincremento) — escala da clínica não
-- justifica UUID, e é mais fácil de inspecionar manualmente em dev.
--
-- Rodar com: psql -U prontu_user -d prontu_db -f 001_init_schema.sql

-- -----------------------------------------------------------------------
-- Função utilitária: mantém updated_at sempre atual em qualquer UPDATE.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------
CREATE TYPE perfil_role AS ENUM ('Terapeuta', 'Supervisor', 'Coordenador', 'Admin');

-- Só "Ativo" aparecia nos dados de exemplo da base antiga; "Inativo"
-- adicionado por ser o complemento óbvio de um status liga/desliga.
-- Revisar com a Roseane se existem outros estados (ex: "Afastado").
CREATE TYPE status_ativo AS ENUM ('Ativo', 'Inativo');

CREATE TYPE paciente_status AS ENUM ('Em Acompanhamento', 'Alta', 'Inativo');

-- Um enum canônico só — acaba com as variantes de grafia que existiam na
-- base antiga ("Desmarcado com Aviso" vs "Desmarcado c/ Aviso" etc.).
CREATE TYPE status_presenca AS ENUM (
    'Agendado',
    'Realizado',
    'Falta sem Aviso',
    'Desmarcado com Aviso',
    'Cancelado pelo Terapeuta'
);

-- Valores vistos na base antiga. Pra adicionar um novo tipo depois:
-- ALTER TYPE tipo_atendimento ADD VALUE 'Novo Tipo';
CREATE TYPE tipo_atendimento AS ENUM (
    'Sessão Regular',
    'Avaliação Inicial',
    'Supervisão Presencial Conjunta'
);

CREATE TYPE nivel_engajamento AS ENUM ('excelente', 'adequado', 'parcial', 'resistente');

CREATE TYPE relatorio_tipo AS ENUM ('Evolução', 'Avulso');

CREATE TYPE recorrencia_status AS ENUM ('Ativa', 'Encerrada');

-- Periodicidade de uma sugestão de atendimento do paciente — configurável
-- por sugestão, não fixa (decisão da Roseane, 2026-09-07).
CREATE TYPE periodicidade AS ENUM ('semanal', 'mensal');

-- Sem Domingo — a clínica não atende nesse dia (mesma regra já aplicada
-- na grade de Recorrência do frontend, js/recorrencia.js).
CREATE TYPE dia_semana AS ENUM ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado');

-- -----------------------------------------------------------------------
-- especialidades — catálogo, referenciado por Usuarios e por
-- Paciente_Sugestoes_Atendimento. Existia só como texto livre antes.
-- -----------------------------------------------------------------------
CREATE TABLE especialidades (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_especialidades_updated_at
    BEFORE UPDATE ON especialidades
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- planos — planos de saúde (antes só texto livre em Pacientes.Plano_Saude).
-- -----------------------------------------------------------------------
CREATE TABLE planos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_planos_updated_at
    BEFORE UPDATE ON planos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- usuarios — criada antes de Equipes por causa da referência cruzada
-- (Equipes.supervisor_id → Usuarios; Usuarios.equipe_id → Equipes). A
-- coluna equipe_id é adicionada só depois que Equipes existir (ver mais
-- abaixo).
-- -----------------------------------------------------------------------
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    -- Nunca texto puro — a base antiga guardava senha em texto legível
    -- (ex: seed/usuarios.csv tinha "trocar123" solto). Aqui é sempre hash
    -- (bcrypt) gerado pela aplicação antes do INSERT.
    senha_hash TEXT NOT NULL,
    perfil_role perfil_role NOT NULL,
    especialidade_id INTEGER REFERENCES especialidades(id),
    numero_conselho TEXT,
    status status_ativo NOT NULL DEFAULT 'Ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_perfil_role ON usuarios(perfil_role);

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- equipes
-- -----------------------------------------------------------------------
CREATE TABLE equipes (
    id SERIAL PRIMARY KEY,
    nome_equipe TEXT NOT NULL UNIQUE,
    supervisor_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_equipes_updated_at
    BEFORE UPDATE ON equipes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Agora que Equipes existe: liga cada usuário à sua equipe. "Membros" da
-- equipe (que na base antiga era um rollup calculado no Airtable) passa a
-- ser só uma consulta: SELECT * FROM usuarios WHERE equipe_id = :id.
ALTER TABLE usuarios ADD COLUMN equipe_id INTEGER REFERENCES equipes(id);
CREATE INDEX idx_usuarios_equipe ON usuarios(equipe_id);

-- -----------------------------------------------------------------------
-- pacientes
-- -----------------------------------------------------------------------
CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_nome TEXT NOT NULL,
    telefone_whatsapp TEXT NOT NULL,
    terapeuta_responsavel_id INTEGER REFERENCES usuarios(id),
    plano_id INTEGER REFERENCES planos(id),
    status paciente_status NOT NULL DEFAULT 'Em Acompanhamento',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pacientes_terapeuta ON pacientes(terapeuta_responsavel_id);
CREATE INDEX idx_pacientes_plano ON pacientes(plano_id);

CREATE TRIGGER trg_pacientes_updated_at
    BEFORE UPDATE ON pacientes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- paciente_sugestoes_atendimento — feature nova (Roseane, 2026-09-07): cada
-- linha é "este PACIENTE tem sugestão/autorização de N sessões de tal
-- especialidade, com tal periodicidade" (ex: paciente X → 2x
-- Fonoaudiologia/semana, 3x Psicologia/semana, 1x Terapia Ocupacional/
-- semana, 1x Psicomotricidade/semana). É individual por paciente, não um
-- modelo por Plano — dois pacientes no mesmo convênio podem ter
-- quantidades diferentes. Existe só pra referência/registro de quanto foi
-- sugerido/autorizado; não trava nada contra Recorrencias/Atendimentos —
-- fica salva mesmo que a agenda de fato montada não siga à risca (ex: não
-- precisa colocar tudo no mesmo dia).
-- -----------------------------------------------------------------------
CREATE TABLE paciente_sugestoes_atendimento (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    especialidade_id INTEGER NOT NULL REFERENCES especialidades(id),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    periodicidade periodicidade NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Um paciente não deveria ter duas linhas de sugestão pra mesma
    -- especialidade — se mudar a quantidade, é UPDATE na linha existente.
    UNIQUE (paciente_id, especialidade_id)
);

CREATE INDEX idx_paciente_sugestoes_paciente ON paciente_sugestoes_atendimento(paciente_id);

CREATE TRIGGER trg_paciente_sugestoes_updated_at
    BEFORE UPDATE ON paciente_sugestoes_atendimento
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- recorrencias — antes era só sessionStorage no frontend (sem tabela nem
-- endpoint no backend). Agora é uma tabela de verdade.
-- -----------------------------------------------------------------------
CREATE TABLE recorrencias (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    terapeuta_id INTEGER NOT NULL REFERENCES usuarios(id),
    horario TIME NOT NULL,
    -- Duração mínima e padrão de 30 min, mesma regra já usada no frontend
    -- (js/recorrencia.js: RECORRENCIA_DURACAO_MINIMA_MINUTOS).
    duracao_minutos INTEGER NOT NULL DEFAULT 30 CHECK (duracao_minutos >= 30),
    data_inicio DATE NOT NULL,
    data_fim DATE,
    status recorrencia_status NOT NULL DEFAULT 'Ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX idx_recorrencias_paciente ON recorrencias(paciente_id);
CREATE INDEX idx_recorrencias_terapeuta ON recorrencias(terapeuta_id);

CREATE TRIGGER trg_recorrencias_updated_at
    BEFORE UPDATE ON recorrencias
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Dias da semana de uma recorrência — tabela de junção em vez de array,
-- pra poder indexar/consultar ("quais recorrências caem na Terça?") sem
-- depender de operador de array.
CREATE TABLE recorrencia_dias (
    recorrencia_id INTEGER NOT NULL REFERENCES recorrencias(id) ON DELETE CASCADE,
    dia_semana dia_semana NOT NULL,
    PRIMARY KEY (recorrencia_id, dia_semana)
);

-- -----------------------------------------------------------------------
-- atendimentos
-- -----------------------------------------------------------------------
CREATE TABLE atendimentos (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    terapeuta_id INTEGER NOT NULL REFERENCES usuarios(id),
    supervisor_id INTEGER REFERENCES usuarios(id),
    recorrencia_id INTEGER REFERENCES recorrencias(id),
    data_hora TIMESTAMPTZ NOT NULL,
    tipo_atendimento tipo_atendimento NOT NULL DEFAULT 'Sessão Regular',
    status_presenca status_presenca NOT NULL DEFAULT 'Agendado',
    evolucao_prontuario TEXT,
    justificativa_falta TEXT,
    -- Antes só existiam concatenados em texto dentro de
    -- Relatorios.Conteudo — agora são coluna própria, consultável de
    -- verdade (ex: filtrar/relatar por nível de engajamento).
    nivel_engajamento nivel_engajamento,
    recomendacao_pos_sessao TEXT,
    sala TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_paciente ON atendimentos(paciente_id);
CREATE INDEX idx_atendimentos_terapeuta_data ON atendimentos(terapeuta_id, data_hora);
CREATE INDEX idx_atendimentos_data_hora ON atendimentos(data_hora);
CREATE INDEX idx_atendimentos_status_presenca ON atendimentos(status_presenca);

CREATE TRIGGER trg_atendimentos_updated_at
    BEFORE UPDATE ON atendimentos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------
-- relatorios
-- -----------------------------------------------------------------------
CREATE TABLE relatorios (
    id SERIAL PRIMARY KEY,
    tipo relatorio_tipo NOT NULL,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    -- Só preenchido quando tipo = 'Evolução' (fecha um atendimento
    -- existente); nulo em relatórios avulsos.
    atendimento_id INTEGER REFERENCES atendimentos(id),
    autor_id INTEGER NOT NULL REFERENCES usuarios(id),
    data DATE NOT NULL,
    conteudo TEXT NOT NULL,
    -- Antes era texto solto (nome digitado) — agora FK real pra Usuarios.
    editado_por_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatorios_paciente ON relatorios(paciente_id);
CREATE INDEX idx_relatorios_atendimento ON relatorios(atendimento_id);

CREATE TRIGGER trg_relatorios_updated_at
    BEFORE UPDATE ON relatorios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
