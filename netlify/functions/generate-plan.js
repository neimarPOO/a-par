const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

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

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { programa, materiais, tempo } = JSON.parse(event.body);

    if (!programa || !materiais || !tempo) {
        return { statusCode: 400, body: '<p style="color: red;">Erro: Todos os campos são obrigatórios.</p>' };
    }

    const userInput = `Programa da Aula: ${programa}. Materiais Disponíveis: ${materiais}. Tempo Total: ${tempo} minutos.`;

    try {
        const response = await axios.post(openRouterUrl, {
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: lessonPlanPrompt },
                { role: "user", content: userInput }
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

        const generatedHtml = response.data.choices[0].message.content;
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: generatedHtml
        };

    } catch (error) {
        console.error("Error calling OpenRouter API:", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: '<p style="color: red;">Ocorreu um erro ao gerar o plano de aula.</p>'
        };
    }
};