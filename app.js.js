// REGISTRO DO PWA (Service Worker)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker
      .register("/sw.js")
      .then(res => console.log("Service Worker registrado com sucesso!"))
      .catch(err => console.log("Erro no Service Worker", err));
  });
}

// ... restante do código (Theme Toggle, Menu, etc) ...

document.addEventListener("DOMContentLoaded", () => {
    // --- LÓGICA DO TEMA (CLARO/ESCURO) ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('.material-icons');
    
    // Verifica se já existe um tema salvo no navegador
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.textContent = 'light_mode';
        themeToggleBtn.innerHTML = `<span class="material-icons">light_mode</span> Tema Claro`;
    }

    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggleBtn.innerHTML = `<span class="material-icons">dark_mode</span> Tema Escuro`;
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.innerHTML = `<span class="material-icons">light_mode</span> Tema Claro`;
        }
    });

    // --- SIMULAÇÃO DE LOGIN (Vamos ligar com Firebase depois) ---
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Esconde a tela de login e mostra o app
        document.getElementById('login-screen').classList.remove('screen-active');
        document.getElementById('login-screen').classList.add('screen-hidden');
        
        document.getElementById('app-container').classList.remove('screen-hidden');
        document.getElementById('app-container').style.display = 'flex'; // Força o flexbox
    });

    // --- LÓGICA DAS ABAS DO MENU ---
    const buttons = document.querySelectorAll(".menu-btn[data-target]");
    const tabs = document.querySelectorAll(".tab-content");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            buttons.forEach(btn => btn.classList.remove("active"));
            tabs.forEach(tab => tab.classList.remove("active"));
            
            button.classList.add("active");
            const targetId = button.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
        });
    });
});