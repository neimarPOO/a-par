const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { type } = event.queryStringParameters;

        let query = supabaseAdmin
            .from('transcriptions')
            .select('id, created_at, title, type')
            .eq('user_id', user.id);

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

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