const { supabase} = require('../supabaseClient');
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

const reportGeneratorPrompt = `
Você é um especialista em documentação pedagógica. Sua função é compilar relatórios de aula detalhados a partir de um conjunto de transcrições de aulas.
A partir dos textos fornecidos, estruture um relatório consolidado e coerente.
O relatório deve conter:
1. **Sumário Executivo**: Uma síntese das principais observações encontradas em todas as transcrições.
2. **Observações Principais**: Agrupe e extraia os momentos de maior engajamento, dificuldades identificadas e sucessos alcançados em todos os textos.
3. **Análise Pedagógica Comparativa**: Analise a efetividade das estratégias, o uso do tempo e dos materiais de forma consolidada.
4. **Reflexões e Insights do Educador**: Sintetize os insights e a autocrítica construtiva a partir de todos os textos.
5. **Recomendações Gerais**: Sugira ajustes e novas ideias com base na análise de todas as aulas.
Responda diretamente com o HTML para ser inserido em uma div. Use tags como <h3>, <ul>, <li>, <p>, <strong>.
`;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { transcriptionIds, infoAula, participantes } = JSON.parse(event.body);

        if (!transcriptionIds || transcriptionIds.length === 0) {
            return { statusCode: 400, body: '<p style="color: red;">Pelo menos uma transcrição deve ser selecionada.</p>' };
        }

        // 1. Fetch transcriptions from Supabase
        const { data: transcriptions, error } = await supabase
            .from('transcriptions')
            .select('title, transcription_text')
            .in('id', transcriptionIds);

        if (error) throw error;

        // 2. Combine texts
        const combinedText = transcriptions
            .map(t => `-- Transcrição: ${t.title} ---
${t.transcription_text}`)
            .join('\n\n');
        
        const finalPrompt = `
            Informações Gerais: Tópico: ${infoAula}, Nº de Participantes: ${participantes}.
            --- Textos das Aulas ---
            ${combinedText}
        `;

        // 3. Generate report with OpenRouter
        const openRouterResponse = await axios.post(openRouterUrl, {
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: reportGeneratorPrompt },
                { role: "user", content: finalPrompt }
            ],
            max_tokens: 2048
        }, {
            headers: { 
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://a-par.netlify.app',
                'X-Title': 'A-par'
            }
        });

        const generatedHtml = openRouterResponse.data.choices[0].message.content;
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: generatedHtml
        };

    } catch (error) {
        console.error("Error generating report:", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: '<p style="color: red;">Ocorreu um erro ao gerar o relatório.</p>'
        };
    }
};