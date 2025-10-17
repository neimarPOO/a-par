const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { title, content, transcriptionIds, participantes } = JSON.parse(event.body);
        if (!title || !content) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Title and content are required' }) };
        }

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data, error } = await supabaseAdmin
            .from('reports')
            .insert([{ title: title, report_content: content, user_id: user.id, transcription_ids: transcriptionIds, participantes: participantes }])
            .select();

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data[0]),
        };
    } catch (error) {
        console.error("Error in create-report function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create report' }),
        };
    }
};