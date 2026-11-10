-- 004_modelos_evolucao.sql
-- Modelos de evolução PESSOAIS: cada usuário (Terapeuta) cadastra os seus
-- próprios atalhos de texto pro relato de evolução (index.html, botões
-- "Modelos:" acima do textarea) -- antes disso só existiam 3 modelos fixos
-- hardcoded em js/app.js (insertTemplate), iguais pra todo mundo e sem
-- nenhuma ligação com o usuário logado. Esses 3 continuam existindo como
-- padrão da clínica; isto aqui é a lista adicional, pessoal, de cada um.
--
-- Rodar com: psql -U prontu_user -d prontu_db -f 004_modelos_evolucao.sql
CREATE TABLE modelos_evolucao (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Reaproveitar o mesmo nome pro mesmo usuário atualiza o conteúdo
    -- existente (ver 24_registrar_modelo_evolucao.json) em vez de criar
    -- duplicata -- mesmo padrão de upsert já usado em
    -- paciente_sugestoes_atendimento.
    UNIQUE (usuario_id, nome)
);

CREATE INDEX idx_modelos_evolucao_usuario ON modelos_evolucao(usuario_id);

CREATE TRIGGER trg_modelos_evolucao_updated_at
    BEFORE UPDATE ON modelos_evolucao
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
