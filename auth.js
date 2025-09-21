const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const { data, error } = await _supabase.auth.getSession();
    if (error || !data.session) {
        // Se não estiver na página de login, redireciona
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // Usuário logado, pode continuar na index
        console.log('User is logged in.');
        // Exibir informações do usuário
        const userEmailSpan = document.getElementById('user-email');
        const userAvatarImg = document.getElementById('user-avatar');
        const logoutBtn = document.getElementById('logout-btn');

        if (data.session.user) {
            userEmailSpan.textContent = data.session.user.email;
            userEmailSpan.style.display = 'inline';
            
            const avatarUrl = data.session.user.user_metadata?.avatar_url || data.session.user.user_metadata?.picture;
            if (avatarUrl) {
                userAvatarImg.src = avatarUrl;
                userAvatarImg.style.display = 'inline';
            }
            logoutBtn.style.display = 'inline'; // Garante que o botão de sair esteja visível
        }
    }
}
