-- 002_seed_realista.sql
-- GERADO por scratchpad/gerar_seed_realista.js -- reset completo da base
-- (TRUNCATE) + recriação de especialidades/planos/usuarios/equipes/
-- pacientes/recorrencias/atendimentos, pedido por Roseane em 2026-09-17.
-- Foco em saúde voltada a pessoas autistas/neurodivergentes e reabilitação:
-- Fonoaudiologia, Terapia Ocupacional, Psicologia, Psicomotricidade,
-- Fisioterapia, Psicopedagogia, Neuropsicologia, Musicoterapia -- uma
-- equipe por especialidade, cada uma com seu supervisor.
--
-- TRUNCATE ... CASCADE também limpa modelos_evolucao (FK em usuarios) e
-- qualquer outra tabela dependente, mesmo sem listar explicitamente.
-- RESTART IDENTITY zera as sequences (SERIAL volta a começar do 1).
--
-- Escopo: recorrências rodam Segunda-Sexta a partir de hoje, sem data
-- fim. Atendimentos concretos gerados só pra frente (hoje + próximos 4
-- dias úteis), todos "Agendado" -- não inventa histórico realizado.
--
-- Rodar com: psql -U prontu_user -d prontu_db -f 002_seed_realista.sql

TRUNCATE especialidades, planos, usuarios, equipes, pacientes,
    paciente_sugestoes_atendimento, recorrencias, recorrencia_dias,
    atendimentos, relatorios, modelos_evolucao
    RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------
-- Especialidades
-- -----------------------------------------------------------------------
INSERT INTO especialidades (nome) VALUES
    ('Fonoaudiologia'),
    ('Terapia Ocupacional'),
    ('Psicologia'),
    ('Psicomotricidade'),
    ('Fisioterapia'),
    ('Psicopedagogia'),
    ('Neuropsicologia'),
    ('Musicoterapia');

-- -----------------------------------------------------------------------
-- Planos
-- -----------------------------------------------------------------------
INSERT INTO planos (nome) VALUES
    ('Bradesco Saúde'),
    ('SulAmérica'),
    ('Unimed'),
    ('Amil'),
    ('NotreDame Intermédica'),
    ('Hapvida'),
    ('Porto Seguro Saúde'),
    ('Particular');

-- -----------------------------------------------------------------------
-- Usuários (20) -- senha padrão 'trocar123' pra todos,
-- hash bcrypt via pgcrypto (crypt/gen_salt), nunca texto puro.
-- equipe_id fica NULL aqui -- preenchido no UPDATE logo abaixo, depois
-- que as equipes existirem (mesma ordem do schema original).
-- -----------------------------------------------------------------------
INSERT INTO usuarios (nome, email, senha_hash, perfil_role, especialidade_id, status) VALUES
    ('Patrícia Almeida', 'patricia.almeida@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Admin', (SELECT id FROM especialidades WHERE nome = 'Psicologia'), 'Ativo'),
    ('Marcos Teixeira', 'marcos.teixeira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Coordenador', (SELECT id FROM especialidades WHERE nome = 'Terapia Ocupacional'), 'Ativo'),
    ('Camila Alves', 'camila.alves@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Fonoaudiologia'), 'Ativo'),
    ('Juliana Prado', 'juliana.prado@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Terapia Ocupacional'), 'Ativo'),
    ('Wagner Santos', 'wagner.santos@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Psicologia'), 'Ativo'),
    ('Beatriz Nogueira', 'beatriz.nogueira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Psicomotricidade'), 'Ativo'),
    ('Rodrigo Farias', 'rodrigo.farias@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Fisioterapia'), 'Ativo'),
    ('Larissa Menezes', 'larissa.menezes@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Psicopedagogia'), 'Ativo'),
    ('Eduardo Ramos', 'eduardo.ramos@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Neuropsicologia'), 'Ativo'),
    ('Simone Cardoso', 'simone.cardoso@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Supervisor', (SELECT id FROM especialidades WHERE nome = 'Musicoterapia'), 'Ativo'),
    ('Fernanda Duarte', 'fernanda.duarte@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Fonoaudiologia'), 'Ativo'),
    ('Rafael Nogueira', 'rafael.nogueira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Fonoaudiologia'), 'Ativo'),
    ('Bruno Castro', 'bruno.castro@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Terapia Ocupacional'), 'Ativo'),
    ('Ana Beatriz Lima', 'ana.lima@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Terapia Ocupacional'), 'Ativo'),
    ('Lucas Pereira', 'lucas.pereira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Psicologia'), 'Ativo'),
    ('Tatiane Rocha', 'tatiane.rocha@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Psicomotricidade'), 'Ativo'),
    ('Diego Barbosa', 'diego.barbosa@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Fisioterapia'), 'Ativo'),
    ('Priscila Gomes', 'priscila.gomes@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Psicopedagogia'), 'Ativo'),
    ('Henrique Vieira', 'henrique.vieira@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Neuropsicologia'), 'Ativo'),
    ('Gabriela Souza', 'gabriela.souza@exemplo.com.br', crypt('trocar123', gen_salt('bf')), 'Terapeuta', (SELECT id FROM especialidades WHERE nome = 'Musicoterapia'), 'Ativo');

