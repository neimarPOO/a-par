const { createClient } = require('@supabase/supabase-js');

// As variáveis de ambiente serão configuradas no Netlify
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Exporta um cliente Supabase inicializado
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
