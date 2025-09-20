const axios = require('axios');
const Busboy = require('busboy');
const { supabaseAdmin } = require('../supabaseClient'); // Usamos o admin para validar o usuário

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

        const { fields, fileBuffer } = await parseMultipartForm(event);
        const { title } = fields;

        if (!title || !fileBuffer) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Title and audio file are required' }) };
        }

        // 2. Transcrever o áudio com AssemblyAI (como antes)
        const uploadResponse = await axios.post(`${assemblyApiUrl}/upload`, fileBuffer, {
            headers: { 'authorization': ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' }
        });
        const uploadUrl = uploadResponse.data.upload_url;

        const transcriptResponse = await axios.post(`${assemblyApiUrl}/transcript`, { audio_url: uploadUrl, language_code: 'pt' }, {
            headers: { 'authorization': ASSEMBLYAI_API_KEY }
        });
        const transcriptId = transcriptResponse.data.id;

        let transcriptionText = '';
        const pollingEndpoint = `${assemblyApiUrl}/transcript/${transcriptId}`;
        while (true) {
            const pollingResponse = await axios.get(pollingEndpoint, { headers: { 'authorization': ASSEMBLYAI_API_KEY } });
            const transcriptionResult = pollingResponse.data;

            if (transcriptionResult.status === 'completed') {
                transcriptionText = transcriptionResult.text;
                break;
            } else if (transcriptionResult.status === 'error') {
                throw new Error(`Transcription failed: ${transcriptionResult.error}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        if (!transcriptionText) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Nenhuma fala foi detectada no áudio ou o áudio está em silêncio.' }),
            };
        }

        // 3. Salvar a transcrição no Supabase com o user_id
        const { data, error: insertError } = await supabaseAdmin
            .from('transcriptions')
            .insert([{ title: title, transcription_text: transcriptionText, user_id: user.id }])
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