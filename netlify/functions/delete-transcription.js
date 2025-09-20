const { createSupabaseClient } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id } = JSON.parse(event.body);
        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'ID is required' }) };
        }

        const supabase = createSupabaseClient(token);
        const { error } = await supabase
            .from('transcriptions')
            .delete()
            .match({ id: id });

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Transcription deleted successfully' }),
        };
    } catch (error) {
        console.error("Error deleting transcription:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete transcription' }),
        };
    }
};