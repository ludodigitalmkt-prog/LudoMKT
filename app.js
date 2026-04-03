import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

window.abrirModal = () => document.getElementById('task-modal').style.display = 'flex';
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';

window.mudarVisaoAgenda = function(visaoId) {
    document.getElementById('visao-kanban').style.display = 'none';
    document.getElementById('visao-calendario').style.display = 'none';
    document.getElementById('visao-' + visaoId).style.display = 'block';
    if(visaoId === 'calendario' && window.calendarioGeral) {
        setTimeout(() => window.calendarioGeral.render(), 100);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    
    // Esconder Splash
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
    }, 2000);

    // LOGIN
    const btnEntrar = document.getElementById('btn-entrar');
    btnEntrar?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, senha);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            carregarUsuariosNoSelect(); // Busca a equipe ao logar
        } catch (error) {
            alert("Erro no login: Usuário ou senha inválidos.");
        }
    });

    // SAIR
    document.getElementById('btn-sair')?.addEventListener('click', async () => {
        await signOut(auth);
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-form').reset();
    });

    // MENU NAVEGAÇÃO
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

                if(targetId === 'planner' && window.calendarioIndividual) {
                    setTimeout(() => window.calendarioIndividual.render(), 100);
                }
            }
        });
    });

    // RH: CADASTRAR FUNCIONÁRIO E DEFINIR VALOR DO VR
    const formRH = document.getElementById('form-rh');
    formRH?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('rh-nome').value;
        const email = document.getElementById('rh-email').value;
        const senha = document.getElementById('rh-senha').value;
        const vr = document.getElementById('rh-vr').value;
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                nome: nome,
                email: email,
                vr_saldo: vr,
                criadoEm: new Date().getTime()
            });
            alert(`${nome} cadastrado com sucesso! VR liberado: R$${vr}`);
            formRH.reset();
            carregarUsuariosNoSelect(); // Atualiza a lista na hora
        } catch (error) {
            alert("Erro ao criar: " + error.message);
        }
    });

    // BUSCAR USUÁRIOS PARA O SELECT DA AGENDA
    async function carregarUsuariosNoSelect() {
        const selectResp = document.getElementById('task-responsaveis');
        if(!selectResp) return;
        
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        selectResp.innerHTML = ''; // Limpa o "Carregando..."
        
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const option = document.createElement('option');
            option.value = user.nome;
            option.text = user.nome;
            selectResp.appendChild(option);
        });
    }

    // SALVAR TAREFA (ACEITANDO VÁRIOS USUÁRIOS E VÁRIAS DATAS)
    const taskForm = document.getElementById('task-form');
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Pega todos os usuários selecionados segurando CTRL
        const selectResp = document.getElementById('task-responsaveis');
        const selecionados = Array.from(selectResp.selectedOptions).map(opt => opt.value);
        
        // Pega as datas digitadas (Ex: 2026-05-10, 2026-05-12)
        const datasString = document.getElementById('task-datas').value;
        const listaDatas = datasString.split(',').map(d => d.trim()).filter(d => d !== "");
        
        const baseTarefa = {
            titulo: document.getElementById('task-titulo').value,
            responsaveis: selecionados.join(', '),
            status: document.getElementById('task-status').value,
            prioridade: document.getElementById('task-prioridade').value,
            descricao: document.getElementById('task-desc').value,
            criadoEm: new Date().getTime()
        };

        try {
            // Se tiver várias datas, salva um card para cada data
            if (listaDatas.length > 0) {
                for (let data of listaDatas) {
                    await addDoc(collection(db, "atividades"), { ...baseTarefa, datas: data });
                }
            } else {
                // Se não colocar data, salva normal
                await addDoc(collection(db, "atividades"), { ...baseTarefa, datas: '' });
            }
            fecharModal();
            taskForm.reset();
        } catch (error) {
            alert("Erro ao salvar! Veja as permissões do Firebase.");
        }
    });

    // INICIALIZAR OS DOIS CALENDÁRIOS (Geral e Individual)
    if (typeof FullCalendar !== 'undefined') {
        const configCalendario = {
            initialView: 'dayGridMonth', locale: 'pt-br',
            headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth' },
            editable: true, droppable: true,
            eventDrop: async function(info) {
                const taskId = info.event.id;
                const novaData = info.event.start.toISOString().split('T')[0]; 
                try { await updateDoc(doc(db, "atividades", taskId), { datas: novaData }); } 
                catch (error) { info.revert(); }
            }
        };

        const calGeralEl = document.getElementById('calendar-geral');
        if(calGeralEl) window.calendarioGeral = new FullCalendar.Calendar(calGeralEl, configCalendario);
        
        const calIndEl = document.getElementById('calendar-individual');
        if(calIndEl) window.calendarioIndividual = new FullCalendar.Calendar(calIndEl, configCalendario);
    }

    // LER TAREFAS, MONTAR KANBAN, CALENDÁRIOS E NOTIFICAÇÕES
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

        let eventosGerais = [];
        let pendentesCount = 0; // Contador de notificações

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Conta pendentes para a Bolinha Vermelha
            if (data.status === 'pendente') pendentesCount++;
            
            // Monta o Card do Trello
            const card = document.createElement('div');
            card.className = `kanban-card`;
            card.setAttribute('draggable', 'true');
            card.dataset.id = id; 
            card.innerHTML = `
                <div style="font-weight:bold; font-size:18px; margin-bottom:5px;">${data.titulo}</div>
                <div style="font-size:12px; font-family:sans-serif; color:#ccc;">Resp: ${data.responsaveis || 'Todos'}</div>
                <div style="font-size:10px; font-family:sans-serif; color:#aaa; margin-top:10px;">📅 ${data.datas || 'Sem data'}</div>
            `;
            
            card.addEventListener('dragstart', () => { card.classList.add('dragging'); card.style.opacity = '0.5'; });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
            
            if(kanbanColumns[data.status]) kanbanColumns[data.status].appendChild(card);

            // Prepara para os Calendários
            if (data.datas && data.datas !== '') {
                let corDoEvento = '#ff3366'; 
                if (data.status === 'analise') corDoEvento = '#ffaa00'; 
                if (data.status === 'concluido') corDoEvento = '#00ff88'; 

                eventosGerais.push({
                    id: id, title: data.titulo, start: data.datas,
                    backgroundColor: corDoEvento, borderColor: corDoEvento
                });
            }
        });

        // Atualiza a Notificação no Menu
        const badge = document.getElementById('badge-tarefas');
        if(badge) {
            badge.innerText = pendentesCount;
            badge.style.display = pendentesCount > 0 ? 'inline-block' : 'none';
        }

        // Atualiza os Calendários
        if (window.calendarioGeral) {
            window.calendarioGeral.removeAllEvents();
            window.calendarioGeral.addEventSource(eventosGerais);
        }
        if (window.calendarioIndividual) {
            window.calendarioIndividual.removeAllEvents();
            window.calendarioIndividual.addEventSource(eventosGerais); // Futuramente filtraremos só as do usuário logado
        }
    });

    // DRAG AND DROP DAS COLUNAS
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

});
