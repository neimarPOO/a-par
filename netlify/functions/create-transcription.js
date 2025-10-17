const axios = require('axios');
const Busboy = require('busboy');
const { supabaseAdmin, createSupabaseClient } = require('../supabaseClient');

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const assemblyApiUrl = "https://api.assemblyai.com/v2";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

const titleGenerationPrompt = `
Você é um assistente de IA especializado em resumir e titular textos. Sua função é criar um título conciso e relevante para o texto fornecido.
O título deve ter no máximo 5 palavras e capturar a essência do texto.
Responda apenas com o título gerado, sem nenhuma outra formatação ou texto adicional.
`;

// ... (a função parseMultipartForm não muda)
function parseMultipartForm(event) {
    return new Promise((resolve) => {
        const fields = {};
        let fileBuffer;
        let filename;
        const busboy = Busboy({ headers: event.headers });
        busboy.on('file', (fieldname, file, { filename: fname, encoding, mimeType }) => {
            filename = fname;
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => fileBuffer = Buffer.concat(chunks));
        });
        busboy.on('field', (fieldname, val) => fields[fieldname] = val);
        busboy.on('close', () => resolve({ fields, fileBuffer, filename }));
        busboy.end(Buffer.from(event.body, 'base64'));
    });
}

exports.handler = async (event) => {
    console.log('Create-transcription function invoked.');
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        console.error('No auth token provided.');
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log('Validating user token...');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            console.error('Invalid token or user not found:', userError?.message);
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.log(`User validated: ${user.id}`);

        let title, transcriptionText, type, audio_url;

        if (event.headers['content-type'] && event.headers['content-type'].includes('multipart/form-data')) {
            console.log('Processing multipart/form-data for audio upload...');
            const { fields, fileBuffer, filename } = await parseMultipartForm(event);
            title = fields.title;
            type = fields.type;
            console.log(`Received fields: title=${title}, type=${type}, filename=${filename}`);

            if (!fileBuffer) {
                console.error('Missing audio file.');
                return { statusCode: 400, body: JSON.stringify({ error: 'Audio file is required' }) };
            }

            console.log(`Uploading audio file to Supabase Storage... File size: ${fileBuffer.length} bytes`);
            const { data: storageData, error: storageError } = await supabaseAdmin.storage
                .from('audio-files')
                .upload(`${user.id}/${Date.now()}_${filename}`, fileBuffer, {
                    contentType: fields.mimeType,
                    upsert: false
                });

            if (storageError) {
                console.error('Supabase Storage error:', storageError.message);
                throw storageError;
            }
            console.log(`Audio file uploaded to: ${storageData.path}`);

            const { data: publicUrlData } = supabaseAdmin.storage
                .from('audio-files')
                .getPublicUrl(storageData.path);

            audio_url = publicUrlData.publicUrl;
            console.log(`Public URL: ${audio_url}`);

            console.log('Transcribing audio with AssemblyAI...');
            const uploadResponse = await axios.post(`${assemblyApiUrl}/upload`, fileBuffer, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' }
            });
            const uploadUrl = uploadResponse.data.upload_url;

            const transcriptResponse = await axios.post(`${assemblyApiUrl}/transcript`, { audio_url: uploadUrl, language_code: 'pt' }, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY }
            });
            const transcriptId = transcriptResponse.data.id;
            console.log(`AssemblyAI transcript ID: ${transcriptId}`);

            let pollingTranscriptionText = '';
            const pollingEndpoint = `${assemblyApiUrl}/transcript/${transcriptId}`;
            while (true) {
                console.log('Polling AssemblyAI for transcription status...');
                const pollingResponse = await axios.get(pollingEndpoint, { headers: { 'authorization': ASSEMBLYAI_API_KEY } });
                const transcriptionResult = pollingResponse.data;

                if (transcriptionResult.status === 'completed') {
                    pollingTranscriptionText = transcriptionResult.text;
                    console.log('Transcription completed.');
                    break;
                } else if (transcriptionResult.status === 'error') {
                    console.error('AssemblyAI transcription error:', transcriptionResult.error);
                    throw new Error(`Transcription failed: ${transcriptionResult.error}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }

            if (!pollingTranscriptionText) {
                console.warn('Transcription text is empty.');
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Nenhuma fala foi detectada no áudio ou o áudio está em silêncio.' }),
                };
            }
            transcriptionText = pollingTranscriptionText;

            if (!title) {
                console.log('Title is missing, generating title with OpenRouter...');
                const response = await axios.post(openRouterUrl, {
                    model: "openai/gpt-oss-20b:free",
                    messages: [
                        { role: "system", content: titleGenerationPrompt },
                        { role: "user", content: transcriptionText }
                    ],
                    max_tokens: 20
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://a-par.netlify.app', // Replace with your actual site URL
                        'X-Title': 'A-par' // Replace with your actual site name
                    }
                });
                title = response.data.choices[0].message.content.trim();
                console.log(`Generated title: ${title}`);
            }

        } else if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
            console.log('Processing application/json for text upload...');
            const body = JSON.parse(event.body);
            title = body.title;
            transcriptionText = body.transcription_text;
            type = body.type;
            audio_url = null;
            console.log(`Received data: title=${title}, type=${type}`);

            if (!transcriptionText) {
                console.error('Missing text content.');
                return { statusCode: 400, body: JSON.stringify({ error: 'Text content is required' }) };
            }

            if (!title) {
                console.log('Title is missing, generating title with OpenRouter...');
                const response = await axios.post(openRouterUrl, {
                    model: "openai/gpt-oss-20b:free",
                    messages: [
                        { role: "system", content: titleGenerationPrompt },
                        { role: "user", content: transcriptionText }
                    ],
                    max_tokens: 20
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://a-par.netlify.app', // Replace with your actual site URL
                        'X-Title': 'A-par' // Replace with your actual site name
                    }
                });
                title = response.data.choices[0].message.content.trim();
                console.log(`Generated title: ${title}`);
            }
        } else {
            console.error(`Unsupported Content-Type: ${event.headers['content-type']}`);
            return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported Content-Type' }) };
        }

        console.log('Saving transcription to Supabase...');
        const supabase = createSupabaseClient(token);
        const { data, error: insertError } = await supabase
            .from('transcriptions')
            .insert([{ title: title, transcription_text: transcriptionText, type: type, user_id: user.id, audio_url: audio_url }])
            .select();

        if (insertError) {
            console.error('Supabase insert error:', insertError.message);
            throw insertError;
        }

        console.log(`Transcription saved: ${JSON.stringify(data[0])}`);
        return {
            statusCode: 200,
            body: JSON.stringify(data[0]),
        };

    } catch (error) {
        console.error("Error in create-transcription function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create transcription.' }),
        };
    }
};