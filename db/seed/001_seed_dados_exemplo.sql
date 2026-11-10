-- 001_seed_dados_exemplo.sql
-- Converte os dados de exemplo que estavam em seed/*.csv (formato antigo,
-- pensado pra importação no Airtable) pro schema novo em db/migrations/
-- 001_init_schema.sql. Não é 1:1: os campos que eram texto/nome resolvido
-- na hora (Paciente_Nome, Terapeuta_Nome, Equipe, Plano_Saude, Recorrencia
-- por código tipo "REC001") agora são FK de verdade, resolvidas aqui via
-- subquery por um valor único que já existe nos dados (email de usuário,
-- nome de paciente/plano/especialidade, ou par paciente+terapeuta pra achar
-- a recorrência/atendimento certo — já que a tabela nova não guarda mais
-- os códigos ATD00x/REC00x do Airtable).
--
-- Assume nomes de paciente distintos entre si nestes dados de exemplo (não
-- há UNIQUE em pacientes.nome_completo no schema) — numa tela real, a
-- própria UI já vai enviar o ID escolhido, não o nome, então isso não é
-- um problema de produção, só uma simplificação segura pra este seed.
--
-- Senha de todos os usuários de exemplo era "trocar123" em texto puro no
-- CSV antigo — aqui vira hash de verdade via pgcrypto (bcrypt), nunca
-- texto puro (ver decisão em db/migrations/001_init_schema.sql).
--
-- Rodar depois de 001_init_schema.sql, com:
-- psql -U prontu_user -d prontu_db -f 001_seed_dados_exemplo.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------
-- especialidades — catálogo derivado dos valores distintos que apareciam
-- em Usuarios.Especialidade no CSV antigo.
-- -----------------------------------------------------------------------
INSERT INTO especialidades (nome) VALUES
    ('Fonoaudiologia'),
    ('Psicologia'),
    ('Terapia Ocupacional'),
    ('Psicomotricidade');

-- -----------------------------------------------------------------------
-- planos — catálogo derivado dos valores distintos que apareciam em
-- Pacientes.Plano_Saude no CSV antigo.
-- -----------------------------------------------------------------------
INSERT INTO planos (nome) VALUES
    ('Unimed'),
    ('Particular'),
    ('Bradesco Saúde'),
    ('SulAmérica'),
    ('Amil');

-- -----------------------------------------------------------------------
-- usuarios — sem equipe_id ainda (Equipes só é criada depois, ver a
-- ressalva de referência cruzada em 001_init_schema.sql).
-- -----------------------------------------------------------------------
INSERT INTO usuarios (nome, email, senha_hash, perfil_role, especialidade_id, numero_conselho, status) VALUES
    ('Fernanda Duarte', 'fernanda.duarte@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta',
        (SELECT id FROM especialidades WHERE nome = 'Fonoaudiologia'), 'CRFa2 12345', 'Ativo'),
    ('Rafael Nogueira', 'rafael.nogueira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta',
        (SELECT id FROM especialidades WHERE nome = 'Psicologia'), 'CRP 06/98765', 'Ativo'),
    ('Camila Alves', 'camila.alves@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor',
        (SELECT id FROM especialidades WHERE nome = 'Terapia Ocupacional'), 'CREFITO-3 12345-TO', 'Ativo'),
    ('Bruno Castro', 'bruno.castro@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta',
        (SELECT id FROM especialidades WHERE nome = 'Psicomotricidade'), 'CREF 054321-G/SP', 'Ativo'),
    ('Juliana Prado', 'juliana.prado@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor',
        (SELECT id FROM especialidades WHERE nome = 'Fonoaudiologia'), 'CRFa2 54321', 'Ativo'),
    ('Marcos Teixeira', 'marcos.teixeira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Coordenador',
        NULL, NULL, 'Ativo'),
    ('Ana Beatriz Lima', 'ana.lima@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Admin',
        NULL, NULL, 'Ativo');

-- -----------------------------------------------------------------------
-- equipes — supervisor_id resolvido por e-mail (único de verdade, ao
-- contrário de nome).
-- -----------------------------------------------------------------------
INSERT INTO equipes (nome_equipe, supervisor_id) VALUES
    ('Equipe Manhã', (SELECT id FROM usuarios WHERE email = 'camila.alves@exemplo.com.br')),
    ('Equipe Tarde', (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br'));

-- Agora que Equipes existe: liga cada usuário à sua equipe (coluna
-- Equipe do CSV antigo de Usuarios).
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Manhã')
WHERE email IN ('fernanda.duarte@exemplo.com.br', 'rafael.nogueira@exemplo.com.br', 'camila.alves@exemplo.com.br');

UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Tarde')
WHERE email IN ('bruno.castro@exemplo.com.br', 'juliana.prado@exemplo.com.br');
-- Marcos Teixeira (Coordenador) e Ana Beatriz Lima (Admin) ficam sem
-- equipe, igual no CSV antigo.

-- -----------------------------------------------------------------------
-- pacientes
-- -----------------------------------------------------------------------
INSERT INTO pacientes (nome_completo, data_nascimento, responsavel_nome, telefone_whatsapp, terapeuta_responsavel_id, plano_id, status) VALUES
    ('Enzo Martins', '2018-04-12', 'Patricia Martins', '+55 11 98888-1234',
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Alice Ferreira', '2016-09-03', 'Carlos Ferreira', '+55 11 97777-2345',
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Davi Souza', '2019-01-22', 'Renata Souza', '+55 11 96666-3456',
        (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'),
        (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Laura Pinto', '2015-11-30', 'Marcelo Pinto', '+55 11 95555-4567',
        (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br'),
        (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Miguel Rocha', '2017-06-18', 'Fernanda Rocha', '+55 11 94444-5678',
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        (SELECT id FROM planos WHERE nome = 'Amil'), 'Alta'),
    -- Sofia Lima: sem terapeuta responsável, igual no CSV antigo (era o
    -- caso de exemplo do link que o n8n não resolvia — aqui é só um NULL
    -- legítimo, resolvível a qualquer momento via UPDATE).
    ('Sofia Lima', '2020-02-09', 'Bianca Lima', '+55 11 93333-6789',
        NULL,
        (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento');

-- Nenhuma linha de paciente_sugestoes_atendimento no seed — a feature é
-- nova (2026-09-07), não existia na base antiga, sem dado histórico pra
-- converter.

-- -----------------------------------------------------------------------
-- recorrencias
-- -----------------------------------------------------------------------
INSERT INTO recorrencias (paciente_id, terapeuta_id, horario, data_inicio, data_fim, status) VALUES
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        '14:00', '2026-02-03', NULL, 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Alice Ferreira'),
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        '09:00', '2026-01-13', NULL, 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Davi Souza'),
        (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'),
        '10:30', '2026-03-10', NULL, 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Laura Pinto'),
        (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br'),
        '16:00', '2025-11-04', '2026-12-19', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Miguel Rocha'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        '11:00', '2025-06-02', '2026-05-15', 'Encerrada');

-- -----------------------------------------------------------------------
-- recorrencia_dias — cada recorrência é achada de novo aqui pelo par
-- paciente+terapeuta (único neste seed), já que não existe mais um
-- código tipo "REC001" pra referenciar direto.
-- -----------------------------------------------------------------------
INSERT INTO recorrencia_dias (recorrencia_id, dia_semana) VALUES
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Enzo Martins'), 'Terça'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Enzo Martins'), 'Quinta'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Alice Ferreira'), 'Segunda'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Alice Ferreira'), 'Quarta'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Alice Ferreira'), 'Sexta'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Davi Souza'), 'Terça'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Davi Souza'), 'Quinta'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Laura Pinto'), 'Segunda'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Laura Pinto'), 'Quarta'),
    ((SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Miguel Rocha'), 'Sexta');

-- -----------------------------------------------------------------------
-- atendimentos — recorrencia_id fica NULL explícito nas duas linhas que já
-- eram avulsas no CSV antigo (ATD008 avaliação inicial, ATD010 supervisão
-- conjunta), em vez de tentar resolver por subquery.
-- -----------------------------------------------------------------------
INSERT INTO atendimentos (paciente_id, terapeuta_id, supervisor_id, recorrencia_id, data_hora, tipo_atendimento, status_presenca, evolucao_prontuario, justificativa_falta, nivel_engajamento, recomendacao_pos_sessao, sala) VALUES
    -- ATD001
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Enzo Martins'),
        '2026-08-18T14:00:00-03:00', 'Sessão Regular', 'Realizado',
        'Enzo demonstrou boa adesão às atividades de coordenação motora. Manteve atenção por 30 minutos.',
        NULL, 'adequado', 'Reforçar exercícios de equilíbrio em casa 2x por semana.', 'Sala 2'),
    -- ATD002
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Enzo Martins'),
        '2026-08-20T14:00:00-03:00', 'Sessão Regular', 'Realizado',
        'Evolução consistente; iniciou novo protocolo de estimulação sensorial.',
        NULL, 'excelente', 'Manter frequência atual.', 'Sala 2'),
    -- ATD003
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Enzo Martins'),
        '2026-08-25T14:00:00-03:00', 'Sessão Regular', 'Agendado',
        NULL, NULL, NULL, NULL, 'Sala 2'),
    -- ATD004
    ((SELECT id FROM pacientes WHERE nome_completo = 'Alice Ferreira'),
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Alice Ferreira'),
        '2026-08-19T09:00:00-03:00', 'Sessão Regular', 'Falta sem Aviso',
        NULL, 'Família não avisou; contato realizado por telefone após a sessão.', NULL, NULL, 'Sala 1'),
    -- ATD005
    ((SELECT id FROM pacientes WHERE nome_completo = 'Alice Ferreira'),
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Alice Ferreira'),
        '2026-08-21T09:00:00-03:00', 'Sessão Regular', 'Realizado',
        'Trabalhou nomeação de objetos; avanço leve em relação à semana anterior.',
        NULL, 'parcial', 'Repetir atividade de nomeação com apoio visual.', 'Sala 1'),
    -- ATD006
    ((SELECT id FROM pacientes WHERE nome_completo = 'Davi Souza'),
        (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Davi Souza'),
        '2026-08-20T10:30:00-03:00', 'Sessão Regular', 'Desmarcado com Aviso',
        NULL, 'Responsável avisou por WhatsApp que Davi está com febre.', NULL, NULL, 'Sala 3'),
    -- ATD007
    ((SELECT id FROM pacientes WHERE nome_completo = 'Laura Pinto'),
        (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Laura Pinto'),
        '2026-08-17T16:00:00-03:00', 'Sessão Regular', 'Realizado',
        'Sessão focada em articulação de fonemas /r/ e /l/. Boa colaboração.',
        NULL, 'excelente', 'Avançar para frases completas na próxima sessão.', 'Sala 4'),
    -- ATD008 (sem recorrência no CSV antigo)
    ((SELECT id FROM pacientes WHERE nome_completo = 'Sofia Lima'),
        (SELECT id FROM usuarios WHERE email = 'camila.alves@exemplo.com.br'),
        (SELECT id FROM usuarios WHERE email = 'camila.alves@exemplo.com.br'),
        NULL,
        '2026-08-22T11:00:00-03:00', 'Avaliação Inicial', 'Realizado',
        'Avaliação inicial realizada. Paciente apresenta atraso leve de linguagem.',
        NULL, 'adequado', 'Encaminhar para terapeuta de fonoaudiologia da Equipe Manhã.', 'Sala 1'),
    -- ATD009
    ((SELECT id FROM pacientes WHERE nome_completo = 'Miguel Rocha'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        NULL,
        (SELECT r.id FROM recorrencias r JOIN pacientes p ON p.id = r.paciente_id WHERE p.nome_completo = 'Miguel Rocha'),
        '2026-05-08T11:00:00-03:00', 'Sessão Regular', 'Realizado',
        'Última sessão antes da alta. Paciente atingiu todos os objetivos do plano terapêutico.',
        NULL, 'excelente', 'Alta concedida; reavaliação em 6 meses.', 'Sala 2'),
    -- ATD010 (sem recorrência no CSV antigo — sessão de supervisão avulsa)
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        (SELECT id FROM usuarios WHERE email = 'camila.alves@exemplo.com.br'),
        NULL,
        '2026-08-24T15:30:00-03:00', 'Supervisão Presencial Conjunta', 'Realizado',
        'Sessão conjunta de observação com supervisão de Camila Alves.',
        NULL, 'excelente', NULL, 'Sala 2');

-- -----------------------------------------------------------------------
-- relatorios — atendimento_id resolvido por paciente+data_hora (único
-- neste seed), já que não existe mais um código tipo "ATD001".
-- -----------------------------------------------------------------------
INSERT INTO relatorios (tipo, paciente_id, atendimento_id, autor_id, data, conteudo, editado_por_id) VALUES
    ('Evolução',
        (SELECT id FROM pacientes WHERE nome_completo = 'Enzo Martins'),
        (SELECT a.id FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id
            WHERE p.nome_completo = 'Enzo Martins' AND a.data_hora = '2026-08-18T14:00:00-03:00'),
        (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'),
        '2026-08-18',
        'Enzo demonstrou boa adesão às atividades de coordenação motora. Manteve atenção por 30 minutos.',
        NULL),
    ('Evolução',
        (SELECT id FROM pacientes WHERE nome_completo = 'Alice Ferreira'),
        (SELECT a.id FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id
            WHERE p.nome_completo = 'Alice Ferreira' AND a.data_hora = '2026-08-21T09:00:00-03:00'),
        (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'),
        '2026-08-21',
        'Trabalhou nomeação de objetos; avanço leve em relação à semana anterior.',
        NULL),
    ('Evolução',
        (SELECT id FROM pacientes WHERE nome_completo = 'Laura Pinto'),
        (SELECT a.id FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id
            WHERE p.nome_completo = 'Laura Pinto' AND a.data_hora = '2026-08-17T16:00:00-03:00'),
        (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br'),
        '2026-08-17',
        'Sessão focada em articulação de fonemas /r/ e /l/. Boa colaboração.',
        NULL),
    ('Avulso',
        (SELECT id FROM pacientes WHERE nome_completo = 'Davi Souza'),
        NULL,
        (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'),
        '2026-08-20',
        'Contato com a família após a falta: Davi segue em tratamento de uma virose, retorno previsto para a próxima semana. Orientado a manter hidratação e repouso.',
        NULL),
    ('Avulso',
        (SELECT id FROM pacientes WHERE nome_completo = 'Miguel Rocha'),
        NULL,
        (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'),
        '2026-05-20',
        'Relatório de alta consolidado para encaminhamento à família e à escola, resumindo os 14 meses de acompanhamento.',
        (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'));
