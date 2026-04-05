import { db, auth, storage, secondaryAuth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let userLogged = null;
let currentColabId = null;
let todasAtividades = {};
let notificacoesEnviadas = false;

window.toggleMenu = () => document.getElementById('sidebar').classList.toggle('open');
window.toggleIA = () => {
    const chat = document.getElementById('ludotech-chat');
    chat.classList.contains('chat-hidden') ? (chat.classList.remove('chat-hidden'), chat.classList.add('chat-active')) : (chat.classList.remove('chat-active'), chat.classList.add('chat-hidden'));
};

window.showToast = (msg, bg = "var(--accent)") => {
    const t = document.getElementById('toast-container');
    t.innerHTML = `<span class="material-icons">info</span> ${msg}`;
    t.style.background = bg;
    t.classList.remove('toast-hidden');
    setTimeout(() => t.classList.add('toast-hidden'), 4000);
};

window.abrirModal = (dataStr = '') => { 
    document.getElementById('task-id').value = ""; 
    document.getElementById('task-form').reset(); 
    if(dataStr) document.getElementById('task-datas').value = dataStr;
    const btnDel = document.getElementById('btn-excluir-tarefa');
    if(btnDel) btnDel.style.display = 'none';
    document.getElementById('task-modal').style.display = 'flex'; 
};
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';
window.fecharModalRH = () => document.getElementById('modal-colaborador').style.display = 'none';

window.abrirAnexo = (link) => {
    const iframe = document.getElementById('iframe-anexo');
    const btnAba = document.getElementById('btn-nova-aba');
    let embedLink = link;
    if(link.includes('drive.google.com/file/d/')) embedLink = link.replace(/\/view.*$/, '/preview');
    iframe.src = embedLink; btnAba.href = link;
    document.getElementById('modal-anexo').style.display = 'flex';
};

window.editarTarefa = function(id) {
    const t = todasAtividades[id]; if(!t) return;
    document.getElementById('task-id').value = id; 
    document.getElementById('task-titulo').value = t.titulo;
    document.getElementById('task-status').value = t.status; 
    document.getElementById('task-prioridade').value = t.prioridade;
    document.getElementById('task-datas').value = t.datas || ''; 
    document.getElementById('task-link').value = t.link || ''; 
    document.getElementById('task-desc').value = t.descricao || '';
    
    const btnDel = document.getElementById('btn-excluir-tarefa');
    if(btnDel) {
        btnDel.style.display = 'inline-block';
        btnDel.onclick = async () => { if(confirm("Deseja excluir esta tarefa?")) { await deleteDoc(doc(db, "atividades", id)); fecharModal(); showToast("Tarefa excluída."); } };
    }
    document.getElementById('task-modal').style.display = 'flex';
};

window.mudarVisaoAgenda = (v) => {
    document.querySelectorAll('.agenda-view').forEach(el => el.style.display = 'none');
    document.getElementById('visao-' + v).style.display = 'block';
    if(v === 'calendario' && window.calendarioGeral) setTimeout(() => window.calendarioGeral.render(), 100);
};

async function carregarLogos() {
    try {
        const snap = await getDoc(doc(db, 'config', 'visual'));
        if(snap.exists()) {
            const d = snap.data();
            if(d.logoIntro) document.getElementById('logo-intro').src = d.logoIntro;
            if(d.logoLogin) document.getElementById('logo-login').src = d.logoLogin;
            if(d.logoMenu) { document.getElementById('logo-menu').src = d.logoMenu; document.querySelector('.mobile-logo').src = d.logoMenu; }
            if(d.logoIA) { 
                document.getElementById('ludotech-btn-img').src = d.logoIA; 
                document.getElementById('ludotech-btn-img').style.display = 'block'; 
                document.getElementById('ludotech-btn-icon').style.display = 'none';
                document.getElementById('chat-header-img').src = d.logoIA; 
            }
            if(d.logoPWA) {
                const manifest = { name: "LudoMKT", short_name: "LudoMKT", start_url: "./index.html", display: "standalone", background_color: "#0a0c10", theme_color: "#6c5ce7", icons: [{ src: d.logoPWA, sizes: "512x512", type: "image/png" }] };
                const blob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
                document.getElementById('pwa-manifest').href = URL.createObjectURL(blob);
                document.getElementById('pwa-apple-icon').href = d.logoPWA;
            }
        }
    } catch(e) {}
}

function aplicarPermissoes(permissoes) {
    const nav = document.getElementById('main-nav');
    const links = { home: { icon: 'home', label: 'Início' }, agenda: { icon: 'view_kanban', label: 'Agenda Geral' }, planner: { icon: 'event_note', label: 'Meu Planner' }, music: { icon: 'headphones', label: 'LudoMusic' }, rh: { icon: 'groups', label: 'Gestão de RH' }, admin: { icon: 'settings', label: 'Configurações' } };
    if(!nav) return; nav.innerHTML = "";
    Object.keys(links).forEach(key => {
        if(!permissoes || permissoes[key] !== false) { 
            const btn = document.createElement('button'); btn.className = "menu-btn"; if(key === 'home') btn.classList.add('active');
            btn.dataset.target = key; btn.innerHTML = `<span class="material-icons">${links[key].icon}</span> ${links[key].label}`;
            btn.onclick = () => {
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.getElementById(key).classList.add('active');
                document.getElementById('sidebar').classList.remove('open');
                if(key === 'planner' && window.calendarioIndividual) setTimeout(() => window.calendarioIndividual.render(), 100);
            };
            nav.appendChild(btn);
        }
    });
}

async function carregarColaboradores() {
    const sel = document.getElementById('task-responsaveis');
    const container = document.getElementById('lista-colaboradores-cards');
    if(sel) sel.innerHTML = ""; if(container) container.innerHTML = "";
    const today = new Date(); const todayM = today.getMonth(); const todayD = today.getDate();

    try {
        const qs = await getDocs(collection(db, "usuarios"));
        qs.forEach(d => {
            const u = d.data();
            if(sel) sel.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
            if(container) {
                let isBday = false; let isVet = false;
                if(u.nascimento) { const b = new Date(u.nascimento + "T12:00:00Z"); if(b.getDate() === todayD && b.getMonth() === todayM) isBday = true; }
                if(u.entrada) { const h = new Date(u.entrada + "T12:00:00Z"); const diff = Math.ceil(Math.abs(today - h) / (1000 * 60 * 60 * 24)); if(diff >= 365) isVet = true; }
                if(isBday && !notificacoesEnviadas) showToast(`🎉 Hoje é aniversário de ${u.nome}!`);

                const card = document.createElement('div');
                card.className = `colab-card ${isVet ? 'veterano' : ''} ${isBday ? 'aniversariante' : ''}`;
                card.innerHTML = `${isBday ? '<div style="font-size:24px;">🎂</div>' : ''}<strong>${u.nome}</strong><br><small style="color:var(--text-muted);">${u.cargo || 'Membro'}</small>`;
                card.onclick = () => abrirPastaColaborador(d.id, u);
                container.appendChild(card);
            }
        });
        notificacoesEnviadas = true;
    } catch(e) {}
}

window.abrirPastaColaborador = async (id, data) => {
    currentColabId = id; document.getElementById('modal-rh-nome').innerText = "Ficha: " + data.nome;
    const btnExcluir = document.getElementById('btn-excluir-colaborador');
    if(btnExcluir) {
        btnExcluir.onclick = async () => {
            if(confirm("ATENÇÃO: Deseja EXCLUIR este colaborador do sistema? Isso não pode ser desfeito.")) {
                await deleteDoc(doc(db, "usuarios", id)); fecharModalRH(); carregarColaboradores(); showToast("Colaborador removido.");
            }
        };
    }
    document.getElementById('modal-colaborador').style.display = 'flex';
    monitorarHistorico(id);
};

function monitorarHistorico(id) {
    onSnapshot(query(collection(db, `usuarios/${id}/historico`), orderBy("data", "desc")), (snap) => {
        const list = document.getElementById('historico-rh-lista'); if(!list) return; list.innerHTML = "";
        snap.forEach(d => {
            const ev = d.data();
            list.innerHTML += `<div class="history-item"><div><strong style="color:var(--accent);">${ev.tipo}</strong><br><small style="color:#ccc;">${ev.desc}</small></div><div style="text-align:right;"><small style="color:#777;">${new Date(ev.data).toLocaleDateString()}</small></div></div>`;
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => { const s = document.getElementById('splash-screen'); if(s) { s.style.opacity = '0'; setTimeout(()=> s.style.display='none', 800); } }, 2000);
    carregarLogos();

    const btnEntrar = document.getElementById('btn-entrar');
    if (btnEntrar) {
        btnEntrar.addEventListener('click', async (e) => {
            e.preventDefault(); const email = document.getElementById('email').value; const senha = document.getElementById('password').value;
            if(!email || !senha) return showToast("Preencha e-mail e senha.", "#ff3366");
            try { btnEntrar.innerText = "Aguarde..."; await signInWithEmailAndPassword(auth, email, senha); } 
            catch (err) { btnEntrar.innerText = "Acessar Sistema"; showToast("Erro: " + err.message, "#ff3366"); }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            try {
                const d = await getDoc(doc(db, "usuarios", user.uid));
                let data = d.exists() ? d.data() : { nome: "Gestão", isAdmin: true, permissoes: { home: true, agenda: true, planner: true, music: true, rh: true, admin: true } };
                userLogged = { uid: user.uid, ...data }; aplicarPermissoes(data.permissoes);
                document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-container').style.display = 'flex'; document.getElementById('ludotech-widget').style.display = 'block'; 
                carregarColaboradores();
                if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') Notification.requestPermission();
                const conf = await getDoc(doc(db, 'config', 'music')); if(conf.exists() && document.getElementById('spotify-iframe')) document.getElementById('spotify-iframe').src = conf.data().url;
            } catch(e) {}
        }
    });

    const btnSair = document.getElementById('btn-sair'); if(btnSair) { btnSair.addEventListener('click', async () => { await signOut(auth); window.location.reload(); }); }

    // CADASTRO COLABORADOR - COM AVISO DE DUPLICIDADE
    document.getElementById('form-rh-completo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const permissoes = {}; document.querySelectorAll('#permissoes-cadastro input').forEach(i => permissoes[i.value] = i.checked);
        try {
            const res = await createUserWithEmailAndPassword(secondaryAuth, document.getElementById('rh-email').value, document.getElementById('rh-senha').value);
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: document.getElementById('rh-nome').value, cargo: document.getElementById('rh-cargo').value,
                email: document.getElementById('rh-email').value, nascimento: document.getElementById('rh-nascimento').value,
                entrada: document.getElementById('rh-entrada').value, permissoes: permissoes, criadoEm: new Date().getTime()
            });
            await signOut(secondaryAuth); showToast("Colaborador cadastrado!", "#00ff88"); e.target.reset(); carregarColaboradores();
        } catch(err) { 
            if(err.code === 'auth/email-already-in-use') {
                showToast("Erro: Este e-mail já está em uso por outro funcionário!", "#ff3366");
            } else {
                showToast("Erro: " + err.message, "#ff3366"); 
            }
        }
    });

    document.getElementById('btn-lancar-rh')?.addEventListener('click', async () => {
        const ev = { tipo: document.getElementById('rh-tipo-evento').value, desc: document.getElementById('rh-desc-evento').value, data: new Date().getTime() };
        await addDoc(collection(db, `usuarios/${currentColabId}/historico`), ev);
        showToast("Registro salvo na ficha!", "#00ff88"); document.getElementById('rh-desc-evento').value = "";
    });

    document.getElementById('btn-save-logos')?.addEventListener('click', async (e) => {
        const btn = e.target; const origTxt = btn.innerText; btn.innerText = "Salvando..."; btn.style.opacity = "0.7";
        const files = { logoIntro: document.getElementById('up-logo-intro').files[0], logoLogin: document.getElementById('up-logo-login').files[0], logoMenu: document.getElementById('up-logo-menu').files[0], logoPWA: document.getElementById('up-logo-pwa').files[0], logoIA: document.getElementById('up-logo-ia').files[0] };
        const urls = {};
        try {
            for(let key in files) { if(files[key]) { const r = ref(storage, `config/${key}`); await uploadBytes(r, files[key]); urls[key] = await getDownloadURL(r); } }
            if(Object.keys(urls).length > 0) { await setDoc(doc(db, 'config', 'visual'), urls, {merge:true}); carregarLogos(); }
            btn.style.opacity = "1"; btn.style.background = "#00ff88"; btn.style.color = "#000"; btn.innerText = "Salvo com Sucesso!";
            setTimeout(() => { btn.style.background = ""; btn.style.color = ""; btn.innerText = origTxt; }, 3000);
        } catch(err) { btn.innerText = origTxt; btn.style.opacity = "1"; showToast("Erro ao salvar", "#ff3366"); }
    });

    document.getElementById('btn-save-spotify')?.addEventListener('click', async () => {
        const url = document.getElementById('config-spotify-url').value; const embedUrl = url.replace(/\/playlist\//, '/embed/playlist/');
        await setDoc(doc(db, 'config', 'music'), { url: embedUrl }); showToast("Spotify atualizado!", "#00ff88");
        const iframe = document.getElementById('spotify-iframe'); if(iframe) iframe.src = embedUrl;
    });

    document.getElementById('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = document.getElementById('task-id').value;
        const sel = document.getElementById('task-responsaveis'); const resp = Array.from(sel.selectedOptions).map(o => o.value).join(', ');
        const st = document.getElementById('task-status').value;
        
        const datasArr = document.getElementById('task-datas').value.split(',').map(d => d.trim()).filter(d => d);
        if (datasArr.length === 0) datasArr.push('');

        let t = { titulo: document.getElementById('task-titulo').value, responsaveis: resp, status: st, prioridade: document.getElementById('task-prioridade').value, descricao: document.getElementById('task-desc').value, link: document.getElementById('task-link').value };

        if (idEdicao !== "") {
            t.datas = datasArr.join(', ');
            if(st === 'concluido' && todasAtividades[idEdicao].status !== 'concluido') t.concluidoPor = userLogged.nome;
            await updateDoc(doc(db, "atividades", idEdicao), t); showToast("Atualizado!", "#00ff88");
        } else {
            t.criadoEm = new Date().getTime(); t.criadoPor = userLogged ? userLogged.nome : 'Sistema';
            if(st === 'concluido') t.concluidoPor = userLogged.nome;
            t.datas = datasArr.join(', ');
            await addDoc(collection(db, "atividades"), t); showToast("Criado!", "#00ff88");
        }
        fecharModal();
    });

    const cols = { 'pendente': document.getElementById('col-pendente'), 'analise': document.getElementById('col-analise'), 'concluido': document.getElementById('col-concluido') };
    onSnapshot(query(collection(db, "atividades"), orderBy("criadoEm", "desc")), (snap) => {
        if(cols.pendente) Object.values(cols).forEach(c => c.innerHTML = '');
        let evG = [], evI = [], cPend = 0, cAnd = 0, cConc = 0;
        const hojeStr = new Date().toISOString().split('T')[0];
        
        snap.forEach((d) => {
            const data = d.data(); const id = d.id; todasAtividades[id] = data;
            if(data.status === 'pendente') cPend++; if(data.status === 'analise') cAnd++; if(data.status === 'concluido') cConc++;
            
            const datesArray = data.datas ? data.datas.split(',').map(dt=>dt.trim()).filter(dt=>dt) : [];
            const isForToday = datesArray.length === 0 || datesArray.includes(hojeStr) || (data.status !== 'concluido' && datesArray.some(dt => dt < hojeStr));

            if(isForToday) {
                const c = document.createElement('div'); c.className = `kanban-card`; c.setAttribute('draggable', 'true'); c.dataset.id = id; 
                c.onclick = () => editarTarefa(id);
                let logText = `Por ${data.criadoPor || '...'}`; if(data.status === 'concluido') logText = `<span style="color:#00ff88">Feito por ${data.concluidoPor || '...'}</span>`;
                
                c.innerHTML = `<div style="font-weight:bold; font-size:16px;">${data.titulo}</div><div style="font-size:12px; color:#ccc;">${data.responsaveis || 'Todos'}</div><div style="font-size:10px; color:#ffaa00; margin-top:5px;">📅 ${data.datas || 'S/ Data'}</div>
                ${data.link ? `<button onclick="event.stopPropagation(); abrirAnexo('${data.link}')" class="btn-secundary" style="margin-top:10px; font-size:11px; padding:5px; border-color:var(--accent); color:var(--accent);">📎 Ver Anexo</button>` : ''}
                <div class="task-log">${logText}</div>`;
                c.addEventListener('dragstart', () => { c.classList.add('dragging'); c.style.opacity = '0.5'; });
                c.addEventListener('dragend', () => { c.classList.remove('dragging'); c.style.opacity = '1'; });
                if(cols[data.status]) cols[data.status].appendChild(c);
            }

            if (datesArray.length > 0) {
                let cor = data.status === 'analise' ? '#ffaa00' : (data.status === 'concluido' ? '#00ff88' : '#ff3366');
                datesArray.forEach(dt => {
                    let ev = { id, title: data.titulo, start: dt, backgroundColor: cor, borderColor: cor };
                    evG.push(ev); if(userLogged && data.responsaveis.includes(userLogged.nome)) evI.push(ev);
                });
            }
        });

        if(document.getElementById('resumo-pendentes')) {
            document.getElementById('resumo-pendentes').innerText = cPend; document.getElementById('resumo-andamento').innerText = cAnd; document.getElementById('resumo-concluidas').innerText = cConc;
        }
        if (window.calendarioGeral) { window.calendarioGeral.removeAllEvents(); window.calendarioGeral.addEventSource(evG); }
        if (window.calendarioIndividual) { window.calendarioIndividual.removeAllEvents(); window.calendarioIndividual.addEventSource(evI); }
    });

    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); const c = col.querySelector('.cards-container'); const d = document.querySelector('.dragging'); if (d && c) c.appendChild(d); });
        col.addEventListener('drop', async (e) => {
            const d = document.querySelector('.dragging');
            if(d) {
                let s = 'pendente'; if (col.id === 'coluna-amarela') s = 'analise'; if (col.id === 'coluna-verde') s = 'concluido';
                let act = { status: s }; if (s === 'concluido') act.concluidoPor = userLogged.nome;
                try { await updateDoc(doc(db, "atividades", d.dataset.id), act); } catch (err) {}
            }
        });
    });

    // ==========================================
    // CHATBOT GROQ (VERSÃO BLINDADA)
    // ==========================================
    document.getElementById('send-ia')?.addEventListener('click', async () => {
        const inp = document.getElementById('chat-input');
        const cb = document.getElementById('chat-messages');
        const m = inp.value.trim();
        
        if(!m) return;
        
        cb.innerHTML += `<div class="msg-user">${m}</div>`; 
        inp.value = "";

        // ⚠️ COLOQUE SUA CHAVE AQUI DENTRO DAS ASPAS:
        const API_KEY = "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"; 

        if (!API_KEY.startsWith("gsk_")) {
            return showToast("⚠️ A Chave da IA no código está inválida!", "#ff3366");
        }
        
        const loadingId = 'loading-' + Date.now();
        cb.innerHTML += `<div class="msg-ia" id="${loadingId}">Processando...</div>`; 
        cb.scrollTop = cb.scrollHeight;

        try {
            console.log("Enviando pergunta para a IA...");
            const respostaRaw = await fetch('https://api.groq.com/openai/v1/chat/completions', { 
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${API_KEY}` 
                }, 
                body: JSON.stringify({ 
                    "model": "llama-3.1-8b-instant", 
                    "messages": [
                        { "role": "system", "content": "Você é a LudoTech, a Inteligência Artificial corporativa da agência LudoMKT. Responda de forma clara, amigável e em português do Brasil." }, 
                        { "role": "user", "content": m }
                    ] 
                }) 
            });
            
            const d = await respostaRaw.json(); 
            console.log("Resposta da Groq:", d); // Para rastrearmos erros ocultos!
            
            if (!respostaRaw.ok) {
                throw new Error(d.error?.message || "Erro desconhecido na API.");
            }

            document.getElementById(loadingId)?.remove();
            cb.innerHTML += `<div class="msg-ia">${d.choices[0].message.content.replace(/\n/g, '<br>')}</div>`; 
            cb.scrollTop = cb.scrollHeight;
            
        } catch(e) { 
            console.error("Erro da IA:", e);
            document.getElementById(loadingId)?.remove();
            cb.innerHTML += `<div class="msg-ia" style="color:#ff3366; font-size:12px;">Erro: ${e.message}</div>`; 
            cb.scrollTop = cb.scrollHeight;
        }
    });
