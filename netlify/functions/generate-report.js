const { supabaseAdmin } = require('../supabaseClient');
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

const reportGeneratorPrompt = `
Você é um assistente eficiente. Sua tarefa é criar um resumo conciso a partir dos textos das transcrições de aulas fornecidas.
O resumo deve ter no máximo dois parágrafos.
Comece o resumo em primeira pessoa, com a frase "Esta semana eu ...".
Compile as informações das transcrições em um texto coeso e direto.
Responda diretamente com o HTML para ser inserido em uma div. Use tags como <p> e <strong>.
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

        const { transcriptionIds, infoAula, participantes, title, prompt } = JSON.parse(event.body);

        if (!transcriptionIds || transcriptionIds.length === 0) {
            return { statusCode: 400, body: '<p style=\"color: red;\">Pelo menos uma transcrição deve ser selecionada.</p>' };
        }

        if (!title) {
            return { statusCode: 400, body: '<p style=\"color: red;\">Erro: O título é obrigatório.</p>' };
        }

        // 2. Fetch transcriptions from Supabase
        const { data: transcriptions, error } = await supabaseAdmin
            .from('transcriptions')
            .select('title, transcription_text')
            .in('id', transcriptionIds);

        if (error) throw error;

        // 3. Combine texts
        const combinedText = transcriptions
            .map(t => `-- Transcrição: ${t.title} ---\\n${t.transcription_text}`)
            .join('\\n\\n');
        
        const finalPrompt = `
            Informações Gerais: Tópico: ${infoAula}, Nº de Participantes: ${participantes}.
            --- Textos das Aulas ---
            ${combinedText}
        `;

        // 4. Generate report with OpenRouter
        const openRouterResponse = await axios.post(openRouterUrl, {
            model: "openai/gpt-oss-20b:free",
            messages: [
                { role: "system", content: prompt || reportGeneratorPrompt },
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

        // 5. Salvar o relatório gerado no Supabase
        const { error: saveError } = await supabaseAdmin
            .from('reports')
            .insert([
                {
                    user_id: user.id,
                    title: title, // Adicionado
                    report_content: generatedHtml,
                    transcription_ids: transcriptionIds
                }
            ]);

        if (saveError) {
            console.error("Error saving report to Supabase:", saveError.message);
            // Não retorna erro ao usuário, apenas loga no servidor
        }
        
        // 6. Adicionar botão de cópia e script
        const uniqueId = `report-${Date.now()}`;
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
        console.error("Error generating report:", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: '<p style=\"color: red;\">Ocorreu um erro ao gerar o relatório.</p>'
        };
    }
};