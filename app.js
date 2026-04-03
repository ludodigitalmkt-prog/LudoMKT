import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

document.addEventListener("DOMContentLoaded", () => {
    
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 800);
        }
    }, 2000);

    const btnEntrar = document.getElementById('btn-entrar');
    btnEntrar?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, senha);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            document.getElementById('ludotech-widget').style.display = 'block'; 
            
        } catch (error) {
            console.error("Erro no login:", error.code);
            alert("E-mail ou senha incorretos!");
        }
    });

    // --- TROCA DE ABAS DO MENU ---
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

                // SE CLICAR NO PLANNER, RENDERIZA O CALENDÁRIO
                if(targetId === 'planner' && window.meuCalendario) {
                    setTimeout(() => window.meuCalendario.render(), 100);
                }
            }
        });
    });

    const formRH = document.getElementById('form-rh');
    formRH?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('rh-nome').value;
        const email = document.getElementById('rh-email').value;
        const senha = document.getElementById('rh-senha').value;
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                nome: nome,
                email: email,
                criadoEm: new Date().getTime()
            });
            alert(`Sucesso! O usuário ${nome} foi criado.`);
            formRH.reset();
        } catch (error) {
            alert("Erro ao criar usuário: " + error.message);
        }
    });

    const taskForm = document.getElementById('task-form');
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputsText = taskForm.querySelectorAll('input[type="text"]');
        const selects = taskForm.querySelectorAll('select');
        
        const novaTarefa = {
            titulo: inputsText[0].value,
            datas: inputsText[1]?.value || '', 
            responsavel: selects[0].value,
            prioridade: selects[1].value,
            status: 'pendente',
            criadoEm: new Date().getTime()
        };

        try {
            await addDoc(collection(db, "atividades"), novaTarefa);
            fecharModal();
            taskForm.reset();
        } catch (error) {
            alert("Erro ao salvar! Veja as permissões do Firebase.");
        }
    });

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
            const data = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = `kanban-card neon-card prioridade-${data.prioridade}`;
            card.setAttribute('draggable', 'true');
            card.dataset.id = id; 
            card.innerHTML = `<h4>${data.titulo}</h4><p style="font-size:12px; color:#aaa;">Resp: ${data.responsavel}</p>`;
            
            card.addEventListener('dragstart', () => { card.classList.add('dragging'); card.style.opacity = '0.5'; });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
            
            if(kanbanColumns[data.status]) kanbanColumns[data.status].appendChild(card);
        });
    });

    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
            const containerCards = column.querySelector('.cards-container');
            const draggable = document.querySelector('.dragging');
            if (draggable && containerCards) containerCards.appendChild(draggable);
        });

        column.addEventListener('drop', async (e) => {
            const draggable = document.querySelector('.dragging');
            if(draggable) {
                const columnId = column.id;
                let novoStatus = 'pendente';
                if (columnId === 'coluna-amarela') novoStatus = 'analise';
                if (columnId === 'coluna-verde') novoStatus = 'concluido';

                await updateDoc(doc(db, "atividades", draggable.dataset.id), { status: novoStatus });
            }
        });
    });
// ==========================================
    // INICIALIZAÇÃO DO CALENDÁRIO UX (FULLCALENDAR)
    // ==========================================
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        window.meuCalendario = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            editable: true, // Permite arrastar os eventos (Drag and Drop)
            droppable: true,
            buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana' },
            events: [], // Começa vazio, o Firebase vai preencher
            
            // QUANDO ARRASTAR UM EVENTO NO CALENDÁRIO, SALVA NO FIREBASE:
            eventDrop: async function(info) {
                const taskId = info.event.id;
                // Pega a nova data no formato YYYY-MM-DD
                const novaData = info.event.start.toISOString().split('T')[0]; 
                
                try {
                    await updateDoc(doc(db, "atividades", taskId), { datas: novaData });
                    console.log("Data atualizada na nuvem!");
                } catch (error) {
                    console.error("Erro ao atualizar data", error);
                    info.revert(); // Se der erro na internet, volta o card pro lugar original
                }
            }
        });
        window.meuCalendario.render();
    }

    // --- INTEGRAR O KANBAN COM O CALENDÁRIO ---
    // Encontre a sua variável `const q = query(...)` e substitua o bloco onSnapshot inteiro por este:
    const q = query(collection(db, "atividades"), orderBy("criadoEm", "desc"));
    onSnapshot(q, (snapshot) => {
        if(kanbanColumns.pendente) kanbanColumns.pendente.innerHTML = '';
        if(kanbanColumns.analise) kanbanColumns.analise.innerHTML = '';
        if(kanbanColumns.concluido) kanbanColumns.concluido.innerHTML = '';

        let eventosDoCalendario = []; // Lista vazia para o calendário

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // 1. Renderiza no Kanban (Trello)
            const card = document.createElement('div');
            card.className = `kanban-card neon-card prioridade-${data.prioridade}`;
            card.setAttribute('draggable', 'true');
            card.dataset.id = id; 
            card.innerHTML = `<h4>${data.titulo}</h4><p style="font-size:12px; color:#aaa;">Resp: ${data.responsavel}</p>`;
            
            card.addEventListener('dragstart', () => { card.classList.add('dragging'); card.style.opacity = '0.5'; });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
            
            if(kanbanColumns[data.status]) kanbanColumns[data.status].appendChild(card);

            // 2. Prepara para o Calendário
            if (data.datas && data.datas !== '') {
                // Define a cor baseada na coluna do Trello
                let corDoEvento = '#ff3366'; // Pendente (Vermelho)
                if (data.status === 'analise') corDoEvento = '#ffaa00'; // Amarelo
                if (data.status === 'concluido') corDoEvento = '#00ff88'; // Verde

                eventosDoCalendario.push({
                    id: id,
                    title: data.titulo,
                    start: data.datas,
                    backgroundColor: corDoEvento,
                    borderColor: corDoEvento
                });
            }
        });

        // 3. Atualiza o Calendário na tela
        if (window.meuCalendario) {
            window.meuCalendario.removeAllEvents();
            window.meuCalendario.addEventSource(eventosDoCalendario);
        }
    });
    
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(err => console.log(err));
    }
});
