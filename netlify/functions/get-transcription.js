const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { id } = event.queryStringParameters;
    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Transcription ID is required' }) };
    }

    try {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data, error } = await supabaseAdmin
            .from('transcriptions')
            .select('id, created_at, title, type, transcription_text, audio_url')
            .eq('user_id', user.id)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Transcription not found' }) };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error fetching transcription:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch transcription' }),
        };
    }
};
