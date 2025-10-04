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
        const { id, content } = JSON.parse(event.body);
        if (!id || !content) {
            return { statusCode: 400, body: JSON.stringify({ error: 'ID and content are required' }) };
        }

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data, error } = await supabaseAdmin
            .from('reports')
            .update({ report_content: content })
            .eq('user_id', user.id)
            .eq('id', id)
            .select();

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Report not found or user does not have permission' }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Report updated successfully' }),
        };
    } catch (error) {
        console.error("Error in update-report function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update report' }),
        };
    }
};