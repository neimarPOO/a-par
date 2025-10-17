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

        const { data, error } = await supabaseAdmin
            .from('user_prompts')
            .select('plan_prompt, report_prompt')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error in get-user-prompts function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get user prompts' }),
        };
    }
};