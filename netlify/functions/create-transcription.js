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
            const { fields, fileBuffer } = await parseMultipartForm(event);
            title = fields.title;
            type = fields.type;
            console.log(`Received fields: title=${title}, type=${type}`);

            if (!title || !fileBuffer) {
                console.error('Missing title or audio file.');
                return { statusCode: 400, body: JSON.stringify({ error: 'Title and audio file are required' }) };
            }

            console.log(`Uploading audio file to Supabase Storage... File size: ${fileBuffer.length} bytes`);
            const { data: storageData, error: storageError } = await supabaseAdmin.storage
                .from('audio-files')
                .upload(`${user.id}/${Date.now()}_${fields.filename}`, fileBuffer, {
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

        } else if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
            console.log('Processing application/json for text upload...');
            const body = JSON.parse(event.body);
            title = body.title;
            transcriptionText = body.transcription_text;
            type = body.type;
            audio_url = null;
            console.log(`Received data: title=${title}, type=${type}`);

            if (!title || !transcriptionText) {
                console.error('Missing title or text content.');
                return { statusCode: 400, body: JSON.stringify({ error: 'Title and text content are required' }) };
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