-- -----------------------------------------------------------------------
-- Equipes -- uma por especialidade, cada uma com seu supervisor.
-- -----------------------------------------------------------------------
INSERT INTO equipes (nome_equipe, supervisor_id) VALUES
    ('Equipe Fonoaudiologia', (SELECT id FROM usuarios WHERE email = 'camila.alves@exemplo.com.br')),
    ('Equipe Terapia Ocupacional', (SELECT id FROM usuarios WHERE email = 'juliana.prado@exemplo.com.br')),
    ('Equipe Psicologia', (SELECT id FROM usuarios WHERE email = 'wagner.santos@exemplo.com.br')),
    ('Equipe Psicomotricidade', (SELECT id FROM usuarios WHERE email = 'beatriz.nogueira@exemplo.com.br')),
    ('Equipe Fisioterapia', (SELECT id FROM usuarios WHERE email = 'rodrigo.farias@exemplo.com.br')),
    ('Equipe Psicopedagogia', (SELECT id FROM usuarios WHERE email = 'larissa.menezes@exemplo.com.br')),
    ('Equipe Neuropsicologia', (SELECT id FROM usuarios WHERE email = 'eduardo.ramos@exemplo.com.br')),
    ('Equipe Musicoterapia', (SELECT id FROM usuarios WHERE email = 'simone.cardoso@exemplo.com.br'));

-- Liga cada usuário (supervisor + terapeutas) à sua equipe -- Admin e
-- Coordenador ficam sem equipe (equipe_id NULL), mesmo padrão do seed
-- original.
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Fonoaudiologia') WHERE email = 'camila.alves@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Terapia Ocupacional') WHERE email = 'juliana.prado@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicologia') WHERE email = 'wagner.santos@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicomotricidade') WHERE email = 'beatriz.nogueira@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Fisioterapia') WHERE email = 'rodrigo.farias@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicopedagogia') WHERE email = 'larissa.menezes@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Neuropsicologia') WHERE email = 'eduardo.ramos@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Musicoterapia') WHERE email = 'simone.cardoso@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Fonoaudiologia') WHERE email = 'fernanda.duarte@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Fonoaudiologia') WHERE email = 'rafael.nogueira@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Terapia Ocupacional') WHERE email = 'bruno.castro@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Terapia Ocupacional') WHERE email = 'ana.lima@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicologia') WHERE email = 'lucas.pereira@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicomotricidade') WHERE email = 'tatiane.rocha@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Fisioterapia') WHERE email = 'diego.barbosa@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Psicopedagogia') WHERE email = 'priscila.gomes@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Neuropsicologia') WHERE email = 'henrique.vieira@exemplo.com.br';
UPDATE usuarios SET equipe_id = (SELECT id FROM equipes WHERE nome_equipe = 'Equipe Musicoterapia') WHERE email = 'gabriela.souza@exemplo.com.br';

