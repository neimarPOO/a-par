const { supabaseAdmin } = require('../supabaseClient');

exports.handler = async (event) => {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data: plans, error: fetchError } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        return {
            statusCode: 200,
            body: JSON.stringify(plans),
        };

    } catch (error) {
        console.error("Error fetching plans:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch plans.' }),
        };
    }
};