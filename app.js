import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// VARIÁVEIS GLOBAIS
let usuarioLogado = null; 
let todasAtividades = {}; // Guarda as tarefas para podermos editar

// FUNÇÕES DE TELA
window.toggleIA = function() {
    const chat = document.getElementById('ludotech-chat');
    if (chat) chat.classList.toggle('chat-hidden');
};

window.abrirModal = () => {
    document.getElementById('task-id').value = ""; // Limpa ID (Nova tarefa)
    document.getElementById('task-form').reset();
    document.getElementById('task-modal').style.display = 'flex';
};

window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';

window.editarTarefa = function(id) {
    const tarefa = todasAtividades[id];
    if(!tarefa) return;
    
    document.getElementById('task-id').value = id;
    document.getElementById('task-titulo').value = tarefa.titulo;
    document.getElementById('task-status').value = tarefa.status;
    document.getElementById('task-prioridade').value = tarefa.prioridade;
    document.getElementById('task-datas').value = tarefa.datas || '';
    document.getElementById('task-desc').value = tarefa.descricao || '';
    document.getElementById('task-modal').style.display = 'flex';
};

window.mudarVisaoAgenda = function(visaoId) {
    document.getElementById('visao-kanban').style.display = 'none';
    document.getElementById('visao-calendario').style.display = 'none';
    document.getElementById('visao-' + visaoId).style.display = 'block';
    if(visaoId === 'calendario' && window.calendarioGeral) setTimeout(() => window.calendarioGeral.render(), 100);
};

