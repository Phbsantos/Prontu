# Checklist de testes manuais — Prontu contra o backend novo (VPS)

Backend em `https://38-72-132-152.sslip.io` (HTTPS via Caddy). Testado por curl endpoint a endpoint durante a migração — esta lista é pra validar o **app de verdade**, no navegador, com fluxo de usuário real. Marque cada item conforme for testando; qualquer coisa que falhar, anota o que apareceu (mensagem de erro, console do navegador) antes de reportar.

Usuários de teste disponíveis (senha de todos: `trocar123`):
- `fernanda.duarte@exemplo.com.br` — Terapeuta (Fonoaudiologia, Equipe Manhã)
- `rafael.nogueira@exemplo.com.br` — Terapeuta (Psicologia, Equipe Manhã)
- `camila.alves@exemplo.com.br` — Supervisor (Terapia Ocupacional, Equipe Manhã)
- `bruno.castro@exemplo.com.br` — Terapeuta (Psicomotricidade, Equipe Tarde)
- `juliana.prado@exemplo.com.br` — Supervisor (Fonoaudiologia, Equipe Tarde)
- `marcos.teixeira@exemplo.com.br` — Coordenador
- `ana.lima@exemplo.com.br` — Admin

---

## 1. Login e sessão

- [ ] Login com e-mail/senha corretos (`fernanda.duarte@exemplo.com.br` / `trocar123`) — entra e vai pra tela certa (Terapeuta → `index.html`).
- [ ] Login com senha errada — mensagem de erro clara, não trava a tela.
- [ ] Login com e-mail que não existe — mesma mensagem de erro (não deve dizer "e-mail não encontrado" especificamente).
- [ ] Depois de logado, dá refresh (F5) — continua logado (sessão não se perde).
- [ ] Logout — volta pra tela de login, e tentar acessar uma página interna direto pela URL redireciona pro login.
- [ ] Login com cada perfil (Terapeuta, Supervisor, Coordenador, Admin) — cada um cai/tem acesso à página certa (ver regras de `role-guard.js`: Terapeuta só `index.html`; Supervisor `index.html`+`supervisor.html`; Coordenador/Admin sem restrição).

## 2. Agenda do Terapeuta (`index.html`)

- [ ] Login como Fernanda Duarte — a agenda do dia mostra os atendimentos dela (não de outro terapeuta).
- [ ] Abrir um atendimento "Realizado" do passado — evolução aparece certinha, sem poder editar (trava após Realizado).
- [ ] Fechar um atendimento "Agendado" como **Realizado** — preencher evolução, nível de engajamento, recomendação — salva e reflete na tela.
- [ ] Fechar um atendimento como **Falta sem Aviso** ou **Desmarcado com Aviso** — confirmar que o status realmente muda pra isso (não vira "Realizado" à força — esse era o bug histórico, já confirmado corrigido por teste direto, mas vale ver na UI também).
- [ ] Navegar entre dias na agenda — muda a lista corretamente.

## 3. Cadastros (`cadastros.html`)

### Paciente
- [ ] Cadastrar um paciente novo, preenchendo terapeuta responsável e plano de saúde — salva sem erro.
- [ ] O paciente cadastrado aparece na lista/autocomplete em outras telas (ex: ao criar recorrência).

### Usuário
- [ ] Cadastrar um usuário novo (Terapeuta ou Supervisor) — salva sem erro.
- [ ] O usuário novo já consegue fazer login com a senha definida no cadastro.

### Recorrência — **ativada de verdade nesta rodada, teste com atenção**
- [ ] Preencher o formulário (paciente, terapeuta, dias da semana, horário, duração, data de início, semanas) e salvar.
- [ ] Toast de sucesso mostra quantos atendimentos foram gerados.
- [ ] A recorrência aparece na lista abaixo do formulário, com os dias/horário certos.
- [ ] A recorrência aparece como bloco na grade semanal, no dia/horário certo.
- [ ] **Importante**: conferir que os atendimentos de verdade foram criados — abrir a agenda do terapeuta escolhido (ou o painel de Coordenação) e confirmar que aparecem os atendimentos futuros gerados pela recorrência, nas datas certas.
- [ ] Dar refresh na aba de Recorrência (F5) — a recorrência cadastrada continua aparecendo (agora vem do backend, não deve mais sumir ao recarregar como acontecia antes).
- [ ] Arrastar um card na grade — **não deve mais funcionar** (funcionalidade removida nesta rodada, por não ter endpoint de atualização ainda). Se ainda tentar arrastar e nada acontecer, é o esperado.

## 4. Painel de Coordenação (`coordenacao.html`)

- [ ] Login como Marcos Teixeira (Coordenador) ou Ana Beatriz Lima (Admin).
- [ ] Aba **Atendimentos**: lista carrega, filtros funcionam (com/sem evolução, data, etc.).
- [ ] Aba **Relatórios**: filtros funcionam, exportação em PDF/Word/XML funciona pra um paciente só.
- [ ] Aba **Indicadores**: KPIs carregam, tabela por terapeuta/paciente aparece, risco de faltas consecutivas calculado.
- [ ] Botão flutuante (FAB) de atendimento avulso aparece **só** pro Coordenador (não pro Admin) — abrir o modal e criar um atendimento avulso direto.
- [ ] Atalhos do FAB pras abas de Cadastros (paciente/usuário/recorrência) abrem a aba certa.

## 5. Painel do Supervisor (`supervisor.html`)

- [ ] Login como Camila Alves ou Juliana Prado (Supervisor).
- [ ] A agenda mostra só os atendimentos da equipe daquele supervisor (Camila → Equipe Manhã; Juliana → Equipe Tarde).
- [ ] Agendar uma sessão avulsa pela tela do supervisor — salva e aparece na agenda.

## 6. Relatórios (`relatorios.html`)

- [ ] Lista de relatórios carrega.
- [ ] Modal de relatório avulso (usado também em `index.html`/`supervisor.html`) salva corretamente.

## 7. Geral / sidebar / responsividade

- [ ] Sidebar colapsa/expande no desktop e o estado persiste depois de F5.
- [ ] Em tela estreita (celular/tablet, ≤900px), sidebar vira menu off-canvas com botão hambúrguer.
- [ ] Trocar de tema (claro/escuro, se aplicável) funciona em todas as páginas.

---

## O que reportar se algo falhar

Pra cada item que falhar: nome da tela, o que você fez, o que esperava, o que aconteceu de fato, e se possível a mensagem de erro do console do navegador (F12 → Console) ou da aba Network (a resposta HTTP do endpoint que falhou).
