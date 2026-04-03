document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. LÓGICA DE LOGIN (Transição de Tela)
    // ==========================================
    const btnEntrar = document.getElementById('btn-entrar');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    btnEntrar.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        
        // Validação simples para teste visual
        if(email !== "" && senha !== "") {
            loginScreen.style.display = 'none';
            appContainer.style.display = 'flex';
        } else {
            alert("Por favor, preencha e-mail e senha para acessar.");
        }
    });

    // ==========================================
    // 2. NAVEGAÇÃO DO MENU LATERAL (Abas)
    // ==========================================
    const buttons = document.querySelectorAll(".menu-btn[data-target]");
    const tabs = document.querySelectorAll(".tab-content");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            // Remove a classe 'active' de todos os botões e esconde todas as abas
            buttons.forEach(btn => btn.classList.remove("active"));
            tabs.forEach(tab => tab.classList.remove("active"));
            
            // Adiciona a classe 'active' no botão clicado e mostra a aba correta
            button.classList.add("active");
            const targetId = button.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
        });
    });

    // ==========================================
    // 3. KANBAN ESTILO TRELLO (Arrastar e Soltar)
    // ==========================================
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-column');

    // Adiciona os eventos em cada card
    cards.forEach(card => {
        card.setAttribute('draggable', 'true'); // Garante que pode ser arrastado

        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
            card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
        });
    });

    // Permite que as colunas recebam os cards
    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault(); // Necessário para permitir o drop
            const afterElement = getDragAfterElement(column, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (draggable) {
                if (afterElement == null) {
                    column.appendChild(draggable);
                } else {
                    column.insertBefore(draggable, afterElement);
                }
            }
        });
    });

    // Função matemática para saber exatamente em qual posição soltar o card
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==========================================
    // 4. REGISTRO DO PWA (Instalar como App)
    // ==========================================
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function() {
            navigator.serviceWorker
                .register("sw.js") // Arquivo que criaremos depois no GitHub
                .then(res => console.log("✅ Service Worker (PWA) registrado com sucesso!"))
                .catch(err => console.log("⚠️ Service Worker não encontrado (Ainda não criamos o sw.js)"));
        });
    }
});

// ==========================================
    // 5. ANIMAÇÃO DE CARREGAMENTO (SPLASH SCREEN)
    // ==========================================
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        const login = document.getElementById('login-screen');
        
        // Esmaece a splash screen
        splash.style.opacity = '0';
        
        // Após 800ms (tempo da transição), esconde ela e mostra o login
        setTimeout(() => {
            splash.style.display = 'none';
            login.style.display = 'flex';
        }, 800);
    }, 2000); // Fica na tela por 2 segundos

    // ==========================================
    // 6. CONTROLE DE VISÕES DA AGENDA E MODAL
    // ==========================================
    window.mudarVisao = function(visaoId) {
        // Remove active dos botões e esconde visões
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.agenda-view').forEach(v => v.style.display = 'none');
        
        // Ativa o clicado
        event.currentTarget.classList.add('active');
        document.getElementById('visao-' + visaoId).style.display = 'block';
    }

    window.abrirModal = function() {
        document.getElementById('task-modal').style.display = 'flex';
    }

    window.fecharModal = function() {
        document.getElementById('task-modal').style.display = 'none';
    }

import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- REFERÊNCIAS ---
    const btnEntrar = document.getElementById('btn-entrar');
    const taskForm = document.getElementById('task-form');
    const kanbanColumns = {
        'pendente': document.querySelector('#visao-kanban .kanban-column:nth-child(1)'),
        'analise': document.querySelector('#visao-kanban .kanban-column:nth-child(2)'),
        'concluido': document.querySelector('#visao-kanban .kanban-column:nth-child(3)')
    };

    // --- LOGIN SIMULADO ---
    btnEntrar?.addEventListener('click', () => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    });

    // --- SALVAR TAREFA NO FIREBASE ---
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const novaTarefa = {
            titulo: taskForm.querySelector('input[type="text"]').value,
            responsavel: taskForm.querySelectorAll('select')[0].value,
            prioridade: taskForm.querySelectorAll('select')[1].value,
            dataInicio: taskForm.querySelectorAll('input[type="date"]')[0].value,
            dataFim: taskForm.querySelectorAll('input[type="date"]')[1].value,
            link: taskForm.querySelector('input[type="url"]').value,
            descricao: taskForm.querySelector('textarea').value,
            status: 'pendente', // Toda tarefa nasce pendente
            criadoEm: new Date().getTime()
        };

        try {
            await addDoc(collection(db, "atividades"), novaTarefa);
            fecharModal();
            taskForm.reset();
            alert("Atividade salva com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
        }
    });

    // --- LER TAREFAS EM TEMPO REAL (MÁGICA DO KANBAN) ---
    const q = query(collection(db, "atividades"), orderBy("criadoEm", "desc"));
    
    onSnapshot(q, (snapshot) => {
        // Limpar colunas antes de renderizar
        Object.values(kanbanColumns).forEach(col => {
            const container = col.querySelector('.cards-container') || col;
            // Mantém apenas o título da coluna (H3)
            const titulo = col.querySelector('h3');
            col.innerHTML = '';
            col.appendChild(titulo);
        });

        snapshot.forEach((doc) => {
            const tarefa = doc.data();
            const id = doc.id;
            renderizarCard(id, tarefa);
        });
    });

    function renderizarCard(id, data) {
        const card = document.createElement('div');
        card.className = `kanban-card neon-card prioridade-${data.prioridade}`;
        card.innerHTML = `
            <div class="card-badges"><span class="badge-prioridade">${data.prioridade}</span></div>
            <h4>${data.titulo}</h4>
            <p>Resp: ${data.responsavel || 'Ninguém'}</p>
            <div class="card-footer">
                ${data.link ? `<span class="material-icons icon-link" onclick="window.open('${data.link}', '_blank')">link</span>` : ''}
                <span class="material-icons" style="color: #888; cursor:pointer" onclick="editarTarefa('${id}')">edit</span>
            </div>
        `;
        
        // Coloca o card na coluna certa baseada no status
        if(kanbanColumns[data.status]) {
            kanbanColumns[data.status].appendChild(card);
        }
    }

    // Funções de Modal que agora precisam estar no escopo do módulo
    window.abrirModal = () => document.getElementById('task-modal').style.display = 'flex';
    window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';
    
    window.mudarVisao = function(visaoId) {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.agenda-view').forEach(v => v.style.display = 'none');
        document.getElementById('visao-' + visaoId).style.display = 'block';
    };

    // Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 800);
        }
    }, 2000);
});
