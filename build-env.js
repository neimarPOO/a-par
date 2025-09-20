const fs = require('fs');

// As variáveis de ambiente são injetadas pelo Netlify durante o build
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in the build environment.');
    process.exit(1);
}

const configFileContent = `// Arquivo de configuração gerado automaticamente pelo build
const SUPABASE_URL = "${supabaseUrl}";
const SUPABASE_ANON_KEY = "${supabaseAnonKey}";
`;

// Cria o arquivo config.js que será usado pelo frontend
fs.writeFileSync('config.js', configFileContent);

console.log('Successfully created config.js');
