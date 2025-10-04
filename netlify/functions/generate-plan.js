const axios = require('axios');
const { supabaseAdmin } = require('../supabaseClient');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

const lessonPlanPrompt = `
Você é um assistente especializado em planejamento educacional. Sua função é ajudar educadores a criar planos de aula eficientes a partir de suas anotações.
Quando o usuário fornecer o conteúdo de suas anotações (transcrições de áudio ou texto), crie um plano de aula estruturado contendo:
1. **Resumo Executivo** (2-3 linhas sobre a aula)
2. **Distribuição Temporal Sugerida** (Abertura/Aquecimento, Desenvolvimento, Atividades práticas, Fechamento/Síntese)
3. **Cronograma Detalhado** com colunas para "Atividade", "Tempo Estimado", "Materiais Necessários", "Método Pedagógico", e "Objetivo da Atividade".
4. **Pontos de Flexibilidade** (onde pode ajustar o tempo)
5. **Backup de Atividades** (caso sobre ou falte tempo)
Equilibre teoria e prática, considere diferentes estilos de aprendizagem e mantenha o engajamento.
Responda diretamente com o HTML para ser inserido em uma div. Use tags como <h3>, <ul>, <li>, <p>, <strong> e crie uma tabela para o cronograma detalhado.
`;

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 1. Validar o token e obter o usuário
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { transcriptionIds } = JSON.parse(event.body);

        if (!transcriptionIds || transcriptionIds.length === 0) {
            return { statusCode: 400, body: '<p style="color: red;">Erro: Nenhuma anotação selecionada.</p>' };
        }

        // Buscar o conteúdo das transcrições no Supabase
        const { data: transcriptions, error: fetchError } = await supabaseAdmin
            .from('transcriptions')
            .select('transcription_text')
            .in('id', transcriptionIds);

        if (fetchError) throw fetchError;

        const combinedText = transcriptions.map(t => t.transcription_text).join('\n\n---\n\n');

        const userInput = `Conteúdo das anotações: ${combinedText}`;

        const response = await axios.post(openRouterUrl, {
            model: "openai/gpt-oss-20b:free",
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

        // Salvar o plano de aula gerado no Supabase
        const { data: savedPlan, error: saveError } = await supabaseAdmin
            .from('plans')
            .insert([{
                user_id: user.id,
                plan_content: generatedHtml,
                transcription_ids: transcriptionIds
            }])
            .select();

        if (saveError) {
            console.error("Error saving plan to Supabase:", saveError.message);
            // Decide se quer retornar um erro ou apenas logar
        }

        const uniqueId = `plan-${Date.now()}`;
        const finalHtml = `
            <div id="content-to-copy-${uniqueId}">
                ${generatedHtml}
            </div>
            <button onclick="copyContent('copy-btn-${uniqueId}', 'content-to-copy-${uniqueId}')" id="copy-btn-${uniqueId}" style="margin-top: 15px; padding: 8px 12px; border-radius: 5px; border: 1px solid #ccc; cursor: pointer;">Copiar Texto</button>
            <script>
                if (typeof copyContent !== 'function') {
                    window.copyContent = function(buttonId, contentId) {
                        const contentElement = document.getElementById(contentId);
                        const button = document.getElementById(buttonId);
                        if (contentElement && button) {
                            navigator.clipboard.writeText(contentElement.innerText).then(() => {
                                button.textContent = 'Copiado!';
                                setTimeout(() => {
                                    button.textContent = 'Copiar Texto';
                                }, 2000);
                            }).catch(err => {
                                console.error('Erro ao copiar texto: ', err);
                                button.textContent = 'Erro ao copiar';
                            });
                        }
                    }
                }
            <\/script>
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: finalHtml
        };

    } catch (error) {
        console.error("Error calling OpenRouter API or fetching transcriptions:", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: '<p style="color: red;">Ocorreu um erro ao gerar o plano de aula.</p>'
        };
    }
};