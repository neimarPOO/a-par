
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// --- API Keys and Configuration ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const assemblyApiUrl = "https://api.assemblyai.com/v2";

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files like index.html

// --- Multer Configuration for Audio Upload ---
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// --- Prompts (based on your prompt.txt) ---
const lessonPlanPrompt = `
Você é um assistente especializado em planejamento educacional. Sua função é ajudar educadores a criar planos de aula eficientes.
Quando o usuário fornecer um programa, materiais e tempo, crie um plano de aula estruturado contendo:
1. **Resumo Executivo** (2-3 linhas sobre a aula)
2. **Distribuição Temporal Sugerida** (Abertura/Aquecimento, Desenvolvimento, Atividades práticas, Fechamento/Síntese)
3. **Cronograma Detalhado** com colunas para "Atividade", "Tempo Estimado", "Materiais Necessários", "Método Pedagógico", e "Objetivo da Atividade". Seja específico e use os materiais fornecidos pelo usuário.
4. **Pontos de Flexibilidade** (onde pode ajustar o tempo)
5. **Backup de Atividades** (caso sobre ou falte tempo)
Equilibre teoria e prática, considere diferentes estilos de aprendizagem e mantenha o engajamento.
Responda diretamente com o HTML para ser inserido em uma div. Use tags como <h3>, <ul>, <li>, <p>, <strong> e crie uma tabela para o cronograma detalhado.
`;

const reportGeneratorPrompt = `
Você é um especialista em documentação pedagógica. Sua função é compilar relatórios de aula detalhados a partir de observações e transcrições de áudio.
A partir do texto fornecido (que inclui observações do professor e uma transcrição de áudio da aula), estruture um relatório completo.
O relatório deve conter:
1. **Sumário da Aula**: Use as informações de Tópico, Data, Duração e Nº de Participantes.
2. **Observações Principais**: Extraia do texto os momentos de maior engajamento, dificuldades identificadas e sucessos alcançados.
3. **Análise Pedagógica**: Com base nas observações, analise a efetividade das estratégias, o uso do tempo e dos materiais.
4. **Reflexões do Educador**: Sintetize os insights e a autocrítica construtiva a partir do texto fornecido.
5. **Recomendações para Próximas Aulas**: Sugira ajustes e novas ideias com base em toda a análise.
Responda diretamente com o HTML para ser inserido em uma div. Use tags como <h3>, <ul>, <li>, <p>, <strong>. Não inclua a seção de evidências visuais, pois ela já existe no frontend.
`;


// --- API Routes ---

// 1. Lesson Plan Generator
app.post('/api/generate-plan', async (req, res) => {
    const { programa, materiais, tempo } = req.body;

    if (!programa || !materiais || !tempo) {
        return res.status(400).send('<p style="color: red;">Erro: Todos os campos são obrigatórios.</p>');
    }

    const userInput = `Programa da Aula: ${programa}. Materiais Disponíveis: ${materiais}. Tempo Total: ${tempo} minutos.`;

    try {
        const response = await axios.post(openRouterUrl, {
            model: "openai/gpt-3.5-turbo", // Using a standard, reliable model
            messages: [
                { role: "system", content: lessonPlanPrompt },
                { role: "user", content: userInput }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const generatedHtml = response.data.choices[0].message.content;
        res.send(generatedHtml);

    } catch (error) {
        console.error("Error calling OpenRouter API:", error.response ? error.response.data : error.message);
        res.status(500).send('<p style="color: red;">Ocorreu um erro ao gerar o plano de aula. Verifique o console do servidor.</p>');
    }
});

// 2. Report Generator
app.post('/api/generate-report', upload.single('audioFile'), async (req, res) => {
    const { observacoes, infoAula, participantes } = req.body;

    if (!observacoes || !infoAula || !participantes) {
        return res.status(400).send('<p style="color: red;">Erro: Informações da aula e observações são obrigatórias.</p>');
    }

    let transcriptionText = "";
    if (req.file) {
        try {
            // Step 1: Upload audio file to AssemblyAI
            const uploadResponse = await axios.post(`${assemblyApiUrl}/upload`, req.file.buffer, {
                headers: {
                    'authorization': ASSEMBLYAI_API_KEY,
                    'Content-Type': 'application/octet-stream'
                }
            });
            const uploadUrl = uploadResponse.data.upload_url;

            // Step 2: Submit the uploaded audio for transcription
            const transcriptResponse = await axios.post(`${assemblyApiUrl}/transcript`, {
                audio_url: uploadUrl
            }, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY }
            });
            const transcriptId = transcriptResponse.data.id;

            // Step 3: Poll for transcription completion
            const pollingEndpoint = `${assemblyApiUrl}/transcript/${transcriptId}`;
            while (true) {
                const pollingResponse = await axios.get(pollingEndpoint, { headers: { 'authorization': ASSEMBLYAI_API_KEY } });
                const transcriptionResult = pollingResponse.data;

                if (transcriptionResult.status === 'completed') {
                    transcriptionText = transcriptionResult.text;
                    break;
                } else if (transcriptionResult.status === 'error') {
                    throw new Error(`Transcription failed: ${transcriptionResult.error}`);
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
            }
        } catch (error) {
            console.error("Error with AssemblyAI:", error.response ? error.response.data : error.message);
            return res.status(500).send('<p style="color: red;">Ocorreu um erro ao transcrever o áudio.</p>');
        }
    }

    const combinedText = `
        Informações da Aula: ${infoAula}.
        Número de Participantes: ${participantes}.
        Observações do Professor: ${observacoes}.
        ${transcriptionText ? `Transcrição do Áudio da Aula: ${transcriptionText}` : ''}
    `;

    try {
        const response = await axios.post(openRouterUrl, {
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: reportGeneratorPrompt },
                { role: "user", content: combinedText }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const generatedHtml = response.data.choices[0].message.content;
        res.send(generatedHtml);

    } catch (error) {
        console.error("Error calling OpenRouter API:", error.response ? error.response.data : error.message);
        res.status(500).send('<p style="color: red;">Ocorreu um erro ao gerar o relatório. Verifique o console do servidor.</p>');
    }
});


// --- Server Start ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Abra seu navegador e acesse a URL acima para usar o assistente.');
});
