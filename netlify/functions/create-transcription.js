const axios = require('axios');
const Busboy = require('busboy');
const { supabaseAdmin, createSupabaseClient } = require('../supabaseClient');

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const assemblyApiUrl = "https://api.assemblyai.com/v2";

// ... (a função parseMultipartForm não muda)
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

        let title, transcriptionText, type;

        // Processar diferentes tipos de requisição
        if (event.headers['content-type'] && event.headers['content-type'].includes('multipart/form-data')) {
            // Requisição de áudio (multipart/form-data)
            const { fields, fileBuffer } = await parseMultipartForm(event);
            title = fields.title;
            type = fields.type || 'audio'; // Assume 'audio' se não especificado

            if (!title || !fileBuffer) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Title and audio file are required' }) };
            }

            // 2. Transcrever o áudio com AssemblyAI
            const uploadResponse = await axios.post(`${assemblyApiUrl}/upload`, fileBuffer, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' }
            });
            const uploadUrl = uploadResponse.data.upload_url;

            const transcriptResponse = await axios.post(`${assemblyApiUrl}/transcript`, { audio_url: uploadUrl, language_code: 'pt' }, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY }
            });
            const transcriptId = transcriptResponse.data.id;

            let pollingTranscriptionText = '';
            const pollingEndpoint = `${assemblyApiUrl}/transcript/${transcriptId}`;
            while (true) {
                const pollingResponse = await axios.get(pollingEndpoint, { headers: { 'authorization': ASSEMBLYAI_API_KEY } });
                const transcriptionResult = pollingResponse.data;

                if (transcriptionResult.status === 'completed') {
                    pollingTranscriptionText = transcriptionResult.text;
                    break;
                } else if (transcriptionResult.status === 'error') {
                    throw new Error(`Transcription failed: ${transcriptionResult.error}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }

            if (!pollingTranscriptionText) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Nenhuma fala foi detectada no áudio ou o áudio está em silêncio.' }),
                };
            }
            transcriptionText = pollingTranscriptionText;

        } else if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
            // Requisição de texto (application/json)
            const body = JSON.parse(event.body);
            title = body.title;
            transcriptionText = body.transcription_text;
            type = body.type || 'text'; // Assume 'text' se não especificado

            if (!title || !transcriptionText) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Title and text content are required' }) };
            }
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported Content-Type' }) };
        }

        // 3. Salvar a transcrição/texto no Supabase com o user_id
        const supabase = createSupabaseClient(token);
        const { data, error: insertError } = await supabase
            .from('transcriptions')
            .insert([{ title: title, transcription_text: transcriptionText, type: type, user_id: user.id }])
            .select();

        if (insertError) throw insertError;

        return {
            statusCode: 200,
            body: JSON.stringify(data[0]),
        };

    } catch (error) {
        console.error("Error creating transcription:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create transcription.' }),
        };
    }
};