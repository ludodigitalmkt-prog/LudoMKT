document.addEventListener("DOMContentLoaded", () => {
    
    // --- LÓGICA DO LOGIN FALSO (Muda a tela) ---
    const btnEntrar = document.getElementById('btn-entrar');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    btnEntrar.addEventListener('click', () => {
        // Esconde a tela de login
        loginScreen.style.display = 'none';
        // Mostra o painel do Workspace
        appContainer.style.display = 'flex';
    });

    // --- LÓGICA DAS ABAS DO MENU ---
    const buttons = document.querySelectorAll(".menu-btn[data-target]");
    const tabs = document.querySelectorAll(".tab-content");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            // Remove a classe ativa de todos os botões e abas
            buttons.forEach(btn => btn.classList.remove("active"));
            tabs.forEach(tab => tab.style.display = "none");
            
            // Ativa apenas o que foi clicado
            button.classList.add("active");
            const targetId = button.getAttribute("data-target");
            document.getElementById(targetId).style.display = "block";
        });
    });
});
