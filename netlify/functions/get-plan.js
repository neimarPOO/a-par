const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { id } = event.queryStringParameters;
    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Plan ID is required' }) };
    }

    try {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data, error } = await supabaseAdmin
            .from('plans')
            .select('id, title, plan_content, created_at')
            .eq('user_id', user.id)
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Plan not found' }) };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error in get-plan function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch plan' }),
        };
    }
};