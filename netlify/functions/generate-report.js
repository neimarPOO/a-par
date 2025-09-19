const axios = require('axios');
const Busboy = require('busboy');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const assemblyApiUrl = "https://api.assemblyai.com/v2";

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

// Helper to parse multipart form data
function parseMultipartForm(event) {
    return new Promise((resolve) => {
        const fields = {};
        let fileBuffer;

        const busboy = Busboy({ headers: event.headers });

        busboy.on('file', (fieldname, file, { filename, encoding, mimeType }) => {
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => fileBuffer = Buffer.concat(chunks));
        });

        busboy.on('field', (fieldname, val) => fields[fieldname] = val);

        busboy.on('close', () => resolve({ fields, fileBuffer }));

        busboy.end(Buffer.from(event.body, 'base64'));
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { fields, fileBuffer } = await parseMultipartForm(event);
        const { observacoes, infoAula, participantes } = fields;

        if (!observacoes || !infoAula || !participantes) {
            return { statusCode: 400, body: '<p style="color: red;">Erro: Informações da aula e observações são obrigatórias.</p>' };
        }

        let transcriptionText = "";
        if (fileBuffer) {
            try {
                const uploadResponse = await axios.post(`${assemblyApiUrl}/upload`, fileBuffer, {
                    headers: { 'authorization': ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' }
                });
                const uploadUrl = uploadResponse.data.upload_url;

                const transcriptResponse = await axios.post(`${assemblyApiUrl}/transcript`, { audio_url: uploadUrl }, {
                    headers: { 'authorization': ASSEMBLYAI_API_KEY }
                });
                const transcriptId = transcriptResponse.data.id;

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
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                    }
                }
            } catch (error) {
                console.error("Error with AssemblyAI:", error.response ? error.response.data : error.message);
                return { statusCode: 500, body: '<p style="color: red;">Ocorreu um erro ao transcrever o áudio.</p>' };
            }
        }

        const combinedText = `
            Informações da Aula: ${infoAula}.
            Número de Participantes: ${participantes}.
            Observações do Professor: ${observacoes}.
            ${transcriptionText ? `Transcrição do Áudio da Aula: ${transcriptionText}` : ''}
        `;

        const openRouterResponse = await axios.post(openRouterUrl, {
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: reportGeneratorPrompt },
                { role: "user", content: combinedText }
            ],
            max_tokens: 2048
        }, {
            headers: { 
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://a-par.netlify.app', // Replace with your actual site URL
                'X-Title': 'A-par' // Replace with your actual site name
            }
        });

        const generatedHtml = openRouterResponse.data.choices[0].message.content;
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: generatedHtml
        };

    } catch (error) {
        console.error("Error in generate-report function:", error);
        return { statusCode: 500, body: '<p style="color: red;">Ocorreu um erro ao gerar o relatório.</p>' };
    }
};