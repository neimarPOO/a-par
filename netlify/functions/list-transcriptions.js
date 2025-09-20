const { createSupabaseClient } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const supabase = createSupabaseClient(token);
        const { data, error } = await supabase
            .from('transcriptions')
            .select('id, created_at, title, transcription_text')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error fetching transcriptions:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch transcriptions' }),
        };
    }
};