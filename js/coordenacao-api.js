const CoordenacaoApi = {
    // --- Atendimentos realizados + Relatórios, com Plano_Saude cruzado ---
    // Plano_Saude vive em Pacientes, não em Atendimentos nem Relatorios —
    // por isso todo fetch abaixo também busca /listar/pacientes pra montar
    // o cruzamento. Ver decisão registrada no esquema da base ("Base
    // Prontu"): o plano fica no paciente, não no atendimento.
    //
    // 2026-09-08: backend novo — o cruzamento agora é por paciente_id
    // (inteiro real, vindo de FK) em vez de por nome normalizado em
    // minúsculas. Mais exato (dois pacientes não podem colidir por nome
    // parecido) e mais simples (sem lookup Airtable pra desembrulhar).

    async fetchListar(endpointKey) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS[endpointKey]}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar dados (${response.status})`);
        }

        const data = await lerJsonLista(response);
        return Array.isArray(data) ? data : [];
    },

    buildPlanoMap(pacienteRecords) {
        const map = new Map();
        pacienteRecords.forEach((record) => {
            if (record.id != null) map.set(record.id, record.plano_nome || '');
        });
        return map;
    },

    transformRelatorio(record, planoMap, statusPorAtendimentoId) {
        const atendimentoId = record.atendimento_id || null;
        return {
            id: record.id,
            tipo: record.tipo || 'Evolução',
            pacienteNome: record.paciente_nome || 'Paciente não informado',
            autorNome: record.autor_nome || 'Autor não informado',
            data: record.data || '',
            conteudo: record.conteudo || '',
            atendimentoId,
            // Status do atendimento vinculado (só existe pra tipo Evolução) --
            // pré-preenche o seletor de status no modal de editar relatório
            // (2026-09-17, ver openEditRelatorioModal em js/coordenacao.js).
            statusAtendimento: atendimentoId ? statusPorAtendimentoId.get(atendimentoId) || null : null,
            editadoPor: record.editado_por_nome || '',
            planoSaude: planoMap.get(record.paciente_id) || '',
            // 2026-09-17: ciência do autor sobre alterações de terceiros —
            // ver 003_relatorio_ciencia.sql / 05_listar_relatorios.json.
            // contestadoAtivo: a última resposta do autor foi "não
            // concordo" e ninguém editou de novo desde então.
            precisaCiencia: !!record.precisa_ciencia,
            contestadoAtivo: !!record.contestado_ativo,
        };
    },

    // Edição de verdade de um relatório já existente — substitui o antigo
    // rascunho em sessionStorage (nunca persistia, a própria tela avisava
    // isso). editadoPorNome é sempre quem está logado fazendo a edição.
    // statusPresenca é opcional (2026-09-17): permite corrigir junto o
    // Status_Presenca do atendimento vinculado -- só relatório de tipo
    // Evolução tem atendimento_id pra atualizar; o backend ignora
    // silenciosamente se o relatório não tiver um (ver 21_editar_relatorio.json).
    async editarRelatorio({ id, data, conteudo, editadoPorNome, statusPresenca }) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_EDITAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                data,
                conteudo,
                editado_por_nome: editadoPorNome,
                status_presenca: statusPresenca || null,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao salvar edição (${response.status})`);
        }

        return response.json();
    },

    // Reabre um atendimento "Realizado sem evolução" (2026-09-17, aba
    // Indicadores) -- corrige o Status_Presenca direto no atendimento, sem
    // depender de nenhum relatório vinculado (diferente de editarRelatorio,
    // que só funciona quando já existe relatório pra editar). statusPresenca
    // é genérico (o endpoint aceita qualquer valor válido do enum), mas o
    // uso real hoje é sempre 'Pendente de Evolução' (ver js/indicadores.js).
    async atualizarStatusAtendimento(id, statusPresenca) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTO_STATUS_ATUALIZAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status_presenca: statusPresenca }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao atualizar status (${response.status})`);
        }

        return response.json();
    },

    // Transforma um Atendimento cru, mantendo o Status_Presenca original —
    // usado pela aba Indicadores, que precisa enxergar Falta/Desmarcado/
    // Cancelado/Agendado além de Realizado (fetchAtendimentosComContexto
    // filtra pra Realizado só depois, pra montar a aba Atendimentos).
    transformAtendimentoCompleto(record, planoMap, relatorioByAtendimentoId) {
        return {
            id: record.id,
            pacienteNome: record.paciente_nome || 'Paciente não informado',
            terapeutaNome: record.terapeuta_nome || 'Terapeuta não informado',
            dataHora: record.data_hora || '',
            planoSaude: planoMap.get(record.paciente_id) || '',
            relatorio: relatorioByAtendimentoId.get(record.id) || null,
            status: record.status_presenca || 'Agendado',
        };
    },

    // Busca Atendimentos + Relatórios + Pacientes em UMA rodada só (1
    // chamada por tabela) e cruza tudo no cliente. Usado tanto pela aba
    // Atendimentos (que só quer os Realizados) quanto pela aba Indicadores
    // (que precisa de todos os status) — depois desse fetch, trocar de aba
    // é instantâneo, sem round-trip novo.
    async fetchAtendimentosComContexto() {
        const [atendimentos, relatorios, pacientes] = await Promise.all([
            this.fetchListar('LISTAR_ATENDIMENTOS'),
            this.fetchListar('LISTAR_RELATORIOS'),
            this.fetchListar('LISTAR_PACIENTES'),
        ]);

        const planoMap = this.buildPlanoMap(pacientes);

        const statusPorAtendimentoId = new Map();
        atendimentos.forEach((record) => {
            if (record.id != null) statusPorAtendimentoId.set(record.id, record.status_presenca || 'Agendado');
        });

        const relatoriosTransformados = relatorios
            .map((record) => this.transformRelatorio(record, planoMap, statusPorAtendimentoId))
            .sort((a, b) => new Date(b.data) - new Date(a.data));

        const relatorioByAtendimentoId = new Map();
        relatoriosTransformados.forEach((r) => {
            if (r.atendimentoId) relatorioByAtendimentoId.set(r.atendimentoId, r);
        });

        const todosAtendimentos = atendimentos
            .map((record) => this.transformAtendimentoCompleto(record, planoMap, relatorioByAtendimentoId))
            .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

        return {
            todosAtendimentos,
            atendimentosRealizados: todosAtendimentos.filter((a) => a.status === 'Realizado'),
            relatorios: relatoriosTransformados,
        };
    },
};
