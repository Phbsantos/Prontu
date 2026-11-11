const ApiService = {
    // 2026-09-08: backend novo (n8n local + Postgres) não tem mais
    // variantes de grafia pro Status_Presenca — o enum status_presenca no
    // banco tem um valor canônico só por estado (ver
    // db/migrations/001_init_schema.sql). Os dois mapas abaixo continuam
    // existindo só porque o app usa um vocabulário interno mais curto
    // (pending/realizado/falta/desmarcado/cancelado) que não bate 1:1 com
    // os valores do enum.
    mapApiStatusToInternal(apiStatus) {
        const map = {
            Agendado: 'pending',
            // 2026-09-17: status novo -- Coordenador reabre um "Realizado sem
            // evolução" pra este valor em vez de "Agendado" (ver
            // db/migrations/005_status_pendente_evolucao.sql), mas ele deve
            // se comportar exatamente igual a "Agendado" do ponto de vista
            // do terapeuta: mesmo badge "Pendente", mesmo aviso de
            // atendimentos atrasados (ver fetchAtendimentosPendentesAnteriores).
            'Pendente de Evolução': 'pending',
            Realizado: 'realizado',
            'Falta sem Aviso': 'falta',
            'Desmarcado com Aviso': 'desmarcado',
            'Cancelado pelo Terapeuta': 'cancelado',
        };
        return map[apiStatus] || 'pending';
    },

    mapInternalStatusToApi(internalStatus) {
        const map = {
            realizado: 'Realizado',
            falta: 'Falta sem Aviso',
            desmarcado: 'Desmarcado com Aviso',
            cancelado: 'Cancelado pelo Terapeuta',
        };
        return map[internalStatus] || 'Realizado';
    },

    engagementLabels: {
        excelente: 'Excelente / Muito Colaborativo',
        adequado: 'Adequado / Estável',
        parcial: 'Parcialmente Engajado / Atencioso',
        resistente: 'Resistência / Agitação',
    },

    formatTime(isoDate) {
        if (!isoDate) return '--:--';
        const date = new Date(isoDate);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    formatDate(isoDate) {
        if (!isoDate) return '';
        const date = new Date(isoDate);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    },

    // 2026-09-08: linha reta agora — /listar/atendimentos devolve objetos
    // já achatados (paciente_nome, terapeuta_id, terapeuta_nome, etc.),
    // sem "fields", sem lookup, sem precisar adivinhar se um valor "parece"
    // um record ID do Airtable. id/paciente_id/terapeuta_id já são
    // inteiros de verdade — comparam certo com session.id (também inteiro
    // desde o login novo, ver js/auth-api.js).
    transformAtendimento(record) {
        return {
            id: record.id,
            pacienteId: record.paciente_id,
            name: record.paciente_nome || `Paciente #${record.paciente_id}`,
            therapistName: record.terapeuta_nome || '',
            therapistId: record.terapeuta_id,
            age: '',
            time: this.formatTime(record.data_hora),
            specialty: record.especialidade || 'Terapia Ocupacional',
            tipoAtendimento: record.tipo_atendimento || '',
            status: this.mapApiStatusToInternal(record.status_presenca),
            notes: record.evolucao_prontuario || '',
            justification: record.justificativa_falta || '',
            engagement: record.nivel_engajamento || 'adequado',
            nextSteps: record.recomendacao_pos_sessao || '',
            dataHora: record.data_hora,
            apiStatus: record.status_presenca || 'Agendado',
        };
    },

    // Linha do tempo do dia (cartão de atendimento, index.html): busca direto
    // no servidor por paciente_id + data, SEM filtrar por terapeuta_id de
    // propósito — a clínica é multidisciplinar, então o terapeuta que abre o
    // cartão precisa ver o que já aconteceu com o paciente hoje em qualquer
    // especialidade/profissional, não só nos atendimentos que ele mesmo deu.
    // Só entram status que já ocorreram (Realizado/Falta/Desmarcado/
    // Cancelado) — "pending" (Agendado) ainda não tem nada pra mostrar.
    async fetchTimelineAtendimentosPaciente(pacienteId, data) {
        if (!pacienteId || !data) return [];

        const params = new URLSearchParams({ paciente_id: pacienteId, data });
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar a linha do tempo (${response.status})`);
        }

        const payload = await lerJsonLista(response);
        const records = Array.isArray(payload) ? payload : [];

        return records
            .map((record) => this.transformAtendimento(record))
            .filter((item) => item.status !== 'pending')
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // Atendimentos que ficaram pendentes (Agendado ou Pendente de Evolução —
    // ver mapApiStatusToInternal) em dias ANTERIORES a hoje. Diferente do
    // filtro "Pendentes" da lista da agenda (que é só o que ainda falta
    // fechar NO DIA selecionado): aqui é sempre relativo à data real de
    // hoje, independente de qual dia está aberto na tela.
    //
    // 2026-09-17: /listar/atendimentos só filtra status_presenca por
    // igualdade exata (um valor só), e agora existem DOIS valores que
    // contam como pendente pro terapeuta -- não dá mais pra filtrar isso
    // no servidor com esse endpoint. Passa a trazer tudo antes de ontem
    // pra esse terapeuta (poucos itens, sem custo real) e filtra no
    // cliente por status interno === 'pending', que já cobre os dois.
    async fetchAtendimentosPendentesAnteriores(terapeutaId) {
        if (!terapeutaId) return [];

        const hojeStr = new Date().toISOString().split('T')[0];
        const ontemMs = new Date(`${hojeStr}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
        const dataFim = new Date(ontemMs).toISOString().split('T')[0];

        const params = new URLSearchParams({
            terapeuta_id: terapeutaId,
            data_fim: dataFim,
        });

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao verificar atendimentos pendentes (${response.status})`);
        }

        const payload = await lerJsonLista(response);
        const records = Array.isArray(payload) ? payload : [];

        return records
            .map((record) => this.transformAtendimento(record))
            .filter((item) => item.status === 'pending')
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // Relatórios de Evolução que este terapeuta escreveu (autor_id) e que
    // foram alterados por outra pessoa (normalmente Coordenação) sem ele
    // ainda ter respondido — ver "precisa_ciencia" calculado no servidor em
    // /listar/relatorios (003_relatorio_ciencia.sql). Não filtra por tipo
    // aqui porque precisa_ciencia já só fica true pra Evolução.
    async fetchRelatoriosPendentesCiencia(autorId) {
        if (!autorId) return [];

        const params = new URLSearchParams({ autor_id: autorId });
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_RELATORIOS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao verificar alterações em relatórios (${response.status})`);
        }

        const payload = await lerJsonLista(response);
        const records = Array.isArray(payload) ? payload : [];

        return records
            .filter((record) => record.precisa_ciencia)
            .map((record) => ({
                id: record.id,
                pacienteNome: record.paciente_nome || 'Paciente não informado',
                data: record.data,
                conteudo: record.conteudo || '',
                editadoPorNome: record.editado_por_nome || 'não identificado',
                editadoPorEmail: record.editado_por_email || '',
                atualizadoEm: record.updated_at,
            }))
            .sort((a, b) => new Date(a.atualizadoEm) - new Date(b.atualizadoEm));
    },

    // "concordo" ou "nao_concordo" — nenhum dos dois muda o conteúdo do
    // relatório, só registram que o autor original viu a alteração e
    // respondeu. Discordância não vira um fluxo de aprovação dentro do
    // app: se ele não concordar, o combinado é falar direto com quem
    // editou (ver o modal obrigatório em index.html).
    async confirmarCienciaRelatorio(id, decisao) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_CONFIRMAR_CIENCIA}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, decisao }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao registrar resposta (${response.status})`);
        }

        return response.json();
    },

    // 2026-09-08: /listar/atendimentos agora aceita filtro de verdade no
    // servidor (terapeuta_id e data), corrigindo o problema documentado —
    // a API antiga (Airtable) ignorava qualquer query string, então o app
    // inteiro precisava trazer tudo e filtrar aqui. Filtro por ID do
    // terapeuta continua sendo o certo (exato, sem depender de nome) —
    // agora feito no Postgres via WHERE em vez de no JS.
    async fetchAtendimentosDia(date) {
        const session = AuthApi.getSession();
        const terapeutaId = session && session.id;

        // Falha fechada: sem terapeuta autenticado, não busca nada — é
        // dado de paciente, não é pra vazar por engano.
        if (!terapeutaId) return [];

        const params = new URLSearchParams({ terapeuta_id: terapeutaId });
        if (date) params.set('data', date);

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];

        return records.map((record) => this.transformAtendimento(record)).sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // Fechar um atendimento não é um "update" nele — é criar um Relatorio
    // (Tipo = Evolução) linkado via atendimento_id em /registrar/relatorio,
    // que agora também atualiza Status_Presenca/Evolucao_Prontuario/
    // Justificativa_Falta/Nivel_Engajamento/Recomendacao_Pos_Sessao do
    // Atendimento linkado — todos campos reais agora, ver buildRegisterPayload.
    async registerAtendimento(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_REGISTRAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao salvar atendimento (${response.status})`);
        }

        const rawText = await response.text().catch(() => '');
        if (!rawText) return { success: true };

        try {
            return JSON.parse(rawText);
        } catch (e) {
            return { success: true };
        }
    },

    // 2026-09-08: backend novo já tem coluna própria pra Nivel_Engajamento
    // e Recomendacao_Pos_Sessao em Atendimentos (ver
    // db/migrations/001_init_schema.sql) — não precisam mais ser
    // concatenados dentro do texto de "conteudo" como no Airtable antigo.
    // "conteudo" agora carrega só a evolução/justificativa de verdade;
    // os outros campos vão soltos no payload e o workflow
    // /registrar/relatorio grava cada um na coluna certa.
    // Modelos de evolução pessoais (2026-09-17) -- atalhos de texto que
    // cada usuário cadastra pra si mesmo, além dos 3 modelos fixos da
    // clínica (ver insertTemplate em js/app.js). Sempre filtrado pelo
    // usuário logado; não existe conceito de listar de outra pessoa aqui.
    async fetchModelosEvolucao() {
        const session = AuthApi.getSession();
        if (!session) return [];

        const params = new URLSearchParams({ usuario_id: session.id });
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_MODELOS_EVOLUCAO}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar modelos de evolução (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];
        return records.map((record) => ({ id: record.id, nome: record.nome, conteudo: record.conteudo }));
    },

    async salvarModeloEvolucao(nome, conteudo) {
        const session = AuthApi.getSession();
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MODELO_EVOLUCAO_REGISTRAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: session && session.id, nome, conteudo }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao salvar modelo (${response.status})`);
        }

        return response.json();
    },

    async removerModeloEvolucao(id) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MODELO_EVOLUCAO_REMOVER}?id=${encodeURIComponent(id)}`;
        const response = await fetch(url, { method: 'DELETE' });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao remover modelo (${response.status})`);
        }

        return response.json().catch(() => ({ sucesso: true }));
    },

    buildRegisterPayload(patient, formData) {
        const isRealizado = formData.status === 'realizado';
        const isFaltaOuDesmarcado = formData.status === 'falta' || formData.status === 'desmarcado';
        const session = AuthApi.getSession();

        return {
            tipo: 'Evolução',
            paciente_nome: patient.name,
            atendimento_id: patient.id,
            autor_nome: session && session.nome,
            data: (patient.dataHora || '').slice(0, 10),
            conteudo: isRealizado ? formData.notes || '' : `Justificativa: ${formData.justification || ''}`,
            editado_por_nome: null,
            status_presenca: this.mapInternalStatusToApi(formData.status),
            justificativa_falta: isFaltaOuDesmarcado ? formData.justification : null,
            nivel_engajamento: isRealizado ? formData.engagement || null : null,
            recomendacao_pos_sessao: isRealizado ? formData.nextSteps || null : null,
        };
    },
};
