const CONFIG = {
    // 2026-09-17: escondidas temporariamente pra apresentação ao cliente —
    // features completas no backend, só desligadas na UI. Voltar pra true
    // reativa sem precisar tocar em nada além daqui.
    FEATURES: {
        cienciaRelatorio: false,
        sugestoesAtendimento: false,
    },
    // 2026-09-16: backend saiu da máquina local de desenvolvimento e foi
    // pra uma VPS (Ubuntu 24.04) — mesma arquitetura (n8n self-hosted em
    // Docker + Postgres, ver db/n8n-workflows/ e db/migrations/). Rodou
    // primeiro só em HTTP puro por IP; no mesmo dia ganhou HTTPS de
    // verdade via Caddy (reverse proxy com TLS automático) na frente do
    // n8n, usando o hostname público sslip.io (resolve pro IP da VPS sem
    // precisar de domínio próprio) — certificado real do Let's Encrypt,
    // emitido e renovado automaticamente pelo Caddy. n8n não escuta mais
    // direto na porta pública (só via Caddy/443, porta 5678 fechada no
    // firewall e vinculada só a 127.0.0.1 no docker-compose). Nenhuma
    // versão anterior (n8n cloud phbsantos*, localhost:5678 de dev, ou o
    // http://IP:5678 sem TLS) deve mais ser usada.
    API_BASE: 'https://38-72-132-152.sslip.io/webhook',
    ENDPOINTS: {
        // --- Listagem (GET) ---
        LISTAR_USUARIOS: '/listar/usuarios',
        LISTAR_PACIENTES: '/listar/pacientes',
        // 2026-09-08: agora aceita filtros de verdade na query string
        // (terapeuta_id, paciente_id, data, data_inicio, data_fim,
        // status_presenca) — o workflow novo resolve isso no Postgres.
        // Nenhuma tela ainda manda esses parâmetros (todas continuam
        // buscando tudo e filtrando no cliente, padrão estabelecido);
        // migrar pra filtro de servidor é trabalho futuro, não bloqueia nada.
        LISTAR_ATENDIMENTOS: '/listar/atendimentos',
        // 2026-09-17: ganhou os mesmos filtros de servidor que
        // /listar/atendimentos já tinha (paciente_id, autor_id, tipo,
        // data_inicio, data_fim) — mesma ressalva: nenhuma tela ainda manda
        // esses parâmetros, continua buscando tudo e filtrando no cliente.
        LISTAR_RELATORIOS: '/listar/relatorios',
        LISTAR_EQUIPES: '/listar/equipes',
        // 2026-09-17: endpoints novos — Recorrência agora é tabela de
        // verdade (era session-only, ver prontu-feature-state), e Planos/
        // Especialidades ganharam listagem própria (antes só existiam via
        // seed, sem nenhum jeito de consultar/cadastrar pela API).
        LISTAR_RECORRENCIAS: '/listar/recorrencias',
        LISTAR_PLANOS: '/listar/planos',
        LISTAR_ESPECIALIDADES: '/listar/especialidades',
        // 2026-09-17: sugestão de atendimento por paciente (card do
        // paciente em cadastros.html, só Coordenador/Admin) — filtra por
        // ?paciente_id=.
        LISTAR_SUGESTOES_ATENDIMENTO: '/listar/sugestoes-atendimento',
        // 2026-09-17: modelos de evolução pessoais (index.html, botões
        // "Modelos:" acima do relato) -- filtra por ?usuario_id=, sempre o
        // usuário logado (ver js/app.js).
        LISTAR_MODELOS_EVOLUCAO: '/listar/modelos-evolucao',

        // --- Criação (POST) ---
        // 2026-09-08: equipe_nome agora resolve de verdade pro equipe_id do
        // usuário criado (era um link vazio no Airtable, corrigido no
        // workflow novo via subquery SQL).
        USUARIO_REGISTRAR: '/registrar/usuario',
        // 2026-09-08: terapeuta_responsavel_nome idem — resolve de verdade
        // agora (mesma correção, mesmo motivo).
        PACIENTE_REGISTRAR: '/registrar/paciente',
        // 2026-09-08: dois bugs confirmados corrigidos no workflow novo —
        // (1) status_presenca de Falta/Desmarcado/Cancelado não vira mais
        // "Realizado" à força; (2) nivel_engajamento e
        // recomendacao_pos_sessao agora são campos próprios no payload,
        // gravados em colunas reais — não precisam mais ser concatenados
        // dentro de conteudo (ver ApiService.buildRegisterPayload).
        RELATORIO_REGISTRAR: '/registrar/relatorio',
        // 2026-09-17: edição de verdade de um relatório já existente (era só
        // sessionStorage na Coordenação até aqui, nunca persistia — ver
        // js/coordenacao-api.js).
        RELATORIO_EDITAR: '/editar/relatorio',
        // 2026-09-17: resposta do autor original a uma alteração feita por
        // outra pessoa (ciência do terapeuta) — {id, decisao:
        // 'concordo'|'nao_concordo'}. Ver js/app.js pro modal obrigatório.
        RELATORIO_CONFIRMAR_CIENCIA: '/relatorio/ciencia',
        ATENDIMENTO_CRIAR: '/criar/atendimento',
        // 2026-09-17: novo — grava paciente_id/terapeuta_id (por nome,
        // resolvido por subquery) + horario + dias_semana (array) numa
        // query só, que insere em recorrencias e recorrencia_dias juntos.
        RECORRENCIA_REGISTRAR: '/registrar/recorrencia',
        // 2026-09-17: novos, upsert idempotente por nome (cadastrar de novo
        // o mesmo nome só devolve o registro existente, sem erro).
        PLANO_REGISTRAR: '/registrar/plano',
        ESPECIALIDADE_REGISTRAR: '/registrar/especialidade',
        // 2026-09-17: upsert por (paciente_id, especialidade_id) — salvar
        // de novo a mesma especialidade pro mesmo paciente atualiza a
        // quantidade/periodicidade em vez de duplicar.
        SUGESTAO_ATENDIMENTO_REGISTRAR: '/registrar/sugestao-atendimento',
        // DELETE, não POST — remove uma sugestão por id (?id=).
        SUGESTAO_ATENDIMENTO_REMOVER: '/remover/sugestao-atendimento',
        // 2026-09-17: card "Resetar Senha" em cadastros.html (Usuário), só
        // Coordenador/Admin — nova senha nunca fica em texto puro (hash
        // via pgcrypto no próprio workflow).
        USUARIO_RESETAR_SENHA: '/resetar/senha-usuario',
        // 2026-09-17: upsert por (usuario_id, nome) -- salvar de novo o
        // mesmo nome atualiza o conteúdo em vez de duplicar.
        MODELO_EVOLUCAO_REGISTRAR: '/registrar/modelo-evolucao',
        // DELETE, não POST -- remove um modelo por id (?id=).
        MODELO_EVOLUCAO_REMOVER: '/remover/modelo-evolucao',
        // 2026-09-17: edição de usuário existente (tela usuarios.html,
        // Coordenador/Admin) -- nome, perfil, especialidade, equipe e
        // status. Diferente do registrar/usuario (que resolve
        // especialidade/equipe por NOME de texto), aqui o frontend já
        // manda os ids reais (selects populados por /listar/especialidades
        // e /listar/equipes). Não mexe em email nem senha.
        USUARIO_EDITAR: '/editar/usuario',
        // 2026-09-17: corrige o Status_Presenca de um atendimento direto,
        // sem depender de relatório vinculado -- usado pra reabrir (voltar
        // pra "Agendado") um atendimento "Realizado sem evolução" na aba
        // Indicadores.
        ATENDIMENTO_STATUS_ATUALIZAR: '/atualizar/status-atendimento',

        // 2026-09-08: resposta de sucesso agora vem completa em
        // {sucesso, mensagem, usuario:{id, nome, email, perfilRole,
        // especialidade, equipeId, status}} numa chamada só — não precisa
        // mais da segunda busca em /listar/usuarios que o AuthApi.login()
        // fazia pra completar perfilRole/email/status.
        USUARIO_LOGIN: '/usuario/login',
        // Agenda filtrada por equipe do supervisor: sem endpoint dedicado —
        // reconstruído no cliente (ver SupervisorApi.fetchEquipeMembroIds/
        // fetchEquipeDia) a partir de /listar/equipes + /listar/atendimentos,
        // filtrando por ID de terapeuta, não por nome. Chave mantida só de
        // referência, não é mais usada no código.
        SUPERVISOR_EQUIPE_DIA: '/supervisor/equipe-dia',
        // Métricas de coordenação: seguem sem endpoint (já era TODO antes).
        COORDENACAO_METRICAS: '/coordenacao/metricas',
    },
};
