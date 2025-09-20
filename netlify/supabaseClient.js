const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Cliente admin - usado para validar tokens, etc.
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Função para criar um cliente específico para o usuário a partir de um token
const createSupabaseClient = (token) => {
    return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, { // Usa a anon key aqui
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
}

module.exports = { supabaseAdmin, createSupabaseClient };