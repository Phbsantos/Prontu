-- 002_expandir_tipo_atendimento.sql
-- Bug encontrado em teste manual (2026-09-17): "Agendar sessão avulsa"
-- (tanto no modal do Coordenador em coordenacao.html quanto na tela do
-- Supervisor) dava erro genérico do n8n ("Error in workflow"). Causa: o
-- <select> de tipo de atendimento nessas duas telas sempre ofereceu 4
-- opções (herdadas do Single Select livre do Airtable antigo) —
-- "Sessão Extra/Reforço", "Avaliação Inicial", "Supervisão Presencial
-- Conjunta", "Acolhimento Familiar" — mas o enum tipo_atendimento criado
-- em 001_init_schema.sql só tinha 3 valores, baseados no que aparecia no
-- seed histórico, sem essas duas. A opção padrão do select ("Sessão
-- Extra/Reforço") era literalmente a primeira a estourar erro de cast.
--
-- Corrige adicionando os 2 valores que faltavam, em vez de restringir a
-- UI: "Sessão Extra/Reforço" e "Acolhimento Familiar" são categorias de
-- atendimento reais já usadas pela clínica, só não apareciam no recorte
-- de dados que gerou o schema inicial.
--
-- ALTER TYPE ... ADD VALUE não pode rodar dentro do mesmo bloco de
-- transação que já usa o valor novo, mas como statement solo via
-- psql -f (autocommit) não tem problema nenhum.
--
-- Rodar com: psql -U prontu_user -d prontu_db -f 002_expandir_tipo_atendimento.sql

ALTER TYPE tipo_atendimento ADD VALUE IF NOT EXISTS 'Sessão Extra/Reforço';
ALTER TYPE tipo_atendimento ADD VALUE IF NOT EXISTS 'Acolhimento Familiar';
