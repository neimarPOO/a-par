const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    console.log('get-transcription function invoked.');
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        console.error('No auth token provided.');
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { id } = event.queryStringParameters;
    console.log(`Fetching transcription with id: ${id}`);
    if (!id) {
        console.error('No transcription ID provided.');
        return { statusCode: 400, body: JSON.stringify({ error: 'Transcription ID is required' }) };
    }

    try {
        console.log('Validating user token...');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            console.error('Invalid token or user not found:', userError?.message);
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.log(`User validated: ${user.id}`);

        console.log(`Fetching transcription from Supabase...`);
        const { data, error } = await supabaseAdmin
            .from('transcriptions')
            .select('id, created_at, title, type, transcription_text, audio_url')
            .eq('user_id', user.id)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Supabase fetch error:', error.message);
            throw error;
        }

        if (!data) {
            console.warn(`Transcription with id ${id} not found for user ${user.id}`);
            return { statusCode: 404, body: JSON.stringify({ error: 'Transcription not found' }) };
        }

        console.log(`Transcription found: ${JSON.stringify(data)}`);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error in get-transcription function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch transcription' }),
        };
    }
};
