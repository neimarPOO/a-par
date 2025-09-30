const { createClient } = supabase;
let _supabase;

try {
    console.log('Attempting to initialize Supabase client...');
    console.log('SUPABASE_URL available:', typeof SUPABASE_URL !== 'undefined');
    console.log('SUPABASE_ANON_KEY available:', typeof SUPABASE_ANON_KEY !== 'undefined');

    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
        throw new Error('Supabase URL or Anon Key is not defined. Check config.js and Netlify environment variables.');
    }

    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully.');

} catch (error) {
    console.error('FATAL: Supabase client initialization failed.', error.message);
    alert('ERRO CRÍTICO: A conexão com o banco de dados falhou. Verifique as chaves de API e a configuração do projeto. Pressione F12 para ver os detalhes do erro no console.');
}

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const errorMessage = document.getElementById('error-message');

// --- Funções de Autenticação ---

async function signInWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('d-none');
    } else {
        window.location.href = 'index.html';
    }
}

async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await _supabase.auth.signUp({ email, password });

    if (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('d-none');
    } else {
        alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
        errorMessage.classList.add('d-none');
    }
}

async function signInWithGoogle() {
    const { error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://a-par.netlify.app'
        }
    });
    if (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('d-none');
    }
}

async function logout() {
    const { error } = await _supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        window.location.href = 'login.html';
    }
}

// --- Event Listeners (Apenas na página de login) ---
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmail();
    });

    signupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signUp();
    });

    googleLoginBtn.addEventListener('click', () => {
        signInWithGoogle();
    });
}

// --- Verificação de Sessão (para index.html) ---
async function checkSession() {
    const { data: { session }, error } = await _supabase.auth.getSession();

    if (error || !session) {
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // Sessão válida, exibe informações do usuário
        const user = session.user;
        const userAvatar = document.getElementById('user-avatar');
        const userEmail = document.getElementById('user-email');

        if (user) {
            if (user.user_metadata && user.user_metadata.avatar_url) {
                userAvatar.src = user.user_metadata.avatar_url;
                userAvatar.style.display = 'block';
            }
            if (user.email) {
                userEmail.textContent = user.email;
                userEmail.style.display = 'block';
            }
        }
    }
}