-- -----------------------------------------------------------------------
-- Pacientes (50) -- distribuídos entre os 8 planos,
-- cada um com um terapeuta responsável (rotação entre os 10 terapeutas).
-- -----------------------------------------------------------------------
INSERT INTO pacientes (nome_completo, data_nascimento, responsavel_nome, telefone_whatsapp, terapeuta_responsavel_id, plano_id, status) VALUES
    ('Arthur Martins', '2023-01-01', 'Adriana Martins', '(63) 99000-1000', (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Helena Ferreira', '2022-02-02', 'Bruno Ferreira', '(63) 99013-1053', (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Bernardo Souza', '2021-03-03', 'Carla Souza', '(63) 99027-1106', (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Alice Pinto', '2020-04-04', 'Diego Pinto', '(63) 99041-1159', (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Davi Rocha', '2019-05-05', 'Elaine Rocha', '(63) 99054-1212', (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Laura Lima', '2018-06-06', 'Fábio Lima', '(63) 99068-1265', (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Gael Andrade', '2017-07-07', 'Gisele Andrade', '(63) 99082-1318', (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Manuela Sousa', '2016-08-08', 'Hugo Sousa', '(63) 99095-1371', (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Théo Almeida', '2015-09-09', 'Ivana Almeida', '(63) 99109-1424', (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Sophia Barros', '2014-10-10', 'João Barros', '(63) 99123-1477', (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Heitor Cardoso', '2013-11-11', 'Kátia Cardoso', '(63) 99137-1530', (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Isabella Dias', '2012-12-12', 'Leandro Dias', '(63) 99150-1583', (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Anthony Esteves', '2011-01-13', 'Márcia Esteves', '(63) 99164-1636', (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Valentina Freitas', '2010-02-14', 'Nelson Freitas', '(63) 99178-1689', (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Pedro Gonçalves', '2023-03-15', 'Olívia Gonçalves', '(63) 99191-1742', (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Giovanna Henriques', '2022-04-16', 'Paulo Henriques', '(63) 99205-1795', (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Miguel Ibrahim', '2021-05-17', 'Renata Ibrahim', '(63) 99219-1848', (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Lorena Junqueira', '2020-06-18', 'Sérgio Junqueira', '(63) 99232-1901', (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Samuel Klein', '2019-07-19', 'Tânia Klein', '(63) 99246-1954', (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Cecília Leal', '2018-08-20', 'Ubirajara Leal', '(63) 99260-2007', (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Benjamin Moreira', '2017-09-21', 'Adriana Moreira', '(63) 99274-2060', (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Yasmin Nascimento', '2016-10-22', 'Bruno Nascimento', '(63) 99287-2113', (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Joaquim Oliveira', '2015-11-23', 'Carla Oliveira', '(63) 99301-2166', (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Melissa Pacheco', '2014-12-24', 'Diego Pacheco', '(63) 99315-2219', (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Nicolas Queiroz', '2013-01-25', 'Elaine Queiroz', '(63) 99328-2272', (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Antonella Ribeiro', '2012-02-26', 'Fábio Ribeiro', '(63) 99342-2325', (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Vicente Salgado', '2011-03-27', 'Gisele Salgado', '(63) 99356-2378', (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Elisa Teixeira', '2010-04-01', 'Hugo Teixeira', '(63) 99369-2431', (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Ravi Uchoa', '2023-05-02', 'Ivana Uchoa', '(63) 99383-2484', (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Maitê Vasconcelos', '2022-06-03', 'João Vasconcelos', '(63) 99397-2537', (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Lucca Xavier', '2021-07-04', 'Kátia Xavier', '(63) 99411-2590', (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Liz Zanetti', '2020-08-05', 'Leandro Zanetti', '(63) 99424-2643', (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Otávio Amorim', '2019-09-06', 'Márcia Amorim', '(63) 99438-2696', (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Clara Batista', '2018-10-07', 'Nelson Batista', '(63) 99452-2749', (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Caleb Correia', '2017-11-08', 'Olívia Correia', '(63) 99465-2802', (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Aurora Duarte', '2016-12-09', 'Paulo Duarte', '(63) 99479-2855', (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Emanuel Esteves', '2015-01-10', 'Renata Esteves', '(63) 99493-2908', (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Marina Farias', '2014-02-11', 'Sérgio Farias', '(63) 99506-2961', (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Gustavo Guedes', '2013-03-12', 'Tânia Guedes', '(63) 99520-3014', (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Bianca Hidalgo', '2012-04-13', 'Ubirajara Hidalgo', '(63) 99534-3067', (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Matheus Inácio', '2011-05-14', 'Adriana Inácio', '(63) 99548-3120', (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Julia Jardim', '2010-06-15', 'Bruno Jardim', '(63) 99561-3173', (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento'),
    ('Enzo Koch', '2023-07-16', 'Carla Koch', '(63) 99575-3226', (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Unimed'), 'Em Acompanhamento'),
    ('Beatriz Lacerda', '2022-08-17', 'Diego Lacerda', '(63) 99589-3279', (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Amil'), 'Em Acompanhamento'),
    ('Rafael Machado', '2021-09-18', 'Elaine Machado', '(63) 99602-3332', (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'NotreDame Intermédica'), 'Em Acompanhamento'),
    ('Luiza Neves', '2020-10-19', 'Fábio Neves', '(63) 99616-3385', (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Hapvida'), 'Em Acompanhamento'),
    ('Felipe Ozório', '2019-11-20', 'Gisele Ozório', '(63) 99630-3438', (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Porto Seguro Saúde'), 'Em Acompanhamento'),
    ('Nicole Pires', '2018-12-21', 'Hugo Pires', '(63) 99643-3491', (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Particular'), 'Em Acompanhamento'),
    ('Daniel Quintana', '2017-01-22', 'Ivana Quintana', '(63) 99657-3544', (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'Bradesco Saúde'), 'Em Acompanhamento'),
    ('Amanda Rezende', '2016-02-23', 'João Rezende', '(63) 99671-3597', (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), (SELECT id FROM planos WHERE nome = 'SulAmérica'), 'Em Acompanhamento');

-- -----------------------------------------------------------------------
-- Recorrências (55) -- 11 profissionais (10 terapeutas +
-- 1 coordenador) x 5 pacientes cada, Segunda a Sexta, 45min por sessão,
-- a partir de 2026-09-17 (hoje), sem data fim.
-- -----------------------------------------------------------------------
INSERT INTO recorrencias (paciente_id, terapeuta_id, horario, duracao_minutos, data_inicio, status) VALUES
    ((SELECT id FROM pacientes WHERE nome_completo = 'Arthur Martins'), (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Helena Ferreira'), (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Bernardo Souza'), (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Alice Pinto'), (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Davi Rocha'), (SELECT id FROM usuarios WHERE email = 'marcos.teixeira@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Laura Lima'), (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Gael Andrade'), (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Manuela Sousa'), (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Théo Almeida'), (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Sophia Barros'), (SELECT id FROM usuarios WHERE email = 'fernanda.duarte@exemplo.com.br'), '13:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Heitor Cardoso'), (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Isabella Dias'), (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Anthony Esteves'), (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Valentina Freitas'), (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), '13:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Pedro Gonçalves'), (SELECT id FROM usuarios WHERE email = 'rafael.nogueira@exemplo.com.br'), '14:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Giovanna Henriques'), (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Miguel Ibrahim'), (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Lorena Junqueira'), (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), '13:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Samuel Klein'), (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), '14:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Cecília Leal'), (SELECT id FROM usuarios WHERE email = 'bruno.castro@exemplo.com.br'), '15:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Benjamin Moreira'), (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Yasmin Nascimento'), (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), '13:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Joaquim Oliveira'), (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), '14:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Melissa Pacheco'), (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), '15:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Nicolas Queiroz'), (SELECT id FROM usuarios WHERE email = 'ana.lima@exemplo.com.br'), '16:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Antonella Ribeiro'), (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), '13:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Vicente Salgado'), (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), '14:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Elisa Teixeira'), (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), '15:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Ravi Uchoa'), (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), '16:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Maitê Vasconcelos'), (SELECT id FROM usuarios WHERE email = 'lucas.pereira@exemplo.com.br'), '17:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Lucca Xavier'), (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), '14:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Liz Zanetti'), (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), '15:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Otávio Amorim'), (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), '16:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Clara Batista'), (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), '17:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Caleb Correia'), (SELECT id FROM usuarios WHERE email = 'tatiane.rocha@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Aurora Duarte'), (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), '15:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Emanuel Esteves'), (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), '16:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Marina Farias'), (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), '17:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Gustavo Guedes'), (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Bianca Hidalgo'), (SELECT id FROM usuarios WHERE email = 'diego.barbosa@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Matheus Inácio'), (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), '16:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Julia Jardim'), (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), '17:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Enzo Koch'), (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Beatriz Lacerda'), (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Rafael Machado'), (SELECT id FROM usuarios WHERE email = 'priscila.gomes@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Luiza Neves'), (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), '17:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Felipe Ozório'), (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Nicole Pires'), (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Daniel Quintana'), (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Amanda Rezende'), (SELECT id FROM usuarios WHERE email = 'henrique.vieira@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Arthur Martins'), (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), '07:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Helena Ferreira'), (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), '08:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Bernardo Souza'), (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), '09:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Alice Pinto'), (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), '10:00', 45, '2026-09-17', 'Ativa'),
    ((SELECT id FROM pacientes WHERE nome_completo = 'Davi Rocha'), (SELECT id FROM usuarios WHERE email = 'gabriela.souza@exemplo.com.br'), '11:00', 45, '2026-09-17', 'Ativa');

-- Dias da semana -- Segunda a Sexta pra TODAS as recorrências criadas
-- acima (identificadas por data_inicio = '2026-09-17', que só essas têm
-- já que a base foi truncada antes deste script).
INSERT INTO recorrencia_dias (recorrencia_id, dia_semana)
SELECT r.id, d.dia
FROM recorrencias r
CROSS JOIN (VALUES ('Segunda'::dia_semana), ('Terça'::dia_semana), ('Quarta'::dia_semana), ('Quinta'::dia_semana), ('Sexta'::dia_semana)) AS d(dia)
WHERE r.data_inicio = '2026-09-17';

-- -----------------------------------------------------------------------
-- Atendimentos concretos gerados a partir das recorrências acima, só pra
-- datas futuras (2026-09-17, 2026-09-18, 2026-09-21, 2026-09-22, 2026-09-23) -- todos "Agendado", sem
-- inventar histórico já realizado.
-- -----------------------------------------------------------------------
INSERT INTO atendimentos (paciente_id, terapeuta_id, recorrencia_id, data_hora, tipo_atendimento, status_presenca)
SELECT r.paciente_id, r.terapeuta_id, r.id,
       (d.dia::date + r.horario) AT TIME ZONE 'America/Sao_Paulo',
       'Sessão Regular', 'Agendado'
FROM recorrencias r
CROSS JOIN (VALUES ('2026-09-17'::date), ('2026-09-18'::date), ('2026-09-21'::date), ('2026-09-22'::date), ('2026-09-23'::date)) AS d(dia)
WHERE r.data_inicio = '2026-09-17';

