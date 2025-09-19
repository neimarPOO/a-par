const { supabase } = require('../supabaseClient');

exports.handler = async () => {
    try {
        const { data, error } = await supabase
            .from('transcriptions')
            .select('id, created_at, title, transcription_text')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

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