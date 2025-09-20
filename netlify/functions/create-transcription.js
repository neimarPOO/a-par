const axios = require('axios');
const Busboy = require('busboy');
const { supabase } = require('../supabaseClient');

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const assemblyApiUrl = "https://api.assemblyai.com/v2";

// Helper to parse multipart form data from Netlify function event
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
        const { title } = fields;

        if (!title || !fileBuffer) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Title and audio file are required' }) };
        }

        // 1. Transcribe audio with AssemblyAI
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
            // Instead of a generic 500 error, return a specific 400-level error for the frontend.
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Nenhuma fala foi detectada no áudio ou o áudio está em silêncio.' }),
            };
        }

        // 2. Save transcription to Supabase
        const { data, error } = await supabase
            .from('transcriptions')
            .insert([{ title: title, transcription_text: transcriptionText }])
            .select();

        if (error) {
            throw error;
        }

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