const PacientesApi = {
    // 2026-09-08: /listar/pacientes (backend novo, n8n local + Postgres)
    // devolve um array de objetos já achatados — nada de "fields", nada
    // de lookup Airtable pra resolver terapeuta_responsavel_nome/plano_nome,
    // o workflow já faz o JOIN e devolve pronto.
    transformPaciente(record) {
        return {
            id: record.id,
            nome: record.nome_completo || '',
            dataNascimento: record.data_nascimento || '',
            responsavelNome: record.responsavel_nome || '',
            telefoneWhatsapp: record.telefone_whatsapp || '',
            planoSaude: record.plano_nome || '',
            terapeutaResponsavelNome: record.terapeuta_responsavel_nome || '',
            status: record.status || '',
        };
    },

    async fetchPacientes() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_PACIENTES}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar pacientes (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];

        return records
            .map((record) => this.transformPaciente(record))
            .filter((p) => p.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
