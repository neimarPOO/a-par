# Documento de Requisitos do Produto (PRD): A-PAR

### 1. Introdução e Resumo Executivo

O **A-PAR (Assistente de Planejamento de Aulas e Relatórios)** é uma aplicação web projetada para apoiar educadores da Rede Calábria no planejamento, execução e documentação de suas atividades pedagógicas. A plataforma visa otimizar o tempo do professor, fornecendo ferramentas inteligentes para criar planos de aula estruturados e gerar relatórios detalhados a partir de diversas fontes de dados (áudio, imagens, texto), transformando a maneira como as aulas são preparadas e analisadas.

### 2. Visão e Objetivos do Projeto

**Visão:** Ser a ferramenta de referência para os educadores da Rede Calábria, promovendo um ciclo de melhoria contínua através de planejamento eficiente e reflexão pedagógica aprofundada.

**Objetivos:**
*   **Otimizar o tempo:** Reduzir significativamente o tempo gasto por educadores na criação de planos de aula e relatórios.
*   **Qualificar a prática pedagógica:** Fornecer insights e análises a partir dos dados das aulas para ajudar os professores a refinar suas estratégias.
*   **Centralizar a documentação:** Criar um repositório único e de fácil acesso para planos de aula e relatórios de atividades.
*   **Facilitar a colaboração:** Permitir que a gestão pedagógica acompanhe e apoie o desenvolvimento dos educadores de forma mais eficaz.

### 3. Público-Alvo

*   **Usuário Primário:** Professores e educadores da Rede Calábria que ministram aulas e precisam de uma ferramenta para planejar e documentar suas práticas.
*   **Usuário Secundário:** Coordenadores e gestores pedagógicos que acompanham o trabalho dos professores e a evolução dos alunos.

### 4. Funcionalidades Principais (Features)

#### 4.1. Autenticação de Usuário
*   Os usuários devem poder criar uma conta e fazer login de forma segura.
*   O sistema deve exibir a foto do usuário logado, garantindo uma experiência personalizada.

#### 4.2. Módulo de Planejamento de Aulas
*   **Input do Usuário:** O professor fornecerá os objetivos da aula, tópicos, competências a serem desenvolvidas, materiais disponíveis e tempo total.
*   **Geração de Plano de Aula:** A plataforma irá gerar um plano de aula detalhado, contendo:
    *   Resumo executivo da aula.
    *   Cronograma detalhado com atividades, tempo estimado, materiais e método pedagógico.
    *   Distribuição do tempo (abertura, desenvolvimento, prática, fechamento).
    *   Sugestões de flexibilização e atividades de backup.
*   **Listagem e Gerenciamento:** Os planos de aula criados ficarão salvos e listados na conta do usuário.

#### 4.3. Módulo de Relatórios de Aulas
*   **Input Multimodal:** O professor poderá criar relatórios a partir de diferentes fontes:
    *   **Gravação de Áudio:** Uma função para gravar áudio diretamente na plataforma. O áudio será transcrito automaticamente.
    *   **Upload de Texto:** Uma função para adicionar anotações de texto diretamente.
    *   **(Futuro) Upload de Imagens:** Capacidade de anexar imagens como evidências visuais das atividades.
*   **Processamento Inteligente:** O sistema irá analisar o conteúdo fornecido para:
    *   Identificar temas e extrair insights pedagógicos das transcrições.
    *   Estruturar as observações em categorias (comportamento, dificuldades, sucessos).
    *   Sugerir análises sobre a eficácia das estratégias e uso do tempo.
*   **Geração de Relatório:** Compilará um documento estruturado com sumário da aula, observações, análise pedagógica, reflexões e recomendações.
*   **Gerenciamento de Transcrições/Relatórios:** O usuário poderá visualizar, editar e excluir as transcrições e relatórios gerados.

### 5. Fluxo do Usuário

1.  **Login:** O usuário acessa a página `login.html` e entra no sistema.
2.  **Painel Principal (`index.html`):** Após o login, o usuário é direcionado para o painel, onde pode escolher entre "Planejamento de Aulas" e "Relatório de Aulas".
3.  **Criando um Plano:**
    *   O usuário seleciona "Planejamento de Aulas".
    *   Preenche o formulário com as informações da aula.
    *   Clica em "Gerar Plano" e o sistema exibe o plano de aula estruturado.
    *   O plano é salvo automaticamente na sua lista de planos.
4.  **Criando um Relatório:**
    *   O usuário seleciona "Relatório de Aulas".
    *   Ele escolhe entre "Gravação" (abre um modal para gravar áudio) ou "Adicionar texto" (abre um modal para inserir texto).
    *   Após adicionar o conteúdo, clica em "Adicionar à lista".
    *   A plataforma processa o conteúdo e o adiciona à lista de transcrições.
    *   O usuário pode então selecionar uma ou mais transcrições/textos e clicar em "Gerar Relatório" para obter o documento final consolidado.

### 6. Considerações de Design e UX

*   A interface deve ser limpa, intuitiva e amigável para usuários com diferentes níveis de habilidade tecnológica.
*   Na aba "Relatório de aulas", a área de "Adicionar Nova Transcrição" será substituída por dois botões de ícone: "Gravação" e "Adicionar texto", que abrirão modais para suas respectivas funções.
*   O layout deve ser consistente e profissional, alinhado com a identidade visual do A-PAR e da Rede Calábria.

### 7. Pilha Tecnológica (Stack)

*   **Frontend:** HTML5, CSS3, JavaScript (vanilla).
*   **Backend (Serverless):** Netlify Functions, rodando em um ambiente Node.js.
*   **Banco de Dados e Autenticação:** **Supabase** é utilizado como a principal solução de backend-as-a-service, gerenciando o banco de dados (PostgreSQL), autenticação de usuários e armazenamento de arquivos.
*   **Hospedagem (Host):** A aplicação está hospedada na **Netlify**, que também orquestra a execução das funções serverless e o deploy contínuo.
*   **Dependências Notáveis:**
    *   `@supabase/supabase-js`: Biblioteca cliente oficial para interagir com o Supabase no frontend e no backend.
    *   `axios`: Cliente HTTP para realizar chamadas de API, possivelmente para a API da OpenAI ou outros serviços externos.
    *   `busboy` / `multer`: Middleware para Node.js utilizado para processar dados de formulários `multipart/form-data`, essencial para o upload de arquivos (como áudios e imagens).
    *   `dotenv`: Módulo para carregar variáveis de ambiente de um arquivo `.env`, mantendo chaves de API e configurações seguras.

### 8. Métricas de Sucesso

*   **Engajamento:** Número de planos de aula e relatórios gerados por semana/mês.
*   **Adoção:** Percentual de professores da Rede Calábria utilizando ativamente a plataforma.
*   **Retenção:** Taxa de usuários que retornam à plataforma após o primeiro uso.
*   **Feedback Qualitativo:** Pesquisas de satisfação e entrevistas com os educadores para coletar feedback e sugestões de melhoria.
