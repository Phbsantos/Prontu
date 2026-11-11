const RelatoriosApi = {
    formatDateBrasilia(isoDate) {
        if (!isoDate) return '--';
        return new Date(isoDate).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
    },

    // 2026-09-08: /listar/relatorios (backend novo) devolve objetos
    // achatados: tipo, paciente_id, paciente_nome, autor_id, autor_nome,
    // data, conteudo, atendimento_id, editado_por_nome — tudo já resolvido
    // via JOIN no Postgres, sem lookup nem "fields" pra desembrulhar.
    transformRecord(record) {
        return {
            id: record.id,
            tipo: record.tipo || 'Evolução',
            patientName: record.paciente_nome || 'Paciente não informado',
            authorName: record.autor_nome || 'Autor não informado',
            date: this.formatDateBrasilia(record.data),
            conteudo: record.conteudo || 'Sem conteúdo registrado.',
            atendimentoId: record.atendimento_id || null,
            editadoPor: record.editado_por_nome || '',
            dataRaw: record.data,
        };
    },

    // /listar/relatorios não aceita filtro de servidor ainda (só
    // /listar/atendimentos ganhou isso na correção de 2026-09-08) — o
    // filtro do formulário continua sendo aplicado aqui no cliente.
    applyClientFilters(records, filters) {
        const nomeTermo = (filters.paciente_nome || '').trim().toLowerCase();
        const dataInicio = filters.data_inicio ? new Date(filters.data_inicio) : null;
        const dataFim = filters.data_fim ? new Date(filters.data_fim) : null;

        return records.filter((r) => {
            if (nomeTermo && !r.patientName.toLowerCase().includes(nomeTermo)) return false;

            if (r.dataRaw) {
                const data = new Date(r.dataRaw);
                if (dataInicio && data < dataInicio) return false;
                if (dataFim && data > dataFim) return false;
            }

            return true;
        });
    },

    async fetchRelatorios(filters = {}) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_RELATORIOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar relatórios (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];
        const transformados = records
            .map((record) => this.transformRecord(record))
            .sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));

        return this.applyClientFilters(transformados, filters);
    },
};
