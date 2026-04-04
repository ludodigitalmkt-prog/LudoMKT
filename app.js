import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let usuarioLogado = null; 
let todasAtividades = {}; 

window.toggleIA = function() {
    const chat = document.getElementById('ludotech-chat');
    if (chat) chat.classList.toggle('chat-hidden');
};

window.abrirModal = () => {
    document.getElementById('task-id').value = ""; 
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

    // ===============================================
    // A MÁGICA DO LOGIN: MOSTRAR A IA (CORRIGIDO)
    // ===============================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (docSnap.exists()) {
                usuarioLogado = docSnap.data();
                const saldoEl = document.getElementById('saldo-vr');
                if(saldoEl) saldoEl.innerText = usuarioLogado.vr_saldo || "0,00";
            }
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            
            // AQUI FAZ A BOLINHA DA IA APARECER:
            document.getElementById('ludotech-widget').style.display = 'block'; 
            
            carregarUsuariosNoSelect();
        }
    });

    document.getElementById('btn-entrar')?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, email, senha); } 
        catch (error) { alert("E-mail ou senha incorretos!"); }
    });

    document.getElementById('btn-sair')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.reload(); 
    });

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

    document.getElementById('form-rh')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('rh-nome').value;
        const email = document.getElementById('rh-email').value;
        const senha = document.getElementById('rh-senha').value;
        const vr = document.getElementById('rh-vr').value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, "usuarios", userCredential.user.uid), { nome, email, vr_saldo: vr, criadoEm: new Date().getTime() });
            alert("Colaborador salvo com sucesso!");
            document.getElementById('form-rh').reset();
            carregarUsuariosNoSelect();
        } catch (error) { alert("Erro: " + error.message); }
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
            if (idEdicao !== "") await updateDoc(doc(db, "atividades", idEdicao), baseTarefa);
            else {
                baseTarefa.criadoEm = new Date().getTime();
                await addDoc(collection(db, "atividades"), baseTarefa);
            }
            fecharModal();
        } catch (error) { alert("Aviso: Falha ao salvar (Regras de permissão do Firebase podem estar bloqueando)."); }
    });

    // ===============================================
    // IA GROQ COM LLAMA 3
    // ===============================================
    const btnSendIa = document.getElementById('send-ia');
    btnSendIa?.addEventListener('click', async () => {
        const input = document.getElementById('chat-input');
        const chatBody = document.getElementById('chat-messages');
        const msgUser = input.value;
        if(msgUser === "") return;

        chatBody.innerHTML += `<div class="msg-user">${msgUser}</div>`;
        input.value = "";
        chatBody.innerHTML += `<div class="msg-ia" id="loading-ia">Pensando...</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;

        const API_KEY = "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"; 

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "llama3-70b-8192", 
                    messages: [
                        { role: "system", content: "Você é a LudoTech, uma assistente de marketing. Ajude com ideias criativas." },
                        { role: "user", content: msgUser }
                    ]
                })
            });
            const data = await response.json();
            document.getElementById('loading-ia').remove();
            chatBody.innerHTML += `<div class="msg-ia">${data.choices[0].message.content.replace(/\n/g, '<br>')}</div>`;
            chatBody.scrollTop = chatBody.scrollHeight;
        } catch(error) {
            document.getElementById('loading-ia').remove();
            chatBody.innerHTML += `<div class="msg-ia" style="color: #ff3366;">Erro ao conectar com a IA.</div>`;
        }
    });

    if (typeof FullCalendar !== 'undefined') {
        const configCal = {
            initialView: 'dayGridMonth', locale: 'pt-br',
            headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth' },
            editable: true, droppable: true,
            eventClick: function(info) { editarTarefa(info.event.id); },
            eventDrop: async function(info) {
                try { await updateDoc(doc(db, "atividades", info.event.id), { datas: info.event.start.toISOString().split('T')[0] }); } 
                catch (error) { info.revert(); }
            }
        };
        const calGeralEl = document.getElementById('calendar-geral');
        if(calGeralEl) window.calendarioGeral = new FullCalendar.Calendar(calGeralEl, configCal);
        const calIndEl = document.getElementById('calendar-individual');
        if(calIndEl) window.calendarioIndividual = new FullCalendar.Calendar(calIndEl, configCal);
    }

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
            todasAtividades[id] = data; 
            
            if (data.status === 'pendente') pendentesCount++;
            
            const card = document.createElement('div');
            card.className = `kanban-card`;
            card.setAttribute('draggable', 'true');
            card.dataset.id = id; 
            card.onclick = () => editarTarefa(id); 
            card.innerHTML = `<div style="font-weight:bold; font-size:18px;">${data.titulo}</div><div style="font-size:12px; color:#ccc;">Resp: ${data.responsaveis || 'Todos'}</div>`;
            
            card.addEventListener('dragstart', () => { card.classList.add('dragging'); card.style.opacity = '0.5'; });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
            
            if(kanbanColumns[data.status]) kanbanColumns[data.status].appendChild(card);

            if (data.datas && data.datas !== '') {
                let corDoEvento = data.status === 'analise' ? '#ffaa00' : (data.status === 'concluido' ? '#00ff88' : '#ff3366');
                const eventoData = { id: id, title: data.titulo, start: data.datas, backgroundColor: corDoEvento, borderColor: corDoEvento };
                
                eventosGerais.push(eventoData);
                if(usuarioLogado && data.responsaveis.includes(usuarioLogado.nome)) eventosIndividuais.push(eventoData);
            }
        });

        const badge = document.getElementById('badge-tarefas');
        if(badge) { badge.innerText = pendentesCount; badge.style.display = pendentesCount > 0 ? 'inline-block' : 'none'; }

        if (window.calendarioGeral) { window.calendarioGeral.removeAllEvents(); window.calendarioGeral.addEventSource(eventosGerais); }
        if (window.calendarioIndividual) { window.calendarioIndividual.removeAllEvents(); window.calendarioIndividual.addEventSource(eventosIndividuais); }
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
                try { await updateDoc(doc(db, "atividades", draggable.dataset.id), { status: novoStatus }); } catch (error) {}
            }
        });
    });

    // ===============================================
    // LÓGICA DO LUDOPLAY (SLIDERS E MÚSICA)
    // ===============================================
    if (typeof Swiper !== 'undefined') {
        new Swiper(".swiper", {
            effect: "coverflow", grabCursor: true, centeredSlides: true, loop: true, speed: 600, slidesPerView: "auto",
            coverflowEffect: { rotate: 10, stretch: 120, depth: 200, modifier: 1, slideShadows: false }
        });
    }

    const song = document.getElementById("song");
    const playBtn = document.querySelector(".play-pause-btn");
    const controlIcon = document.getElementById("controlIcon");
    const progress = document.getElementById("progress");
    const rotImg = document.getElementById("rotatingImage");
    let isPlaying = false;
    let rotation = 0;
    let rotInterval;

    if(playBtn && song) {
        playBtn.addEventListener("click", () => {
            if(!isPlaying) {
                song.play(); isPlaying = true;
                controlIcon.classList.replace("fa-play", "fa-pause");
                rotInterval = setInterval(() => { rotation += 2; rotImg.style.transform = `rotate(${rotation}deg)`; }, 50);
            } else {
                song.pause(); isPlaying = false;
                controlIcon.classList.replace("fa-pause", "fa-play");
                clearInterval(rotInterval);
            }
        });
        song.addEventListener("timeupdate", () => { if(progress) progress.value = (song.currentTime / song.duration) * 100 || 0; });
        progress?.addEventListener("input", (e) => { song.currentTime = (e.target.value / 100) * song.duration; });
    }

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.log(e));
});
