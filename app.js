// ==========================================
// 1. IMPORTS DO FIREBASE
// ==========================================
import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 2. FUNÇÕES GLOBAIS (Modais, Abas e IA)
// ==========================================
window.toggleIA = function() {
    const chat = document.getElementById('ludotech-chat');
    if (chat) {
        if(chat.classList.contains('chat-hidden')) {
            chat.classList.remove('chat-hidden');
            chat.classList.add('chat-active');
        } else {
            chat.classList.remove('chat-active');
            chat.classList.add('chat-hidden');
        }
    }
};

window.abrirModal = () => document.getElementById('task-modal').style.display = 'flex';
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';

window.mudarVisao = function(visaoId) {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.agenda-view').forEach(v => v.style.display = 'none');
    if(event) event.currentTarget.classList.add('active');
    const target = document.getElementById('visao-' + visaoId);
    if(target) target.style.display = 'block';
};

// ==========================================
// 3. LÓGICA PRINCIPAL (Ao carregar a tela)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // --- SPLASH SCREEN ---
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        const login = document.getElementById('login-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                if(login) login.style.display = 'flex';
            }, 800);
        }
    }, 2000);

    // --- LOGIN REAL COM FIREBASE ---
    const btnEntrar = document.getElementById('btn-entrar');
    btnEntrar?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, senha);
            
            // Sucesso! Muda a tela
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            
            // Mostra a IA flutuante
            const widgetIA = document.getElementById('ludotech-widget');
            if(widgetIA) widgetIA.style.display = 'block'; 
            
        } catch (error) {
            console.error("Erro no login:", error.code);
            alert("E-mail ou senha incorretos!");
        }
    });

    // --- NAVEGAÇÃO DO MENU LATERAL ---
    const buttons = document.querySelectorAll(".menu-btn[data-target]");
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target");
            const targetElement = document.getElementById(targetId);
            
            if(targetElement) {
                buttons.forEach(btn => btn.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
                
                button.classList.add("active");
                targetElement.classList.add("active");
            }
        });
    });

    // --- CADASTRO DE RH (CRIAR COLABORADOR) ---
    const formRH = document.getElementById('form-rh');
    formRH?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('rh-nome').value;
        const email = document.getElementById('rh-email').value;
        const senha = document.getElementById('rh-senha').value;
        
        const checkboxes = formRH.querySelectorAll('input[type="checkbox"]:checked');
        const permissoes = Array.from(checkboxes).map(cb => cb.value);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const novoUsuario = userCredential.user;

            await setDoc(doc(db, "usuarios", novoUsuario.uid), {
                nome: nome,
                email: email,
                permissoes: permissoes,
                criadoEm: new Date().getTime()
            });

            alert(`Colaborador ${nome} cadastrado com sucesso!`);
            formRH.reset();
        } catch (error) {
            console.error("Erro ao criar usuário:", error);
            if(error.code === 'auth/email-already-in-use') alert("Esse e-mail já está cadastrado.");
            else if(error.code === 'auth/weak-password') alert("A senha deve ter pelo menos 6 caracteres.");
            else alert("Erro ao cadastrar. Verifique o console.");
        }
    });

    // --- FIREBASE: SALVAR TAREFA NA AGENDA ---
    const taskForm = document.getElementById('task-form');
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputsText = taskForm.querySelectorAll('input[type="text"]');
        const selects = taskForm.querySelectorAll('select');
        
        const novaTarefa = {
            titulo: inputsText[0].value,
            datas: inputsText[1].value, 
            responsavel: selects[0].value,
            prioridade: selects[1].value,
            link: taskForm.querySelector('input[type="url"]').value,
            descricao: taskForm.querySelector('textarea').value,
            status: 'pendente',
            criadoEm: new Date().getTime()
        };

        try {
            await addDoc(collection(db, "atividades"), novaTarefa);
            fecharModal();
            taskForm.reset();
        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            alert("Aviso: Banco de dados com regras fechadas ou erro de conexão.");
        }
    });

    // --- FIREBASE: LER TAREFAS E MONTAR O KANBAN ---
    const kanbanColumns = {
        'pendente': document.getElementById('col-pendente'),
        'analise': document.getElementById('col-analise'),
        'concluido': document.getElementById('col-concluido')
    };

    const q = query(collection(db, "atividades"), orderBy("criadoEm", "desc"));
    
    onSnapshot(q, (snapshot) => {
        if(kanbanColumns.pendente) kanbanColumns.pendente.innerHTML = '';
        if(kanbanColumns.analise) kanbanColumns.analise.innerHTML = '';
        if(kanbanColumns.concluido) kanbanColumns.concluido.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const tarefa = docSnap.data();
            const id = docSnap.id;
            renderizarCard(id, tarefa);
        });
    });

    function renderizarCard(id, data) {
        const card = document.createElement('div');
        card.className = `kanban-card neon-card prioridade-${data.prioridade}`;
        card.setAttribute('draggable', 'true');
        card.dataset.id = id; 

        card.innerHTML = `
            <div class="card-badges"><span class="badge-prioridade">${data.prioridade}</span></div>
            <h4>${data.titulo}</h4>
            <p>Resp: ${data.responsavel || 'Ninguém'}</p>
            <p style="font-size: 11px; color: #aaa; margin-top: 5px;">📅 ${data.datas || 'Sem data'}</p>
            <div class="card-footer">
                ${data.link ? `<span class="material-icons icon-link" onclick="window.open('${data.link}', '_blank')">link</span>` : '<span></span>'}
                <span class="material-icons" style="color: #888; cursor:pointer">edit</span>
            </div>
        `;
        
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
            card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
        });
        
        const statusTarget = kanbanColumns[data.status] || kanbanColumns['pendente'];
        if(statusTarget) statusTarget.appendChild(card);
    }

    // --- ARRASTAR E SOLTAR (DRAG AND DROP) ---
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
            const containerCards = column.querySelector('.cards-container');
            if(!containerCards) return;

            const afterElement = getDragAfterElement(containerCards, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (draggable) {
                if (afterElement == null) containerCards.appendChild(draggable);
                else containerCards.insertBefore(draggable, afterElement);
            }
        });

        column.addEventListener('drop', async (e) => {
            const draggable = document.querySelector('.dragging');
            if(draggable) {
                const taskId = draggable.dataset.id;
                const columnTitle = column.querySelector('h3').innerText.toLowerCase();
                
                let novoStatus = 'pendente';
                if (columnTitle.includes('análise')) novoStatus = 'analise';
                if (columnTitle.includes('concluído')) novoStatus = 'concluido';

                const taskRef = doc(db, "atividades", taskId);
                await updateDoc(taskRef, { status: novoStatus });
            }
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- REGISTRO DO PWA ---
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function() {
            navigator.serviceWorker.register("sw.js")
                .then(res => console.log("✅ Service Worker (PWA) registrado!"))
                .catch(err => console.log("⚠️ SW não encontrado."));
        });
    }
});
