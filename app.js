import { db, auth, storage } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let usuarioLogado = null; 
let todasAtividades = {}; 

window.toggleIA = () => document.getElementById('ludotech-chat').classList.toggle('chat-hidden');
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';
window.abrirModal = () => { document.getElementById('task-id').value = ""; document.getElementById('task-form').reset(); document.getElementById('task-modal').style.display = 'flex'; };

window.editarTarefa = function(id) {
    const t = todasAtividades[id]; if(!t) return;
    document.getElementById('task-id').value = id; document.getElementById('task-titulo').value = t.titulo;
    document.getElementById('task-status').value = t.status; document.getElementById('task-prioridade').value = t.prioridade;
    document.getElementById('task-datas').value = t.datas || ''; document.getElementById('task-desc').value = t.descricao || '';
    document.getElementById('task-modal').style.display = 'flex';
};
window.mudarVisaoAgenda = (id) => {
    document.getElementById('visao-kanban').style.display = 'none'; document.getElementById('visao-calendario').style.display = 'none';
    document.getElementById('visao-' + id).style.display = 'block';
    if(id === 'calendario' && window.calendarioGeral) setTimeout(() => window.calendarioGeral.render(), 100);
};

document.addEventListener("DOMContentLoaded", async () => {
    
    setTimeout(() => { const s = document.getElementById('splash-screen'); if(s) { s.style.opacity='0'; setTimeout(()=>s.style.display='none', 800); } }, 2000);

    // 1. CARREGAR DESIGN DO PAINEL ADMIN
    async function aplicarConfiguracoes() {
        const confSnap = await getDoc(doc(db, 'configuracoes', 'geral'));
        if(confSnap.exists()) {
            const conf = confSnap.data();
            if(conf.corPrimaria) document.documentElement.style.setProperty('--accent', conf.corPrimaria);
            if(conf.logoMain) document.querySelectorAll('.img-logo-dinamica').forEach(img => img.src = conf.logoMain);
            if(conf.logoIA) document.querySelectorAll('.img-avatar-ia').forEach(img => img.src = conf.logoIA);
            if(conf.canva && document.getElementById('btn-link-canva')) document.getElementById('btn-link-canva').href = conf.canva;
            if(conf.insta && document.getElementById('btn-link-insta')) document.getElementById('btn-link-insta').href = conf.insta;
            
            document.getElementById('config-cor').value = conf.corPrimaria || "#6c5ce7";
            document.getElementById('config-canva').value = conf.canva || "";
            document.getElementById('config-insta').value = conf.insta || "";
        }
    }
    aplicarConfiguracoes();

    // 2. AUTENTICAÇÃO E PERMISSÕES (VERIFICA SE É ADMIN)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (docSnap.exists()) {
                usuarioLogado = { uid: user.uid, ...docSnap.data() };
                
                document.getElementById('saldo-vr').innerText = usuarioLogado.vr_saldo || "0,00";
                
                // Se for Admin, mostra as abas de Configurações e RH
                if(usuarioLogado.isAdmin) {
                    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
                }
            }
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            
            // MOSTRA A BOLINHA DA IA
            document.getElementById('ludotech-widget').style.display = 'block'; 
            
            carregarUsuariosNoSelect();
            if (window.calendarioIndividual) setTimeout(() => window.calendarioIndividual.render(), 500);
        }
    });

    document.getElementById('btn-entrar')?.addEventListener('click', async () => {
        const e = document.getElementById('email').value, s = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, e, s); } catch (err) { alert("Dados incorretos!"); }
    });
    document.getElementById('btn-sair')?.addEventListener('click', async () => { await signOut(auth); window.location.reload(); });

    // MENU
    const buttons = document.querySelectorAll(".menu-btn[data-target]");
    buttons.forEach(b => b.addEventListener("click", () => {
        const t = document.getElementById(b.getAttribute("data-target"));
        if(t) {
            buttons.forEach(x => x.classList.remove("active")); document.querySelectorAll(".tab-content").forEach(x => x.classList.remove("active"));
            b.classList.add("active"); t.classList.add("active");
            if(b.getAttribute("data-target") === 'planner' && window.calendarioIndividual) setTimeout(() => window.calendarioIndividual.render(), 100);
        }
    }));

    // 3. SAQUE VR E ATUALIZAÇÃO RH
    document.getElementById('btn-sacar-vr')?.addEventListener('click', async () => {
        if(!usuarioLogado || !usuarioLogado.vr_saldo || usuarioLogado.vr_saldo <= 0) return alert('Você não tem saldo disponível!');
        try {
            await updateDoc(doc(db, 'usuarios', usuarioLogado.uid), { vr_saldo: 0 });
            alert('Saque Gerado! Valor de R$' + usuarioLogado.vr_saldo + ' sacado.');
            document.getElementById('saldo-vr').innerText = '0,00';
            usuarioLogado.vr_saldo = 0;
            document.getElementById('card-vr').style.opacity = '0.5';
        } catch (e) { alert("Erro ao sacar."); }
    });

    document.getElementById('form-rh')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('rh-nome').value, email = document.getElementById('rh-email').value, senha = document.getElementById('rh-senha').value, vr = document.getElementById('rh-vr').value, isAdmin = document.getElementById('rh-is-admin').checked;
        try {
            const res = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, "usuarios", res.user.uid), { nome, email, vr_saldo: Number(vr), isAdmin, criadoEm: new Date().getTime() });
            alert("Criado com sucesso!"); document.getElementById('form-rh').reset(); carregarUsuariosNoSelect();
        } catch (err) { alert("Erro: " + err.message); }
    });

    document.getElementById('form-rh-update')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('rh-update-user').value;
        const vr = document.getElementById('rh-update-vr').value;
        if(!uid) return alert('Selecione um colaborador.');
        await updateDoc(doc(db, "usuarios", uid), { vr_saldo: Number(vr) });
        alert("Saldo atualizado!"); document.getElementById('form-rh-update').reset();
    });

    // 4. CONFIGURAÇÕES ADMIN (SALVAR LINKS E UPLOAD DE IMAGENS NO STORAGE)
    document.getElementById('btn-salvar-design')?.addEventListener('click', async () => {
        const cor = document.getElementById('config-cor').value, can = document.getElementById('config-canva').value, ins = document.getElementById('config-insta').value;
        await setDoc(doc(db, 'configuracoes', 'geral'), { corPrimaria: cor, canva: can, insta: ins }, { merge: true });
        alert('Configurações Salvas!'); aplicarConfiguracoes();
    });

    document.getElementById('btn-salvar-logos')?.addEventListener('click', async () => {
        const fMain = document.getElementById('upload-logo-main').files[0];
        const fIa = document.getElementById('upload-logo-ia').files[0];
        let d = {};
        if(fMain) { const r = ref(storage, 'logos/main'); await uploadBytes(r, fMain); d.logoMain = await getDownloadURL(r); }
        if(fIa) { const r = ref(storage, 'logos/ia'); await uploadBytes(r, fIa); d.logoIA = await getDownloadURL(r); }
        if(fMain || fIa) { await setDoc(doc(db, 'configuracoes', 'geral'), d, { merge: true }); alert('Logos salvas!'); aplicarConfiguracoes(); }
    });

    async function carregarUsuariosNoSelect() {
        const sel = document.getElementById('task-responsaveis'); const selUpdate = document.getElementById('rh-update-user');
        if(!sel) return;
        const qs = await getDocs(collection(db, "usuarios"));
        sel.innerHTML = ''; if(selUpdate) selUpdate.innerHTML = '<option value="" disabled selected>Selecione o Colaborador...</option>';
        qs.forEach((d) => {
            sel.innerHTML += `<option value="${d.data().nome}">${d.data().nome}</option>`;
            if(selUpdate) selUpdate.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`;
        });
    }

    // 5. ATIVIDADES, RESUMOS E QUEM CONCLUIU (LOGS)
    document.getElementById('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = document.getElementById('task-id').value;
        const sel = document.getElementById('task-responsaveis');
        const resp = Array.from(sel.selectedOptions).map(o => o.value).join(', ');
        const st = document.getElementById('task-status').value;
        
        let t = {
            titulo: document.getElementById('task-titulo').value, responsaveis: resp, status: st,
            prioridade: document.getElementById('task-prioridade').value, datas: document.getElementById('task-datas').value,
            descricao: document.getElementById('task-desc').value
        };

        if (idEdicao !== "") {
            if(st === 'concluido' && todasAtividades[idEdicao].status !== 'concluido') t.concluidoPor = usuarioLogado.nome;
            await updateDoc(doc(db, "atividades", idEdicao), t);
        } else {
            t.criadoEm = new Date().getTime();
            t.criadoPor = usuarioLogado ? usuarioLogado.nome : 'Sistema';
            if(st === 'concluido') t.concluidoPor = usuarioLogado.nome;
            await addDoc(collection(db, "atividades"), t);
        }
        fecharModal();
    });

    const cols = { 'pendente': document.getElementById('col-pendente'), 'analise': document.getElementById('col-analise'), 'concluido': document.getElementById('col-concluido') };
    onSnapshot(query(collection(db, "atividades"), orderBy("criadoEm", "desc")), (snap) => {
        if(cols.pendente) Object.values(cols).forEach(c => c.innerHTML = '');
        let evG = [], evI = [], cPend = 0, cAnd = 0, cConc = 0;
        
        snap.forEach((d) => {
            const data = d.data(); const id = d.id; todasAtividades[id] = data;
            
            if(data.status === 'pendente') cPend++;
            if(data.status === 'analise') cAnd++;
            if(data.status === 'concluido') cConc++;
            
            const c = document.createElement('div'); c.className = `kanban-card`; c.setAttribute('draggable', 'true'); c.dataset.id = id; 
            c.onclick = () => editarTarefa(id);
            let logText = `Criado por ${data.criadoPor || 'Desconhecido'}`;
            if(data.status === 'concluido') logText = `<span style="color:#00ff88">Concluído por ${data.concluidoPor || 'Desconhecido'}</span>`;
            
            c.innerHTML = `<div style="font-weight:bold; font-size:18px;">${data.titulo}</div><div style="font-size:12px; color:#ccc;">Resp: ${data.responsaveis || 'Todos'}</div><div class="task-log">${logText}</div>`;
            c.addEventListener('dragstart', () => { c.classList.add('dragging'); c.style.opacity = '0.5'; });
            c.addEventListener('dragend', () => { c.classList.remove('dragging'); c.style.opacity = '1'; });
            if(cols[data.status]) cols[data.status].appendChild(c);

            if (data.datas && data.datas !== '') {
                let cor = data.status === 'analise' ? '#ffaa00' : (data.status === 'concluido' ? '#00ff88' : '#ff3366');
                let ev = { id, title: data.titulo, start: data.datas, backgroundColor: cor, borderColor: cor };
                evG.push(ev);
                
                // O PLANNER INDIVIDUAL SÓ MOSTRA O QUE É DO USUÁRIO LOGADO
                if(usuarioLogado && data.responsaveis.includes(usuarioLogado.nome)) evI.push(ev);
            }
        });

        if(document.getElementById('resumo-pendentes')) {
            document.getElementById('resumo-pendentes').innerText = cPend;
            document.getElementById('resumo-andamento').innerText = cAnd;
            document.getElementById('resumo-concluidas').innerText = cConc;
        }
        
        const badge = document.getElementById('badge-tarefas');
        if(badge) { badge.innerText = cPend; badge.style.display = cPend > 0 ? 'inline-block' : 'none'; }
        if (window.calendarioGeral) { window.calendarioGeral.removeAllEvents(); window.calendarioGeral.addEventSource(evG); }
        if (window.calendarioIndividual) { window.calendarioIndividual.removeAllEvents(); window.calendarioIndividual.addEventSource(evI); }
    });

    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); const c = col.querySelector('.cards-container'); const d = document.querySelector('.dragging'); if (d && c) c.appendChild(d); });
        col.addEventListener('drop', async (e) => {
            const d = document.querySelector('.dragging');
            if(d) {
                let s = 'pendente'; if (col.id === 'coluna-amarela') s = 'analise'; if (col.id === 'coluna-verde') s = 'concluido';
                let act = { status: s };
                if (s === 'concluido') act.concluidoPor = usuarioLogado.nome;
                try { await updateDoc(doc(db, "atividades", d.dataset.id), act); } catch (err) {}
            }
        });
    });

    // 6. CHATBOT IA GROQ
    document.getElementById('send-ia')?.addEventListener('click', async () => {
        const inp = document.getElementById('chat-input'), cb = document.getElementById('chat-messages'), m = inp.value;
        if(!m) return;
        cb.innerHTML += `<div class="msg-user">${m}</div>`; inp.value = "";
        cb.innerHTML += `<div class="msg-ia" id="loading-ia">Pensando...</div>`; cb.scrollTop = cb.scrollHeight;

        const API_KEY = "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"; // Cole a chave gsk_ aqui

        try {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` }, body: JSON.stringify({ model: "llama3-70b-8192", messages: [{ role: "system", content: "Você é a LudoTech." }, { role: "user", content: m }] }) });
            const d = await r.json(); document.getElementById('loading-ia').remove();
            cb.innerHTML += `<div class="msg-ia">${d.choices[0].message.content.replace(/\n/g, '<br>')}</div>`; cb.scrollTop = cb.scrollHeight;
        } catch(e) { document.getElementById('loading-ia').remove(); cb.innerHTML += `<div class="msg-ia" style="color:red;">Erro de conexão IA.</div>`; }
    });

    // 7. INICIALIZAR CALENDÁRIOS E LUDOPLAY
    if (typeof FullCalendar !== 'undefined') {
        const cfg = { initialView: 'dayGridMonth', locale: 'pt-br', headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth' }, editable: true, droppable: true, eventClick: (info) => editarTarefa(info.event.id), eventDrop: async (info) => { try { await updateDoc(doc(db, "atividades", info.event.id), { datas: info.event.start.toISOString().split('T')[0] }); } catch (err) { info.revert(); } } };
        if(document.getElementById('calendar-geral')) window.calendarioGeral = new FullCalendar.Calendar(document.getElementById('calendar-geral'), cfg);
        if(document.getElementById('calendar-individual')) window.calendarioIndividual = new FullCalendar.Calendar(document.getElementById('calendar-individual'), cfg);
    }

    if (typeof Swiper !== 'undefined') { new Swiper(".swiper", { effect: "coverflow", grabCursor: true, centeredSlides: true, loop: true, speed: 600, slidesPerView: "auto", coverflowEffect: { rotate: 10, stretch: 120, depth: 200, modifier: 1, slideShadows: false } }); }
    const s = document.getElementById("song"), pb = document.querySelector(".play-pause-btn"), ci = document.getElementById("controlIcon"); let pl = false;
    if(pb && s) { pb.addEventListener("click", () => { if(!pl) { s.play(); pl=true; ci.classList.replace("fa-play", "fa-pause"); } else { s.pause(); pl=false; ci.classList.replace("fa-pause", "fa-play"); } }); }
});
