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
        const { plan_prompt, report_prompt } = JSON.parse(event.body);

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const { data, error } = await supabaseAdmin
            .from('user_prompts')
            .upsert({ user_id: user.id, plan_prompt, report_prompt }, { onConflict: ['user_id'] })
            .select();

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data[0]),
        };
    } catch (error) {
        console.error("Error in update-user-prompts function:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update user prompts' }),
        };
    }
};