document.addEventListener("DOMContentLoaded", () => {
    
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
    }, 2000);

    // MUDANÇA DE ESTADO (Verifica quem logou para carregar Benefícios e Planner)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                usuarioLogado = docSnap.data();
                // Atualiza tela de Benefícios
                document.getElementById('saldo-vr').innerText = usuarioLogado.vr_saldo || "0,00";
            }
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            carregarUsuariosNoSelect();
        }
    });

    // LOGIN & SAIR
    document.getElementById('btn-entrar')?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, email, senha); } 
        catch (error) { alert("E-mail ou senha incorretos!"); }
    });

    document.getElementById('btn-sair')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.reload(); // Recarrega a página para limpar os dados
    });

    // MENU
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

                if(targetId === 'planner' && window.calendarioIndividual) setTimeout(() => window.calendarioIndividual.render(), 100);
            }
        });
    });

    async function carregarUsuariosNoSelect() {
        const selectResp = document.getElementById('task-responsaveis');
        if(!selectResp) return;
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        selectResp.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const option = document.createElement('option');
            option.value = docSnap.data().nome;
            option.text = docSnap.data().nome;
            selectResp.appendChild(option);
        });
    }

    // SALVAR OU EDITAR TAREFA
    document.getElementById('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = document.getElementById('task-id').value;
        const selectResp = document.getElementById('task-responsaveis');
        const selecionados = Array.from(selectResp.selectedOptions).map(opt => opt.value);
        
        const baseTarefa = {
            titulo: document.getElementById('task-titulo').value,
            responsaveis: selecionados.join(', '),
            status: document.getElementById('task-status').value,
            prioridade: document.getElementById('task-prioridade').value,
            datas: document.getElementById('task-datas').value,
            descricao: document.getElementById('task-desc').value,
        };

        try {
            if (idEdicao !== "") {
                // É UMA EDIÇÃO
                await updateDoc(doc(db, "atividades", idEdicao), baseTarefa);
            } else {
                // É NOVA
                baseTarefa.criadoEm = new Date().getTime();
                await addDoc(collection(db, "atividades"), baseTarefa);
            }
            fecharModal();
        } catch (error) { alert("Erro ao salvar!"); }
    });

   // CHATBOT GROQ (LLAMA 3) INTEGRADO
    const btnSendIa = document.getElementById('send-ia');
    btnSendIa?.addEventListener('click', async () => {
        const input = document.getElementById('chat-input');
        const chatBody = document.getElementById('chat-messages');
        const msgUser = input.value;
        if(msgUser === "") return;

        // Mostra a msg do usuário
        chatBody.innerHTML += `<div class="msg-user">${msgUser}</div>`;
        input.value = "";
        chatBody.innerHTML += `<div class="msg-ia" id="loading-ia">Pensando rapidinho...</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;

        // ========================================================
        // ⚠️ ATENÇÃO: COLOQUE SUA CHAVE DE API DA GROQ AQUI ⚠️
        const API_KEY = "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"; 
        // ========================================================

        try {
            // O Groq usa a mesma estrutura do ChatGPT, o que facilita muito!
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama3-70b-8192", // Modelo super inteligente e rápido
                    messages: [
                        { role: "system", content: "Você é a LudoTech, uma assistente virtual simpática e especialista em marketing da agência LudoMKT. Ajude os colaboradores com ideias criativas, curtas e diretas. Responda sempre em português do Brasil." },
                        { role: "user", content: msgUser }
                    ]
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            const respostaIA = data.choices[0].message.content;
            
            document.getElementById('loading-ia').remove();
            chatBody.innerHTML += `<div class="msg-ia">${respostaIA.replace(/\n/g, '<br>')}</div>`;
            chatBody.scrollTop = chatBody.scrollHeight;
            
        } catch(error) {
            document.getElementById('loading-ia').remove();
            console.error(error);
            chatBody.innerHTML += `<div class="msg-ia" style="color: #ff3366;">Erro: Verifique sua chave API da Groq.</div>`;
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    });

    // INICIALIZAR CALENDÁRIOS
    if (typeof FullCalendar !== 'undefined') {
        const configCalendario = {
            initialView: 'dayGridMonth', locale: 'pt-br',
            headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth' },
            editable: true, droppable: true,
            eventClick: function(info) { editarTarefa(info.event.id); }, // Clicar abre a edição
            eventDrop: async function(info) {
                try { await updateDoc(doc(db, "atividades", info.event.id), { datas: info.event.start.toISOString().split('T')[0] }); } 
                catch (error) { info.revert(); }
            }
        };
        const calGeralEl = document.getElementById('calendar-geral');
        if(calGeralEl) window.calendarioGeral = new FullCalendar.Calendar(calGeralEl, configCalendario);
        
        const calIndEl = document.getElementById('calendar-individual');
        if(calIndEl) window.calendarioIndividual = new FullCalendar.Calendar(calIndEl, configCalendario);
    }

    // LER TAREFAS, MONTAR KANBAN, FILTRAR PLANNER INDIVIDUAL
    const kanbanColumns = { 'pendente': document.getElementById('col-pendente'), 'analise': document.getElementById('col-analise'), 'concluido': document.getElementById('col-concluido') };
    const q = query(collection(db, "atividades"), orderBy("criadoEm", "desc"));
    
    onSnapshot(q, (snapshot) => {
        if(kanbanColumns.pendente) kanbanColumns.pendente.innerHTML = '';
        if(kanbanColumns.analise) kanbanColumns.analise.innerHTML = '';
        if(kanbanColumns.concluido) kanbanColumns.concluido.innerHTML = '';

        let eventosGerais = [];
        let eventosIndividuais = [];
        let pendentesCount = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            todasAtividades[id] = data; // Salva globalmente para edição
            
            if (data.status === 'pendente') pendentesCount++;
            
            const card = document.createElement('div');
            card.className = `kanban-card`;
            card.setAttribute('draggable', 'true');
            card.dataset.id = id; 
            card.onclick = () => editarTarefa(id); // Clicar no card edita
            card.innerHTML = `<div style="font-weight:bold; font-size:18px;">${data.titulo}</div><div style="font-size:12px; color:#ccc;">Resp: ${data.responsaveis || 'Todos'}</div>`;
            
            card.addEventListener('dragstart', () => { card.classList.add('dragging'); card.style.opacity = '0.5'; });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
            
            if(kanbanColumns[data.status]) kanbanColumns[data.status].appendChild(card);

            if (data.datas && data.datas !== '') {
                let corDoEvento = data.status === 'analise' ? '#ffaa00' : (data.status === 'concluido' ? '#00ff88' : '#ff3366');
                const eventoData = { id: id, title: data.titulo, start: data.datas, backgroundColor: corDoEvento, borderColor: corDoEvento };
                
                eventosGerais.push(eventoData);
                
                // FILTRO DO PLANNER INDIVIDUAL: Só entra se tiver o nome do usuário logado
                if(usuarioLogado && data.responsaveis.includes(usuarioLogado.nome)) {
                    eventosIndividuais.push(eventoData);
                }
            }
        });

        const badge = document.getElementById('badge-tarefas');
        if(badge) { badge.innerText = pendentesCount; badge.style.display = pendentesCount > 0 ? 'inline-block' : 'none'; }

        if (window.calendarioGeral) { window.calendarioGeral.removeAllEvents(); window.calendarioGeral.addEventSource(eventosGerais); }
        if (window.calendarioIndividual) { window.calendarioIndividual.removeAllEvents(); window.calendarioIndividual.addEventSource(eventosIndividuais); }
    });

    // PWA
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.log(e));
});
