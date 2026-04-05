import { db, auth, storage, secondaryAuth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ESTADO GLOBAL
let userLogged = null;
let currentColabId = null;
let todasAtividades = {};
let tarefasPendentesAnterior = -1; // Variável para o sistema de notificações

// REGISTRAR O APP (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(() => {
            console.log('App LudoMKT pronto para instalação!');
        });
    });
}

// --- FUNÇÕES DE INTERFACE ---
window.toggleIA = () => {
    const chat = document.getElementById('ludotech-chat');
    if (chat.classList.contains('chat-hidden')) { chat.classList.remove('chat-hidden'); chat.classList.add('chat-active'); } 
    else { chat.classList.remove('chat-active'); chat.classList.add('chat-hidden'); }
};
window.toggleMenu = () => {
    document.getElementById('sidebar').classList.toggle('open');
};

window.abrirModal = () => { 
    document.getElementById('task-id').value = ""; 
    document.getElementById('task-form').reset(); 
    const btnDel = document.getElementById('btn-excluir-tarefa');
    if(btnDel) btnDel.style.display = 'none';
    document.getElementById('task-modal').style.display = 'flex'; 
};
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';
window.fecharModalRH = () => document.getElementById('modal-colaborador').style.display = 'none';

window.editarTarefa = function(id) {
    const t = todasAtividades[id]; if(!t) return;
    document.getElementById('task-id').value = id; 
    document.getElementById('task-titulo').value = t.titulo;
    document.getElementById('task-status').value = t.status; 
    document.getElementById('task-prioridade').value = t.prioridade;
    document.getElementById('task-datas').value = t.datas || ''; 
    document.getElementById('task-desc').value = t.descricao || '';
    
    const btnDel = document.getElementById('btn-excluir-tarefa');
    if(btnDel) {
        btnDel.style.display = 'inline-block';
        btnDel.onclick = async () => {
            if(confirm("Tem certeza que deseja excluir esta tarefa?")) {
                await deleteDoc(doc(db, "atividades", id));
                fecharModal();
            }
        };
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
            if(d.logoMenu) document.getElementById('logo-menu').src = d.logoMenu;
        }
    } catch(e) {}
}

function aplicarPermissoes(permissoes) {
    const nav = document.getElementById('main-nav');
    const links = {
        home: { icon: 'home', label: 'Início' },
        agenda: { icon: 'view_kanban', label: 'Agenda Geral' },
        planner: { icon: 'event_note', label: 'Meu Planner' },
        beneficios: { icon: 'star', label: 'Benefícios' },
        music: { icon: 'headphones', label: 'LudoMusic' },
        rh: { icon: 'groups', label: 'Portal RH' },
        admin: { icon: 'settings', label: 'Configurações' }
    };

    if(!nav) return;
    nav.innerHTML = "";
    Object.keys(links).forEach(key => {
        if(!permissoes || permissoes[key] !== false) { 
            const btn = document.createElement('button');
            btn.className = "menu-btn";
            if(key === 'home') btn.classList.add('active');
            btn.dataset.target = key;
            btn.innerHTML = `<span class="material-icons">${links[key].icon}</span> ${links[key].label}`;
            btn.onclick = () => {
                document.getElementById('sidebar').classList.remove('open');
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(key).classList.add('active');
                if(key === 'planner' && window.calendarioIndividual) setTimeout(() => window.calendarioIndividual.render(), 100);
            };
            nav.appendChild(btn);
        }
    });
}

async function carregarColaboradores() {
    const sel = document.getElementById('task-responsaveis');
    const container = document.getElementById('lista-colaboradores-cards');
    if(sel) sel.innerHTML = "";
    if(container) container.innerHTML = "";
    
    try {
        const qs = await getDocs(collection(db, "usuarios"));
        qs.forEach(d => {
            const u = d.data();
            if(sel) sel.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
            if(container) {
                const card = document.createElement('div');
                card.className = "colab-card";
                card.innerHTML = `<strong>${u.nome}</strong><br><small style="color:var(--text-muted);">${u.cargo || 'Membro'}</small>`;
                card.onclick = () => abrirPastaColaborador(d.id, u);
                container.appendChild(card);
            }
        });
    } catch(e) {}
}

window.abrirPastaColaborador = async (id, data) => {
    currentColabId = id;
    document.getElementById('modal-rh-nome').innerText = "Pasta: " + data.nome;
    
    const btnExcluirColab = document.getElementById('btn-excluir-colaborador');
    if(btnExcluirColab) {
        btnExcluirColab.onclick = async () => {
            if(confirm("ATENÇÃO: Deseja EXCLUIR este colaborador do sistema? Isso não pode ser desfeito.")) {
                await deleteDoc(doc(db, "usuarios", id));
                fecharModalRH();
                carregarColaboradores();
                alert("Colaborador removido do sistema.");
            }
        };
    }
    document.getElementById('modal-colaborador').style.display = 'flex';
    monitorarHistorico(id);
};

function monitorarHistorico(id) {
    const q = query(collection(db, `usuarios/${id}/historico`), orderBy("data", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('historico-rh-lista');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const ev = d.data();
            list.innerHTML += `
                <div class="history-item">
                    <div><strong style="color:var(--accent);">${ev.tipo}</strong><br><small style="color:#ccc;">${ev.desc}</small></div>
                    <div style="text-align:right; color:#00ff88; font-weight:bold;">R$ ${ev.valor || '0,00'}<br><small style="color:#777;">${new Date(ev.data).toLocaleDateString()}</small></div>
                </div>`;
        });
    });
}

function monitorarBeneficiosPendentes() {
    if(!userLogged) return;
    const q = query(collection(db, `usuarios/${userLogged.uid}/beneficiosPendentes`));
    onSnapshot(q, (snap) => {
        const grid = document.getElementById('meus-beneficios-grid');
        if(!grid) return;
        grid.innerHTML = "";
        
        if(snap.empty) {
            grid.innerHTML = "<p style='color:var(--text-muted);'>Nenhum benefício pendente de recebimento.</p>";
            return;
        }

        snap.forEach(d => {
            const ben = d.data();
            const benId = d.id;
            const card = document.createElement('div');
            card.className = "card";
            card.style.borderLeft = "4px solid #00ff88";
            card.innerHTML = `
                <h3 style="color:#00ff88;">${ben.tipo}</h3>
                <p style="font-size:24px; font-weight:bold; margin-top:10px;">R$ ${ben.valor}</p>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">${ben.desc || 'Pagamento pendente'}</p>
                ${ben.qrCode ? `<div id="qr-area-${benId}" style="display:none; text-align:center; margin-bottom:15px;"><img src="${ben.qrCode}" style="width:100%; border-radius:10px; margin-bottom:10px;"><p style="font-size:10px; color:#ffaa00;">Escaneie para receber.</p></div>` : ''}
                <button class="button1" id="btn-receber-${benId}">Receber Valor</button>
            `;
            grid.appendChild(card);

            document.getElementById(`btn-receber-${benId}`).onclick = async () => {
                if(ben.qrCode && document.getElementById(`qr-area-${benId}`).style.display === 'none') {
                    document.getElementById(`qr-area-${benId}`).style.display = 'block';
                    document.getElementById(`btn-receber-${benId}`).innerText = "Confirmar Recebimento";
                    document.getElementById(`btn-receber-${benId}`).style.background = "#ff3366";
                } else {
                    if(confirm("Confirmar o resgate deste valor?")) {
                        await deleteDoc(doc(db, `usuarios/${userLogged.uid}/beneficiosPendentes`, benId));
                        await addDoc(collection(db, `usuarios/${userLogged.uid}/historico`), {
                            tipo: `Resgate: ${ben.tipo}`, valor: ben.valor, desc: "Valor recebido pelo colaborador.", data: new Date().getTime()
                        });
                        alert("Resgate concluído!");
                    }
                }
            };
        });
    });
}

// --- LÓGICA PRINCIPAL ---
document.addEventListener("DOMContentLoaded", () => {
    
    setTimeout(() => { const s = document.getElementById('splash-screen'); if(s) { s.style.opacity = '0'; setTimeout(()=> s.style.display='none', 800); } }, 2000);
    carregarLogos();

    const btnEntrar = document.getElementById('btn-entrar');
    if (btnEntrar) {
        btnEntrar.addEventListener('click', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value;
            const senha = document.getElementById('password').value;
            if(!email || !senha) return alert("Por favor, preencha e-mail e senha.");

            try {
                btnEntrar.innerText = "Aguarde...";
                await signInWithEmailAndPassword(auth, email, senha);
            } catch (err) {
                btnEntrar.innerText = "Acessar Sistema";
                alert("Erro: " + err.message);
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            try {
                const d = await getDoc(doc(db, "usuarios", user.uid));
                let data = d.exists() ? d.data() : { nome: "Gestão (Admin)", isAdmin: true, permissoes: { home: true, agenda: true, planner: true, beneficios: true, music: true, rh: true, admin: true } };

                userLogged = { uid: user.uid, ...data };
                aplicarPermissoes(data.permissoes);
                
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                document.getElementById('ludotech-widget').style.display = 'block'; 
                
                carregarColaboradores();
                monitorarBeneficiosPendentes();
                
                // PEDIR PERMISSÃO PARA NOTIFICAÇÕES (PWA)
                if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }

                const conf = await getDoc(doc(db, 'config', 'music'));
                if(conf.exists() && document.getElementById('spotify-iframe')) document.getElementById('spotify-iframe').src = conf.data().url;
            } catch(e) {}
        }
    });

    const btnSair = document.getElementById('btn-sair');
    if(btnSair) { btnSair.addEventListener('click', async () => { await signOut(auth); window.location.reload(); }); }

    document.getElementById('form-rh-completo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const permissoes = {};
        document.querySelectorAll('#permissoes-cadastro input').forEach(i => permissoes[i.value] = i.checked);
        
        try {
            const res = await createUserWithEmailAndPassword(secondaryAuth, document.getElementById('rh-email').value, document.getElementById('rh-senha').value);
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: document.getElementById('rh-nome').value,
                cargo: document.getElementById('rh-cargo').value,
                setor: document.getElementById('rh-setor').value,
                email: document.getElementById('rh-email').value,
                permissoes: permissoes,
                criadoEm: new Date().getTime()
            });
            await signOut(secondaryAuth);
            alert("Colaborador cadastrado na equipe com sucesso!");
            e.target.reset();
            carregarColaboradores();
        } catch(err) { alert("Erro ao cadastrar: " + err.message); }
    });

    document.getElementById('btn-lancar-rh')?.addEventListener('click', async () => {
        const tipo = document.getElementById('rh-tipo-evento').value;
        const valor = document.getElementById('rh-valor-evento').value;
        const qrCode = document.getElementById('rh-link-qrcode').value;
        const desc = document.getElementById('rh-desc-evento').value;
        
        const ev = { tipo, valor, desc, data: new Date().getTime() };
        await addDoc(collection(db, `usuarios/${currentColabId}/historico`), ev);
        
        await addDoc(collection(db, `usuarios/${currentColabId}/beneficiosPendentes`), {
            tipo, valor, desc, qrCode, criadoEm: new Date().getTime()
        });
        
        alert("Benefício liberado! Ele já aparece na tela do colaborador.");
        document.getElementById('rh-valor-evento').value = "";
        document.getElementById('rh-link-qrcode').value = "";
        document.getElementById('rh-desc-evento').value = "";
    });

    document.getElementById('btn-save-logos')?.addEventListener('click', async () => {
        const files = { logoIntro: document.getElementById('up-logo-intro').files[0], logoLogin: document.getElementById('up-logo-login').files[0], logoMenu: document.getElementById('up-logo-menu').files[0] };
        const urls = {};
        for(let key in files) {
            if(files[key]) {
                const r = ref(storage, `config/${key}`); await uploadBytes(r, files[key]); urls[key] = await getDownloadURL(r);
            }
        }
        if(Object.keys(urls).length > 0) { await setDoc(doc(db, 'config', 'visual'), urls, {merge:true}); alert("Logos salvas no servidor!"); carregarLogos(); }
    });

    document.getElementById('btn-save-spotify')?.addEventListener('click', async () => {
        const url = document.getElementById('config-spotify-url').value;
        const embedUrl = url.replace("https://open.spotify.com/", "https://open.spotify.com/embed/");
        await setDoc(doc(db, 'config', 'music'), { url: embedUrl });
        alert("Playlist atualizada!");
        const iframe = document.getElementById('spotify-iframe'); if(iframe) iframe.src = embedUrl;
    });

    document.getElementById('btn-gerar-folha')?.addEventListener('click', async () => {
        const snap = await getDocs(query(collection(db, `usuarios/${currentColabId}/historico`), orderBy("data", "desc")));
        let html = `<div style="font-family:sans-serif; border:2px solid #000; padding:30px;"><h1 style="text-align:center">COMPROVANTE DE HISTÓRICO - LUDOMKT</h1><hr><p><strong>Colaborador:</strong> ${document.getElementById('modal-rh-nome').innerText.replace('Pasta: ', '')}</p><p><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString()}</p><table width="100%" border="1" style="border-collapse:collapse; margin:20px 0; text-align:left;"><thead><tr style="background:#eee;"><th>Data</th><th>Evento</th><th>Descrição</th><th>Valor (R$)</th></tr></thead><tbody>`;
        snap.forEach(d => { const e = d.data(); html += `<tr><td>${new Date(e.data).toLocaleDateString()}</td><td>${e.tipo}</td><td>${e.desc}</td><td>R$ ${e.valor || '0,00'}</td></tr>`; });
        html += `</tbody></table><div style="margin-top:50px; display:flex; justify-content:space-between;"><div style="border-top:1px solid #000; width:200px; text-align:center">Assinatura Gestor</div><div style="border-top:1px solid #000; width:200px; text-align:center">Assinatura Colaborador</div></div></div>`;
        document.getElementById('print-area').innerHTML = html; window.print();
    });

    document.getElementById('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = document.getElementById('task-id').value;
        const sel = document.getElementById('task-responsaveis');
        const resp = Array.from(sel.selectedOptions).map(o => o.value).join(', ');
        const st = document.getElementById('task-status').value;
        
        const datasStr = document.getElementById('task-datas').value;
        const datasArr = datasStr.split(',').map(d => d.trim()).filter(d => d !== '');
        if (datasArr.length === 0) datasArr.push('');

        let t = {
            titulo: document.getElementById('task-titulo').value, responsaveis: resp, status: st,
            prioridade: document.getElementById('task-prioridade').value, descricao: document.getElementById('task-desc').value
        };

        if (idEdicao !== "") {
            t.datas = datasArr[0] || '';
            if(st === 'concluido' && todasAtividades[idEdicao].status !== 'concluido') t.concluidoPor = userLogged.nome;
            await updateDoc(doc(db, "atividades", idEdicao), t);
        } else {
            t.criadoEm = new Date().getTime(); t.criadoPor = userLogged ? userLogged.nome : 'Sistema';
            if(st === 'concluido') t.concluidoPor = userLogged.nome;
            for(let d of datasArr) {
                let taskCopy = { ...t, datas: d };
                await addDoc(collection(db, "atividades"), taskCopy);
            }
        }
        fecharModal();
    });

    const cols = { 'pendente': document.getElementById('col-pendente'), 'analise': document.getElementById('col-analise'), 'concluido': document.getElementById('col-concluido') };
    onSnapshot(query(collection(db, "atividades"), orderBy("criadoEm", "desc")), (snap) => {
        if(cols.pendente) Object.values(cols).forEach(c => c.innerHTML = '');
        let evG = [], evI = [], cPend = 0, cAnd = 0, cConc = 0;
        
        snap.forEach((d) => {
            const data = d.data(); const id = d.id; todasAtividades[id] = data;
            if(data.status === 'pendente') cPend++; if(data.status === 'analise') cAnd++; if(data.status === 'concluido') cConc++;
            
            const c = document.createElement('div'); c.className = `kanban-card`; c.setAttribute('draggable', 'true'); c.dataset.id = id; 
            c.onclick = () => editarTarefa(id);
            let logText = `Criado por ${data.criadoPor || '...'}`;
            if(data.status === 'concluido') logText = `<span style="color:#00ff88">Concluído por ${data.concluidoPor || '...'}</span>`;
            
            c.innerHTML = `<div style="font-weight:bold; font-size:18px;">${data.titulo}</div><div style="font-size:12px; color:#ccc;">Resp: ${data.responsaveis || 'Todos'}</div><div style="font-size:10px; color:#ffaa00; margin-top:5px;">📅 ${data.datas || 'Sem Data'}</div><div class="task-log">${logText}</div>`;
            c.addEventListener('dragstart', () => { c.classList.add('dragging'); c.style.opacity = '0.5'; });
            c.addEventListener('dragend', () => { c.classList.remove('dragging'); c.style.opacity = '1'; });
            if(cols[data.status]) cols[data.status].appendChild(c);

            if (data.datas && data.datas !== '') {
                let cor = data.status === 'analise' ? '#ffaa00' : (data.status === 'concluido' ? '#00ff88' : '#ff3366');
                let ev = { id, title: data.titulo, start: data.datas, backgroundColor: cor, borderColor: cor };
                evG.push(ev);
                if(userLogged && data.responsaveis.includes(userLogged.nome)) evI.push(ev);
            }
        });

        if(document.getElementById('resumo-pendentes')) {
            document.getElementById('resumo-pendentes').innerText = cPend; document.getElementById('resumo-andamento').innerText = cAnd; document.getElementById('resumo-concluidas').innerText = cConc;
            const badge = document.getElementById('badge-tarefas'); if(badge) { badge.innerText = cPend; badge.style.display = cPend > 0 ? 'inline-block' : 'none'; }
        }
        
        // DISPARO DE NOTIFICAÇÃO (PWA)
        if (cPend > 0 && cPend > tarefasPendentesAnterior && tarefasPendentesAnterior !== -1) {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('LudoMKT Workspace', {
                    body: `Atenção! Existem ${cPend} tarefas pendentes.`,
                    icon: 'logo.png'
                });
            }
        }
        tarefasPendentesAnterior = cPend;

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

    // CHATBOT GROQ
    document.getElementById('send-ia')?.addEventListener('click', async () => {
        const inp = document.getElementById('chat-input');
        const cb = document.getElementById('chat-messages');
        const m = inp.value.trim();
        if(!m) return;
        cb.innerHTML += `<div class="msg-user">${m}</div>`; inp.value = "";
        const loadingId = 'loading-' + Date.now();
        cb.innerHTML += `<div class="msg-ia" id="${loadingId}">Processando...</div>`; cb.scrollTop = cb.scrollHeight;

        const API_KEY = "COLOQUE_SUA_CHAVE_AQUI"; 

        try {
            const respostaRaw = await fetch('https://api.groq.com/openai/v1/chat/completions', { 
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` }, 
                body: JSON.stringify({ "model": "llama-3.1-8b-instant", "messages": [{ "role": "system", "content": "Você é a LudoTech, IA da LudoMKT." }, { "role": "user", "content": m }] }) 
            });
            const d = await respostaRaw.json(); 
            if (!respostaRaw.ok) throw new Error(d.error?.message || "Erro");
            document.getElementById(loadingId)?.remove();
            cb.innerHTML += `<div class="msg-ia">${d.choices[0].message.content.replace(/\n/g, '<br>')}</div>`; cb.scrollTop = cb.scrollHeight;
        } catch(e) { 
            document.getElementById(loadingId)?.remove();
            cb.innerHTML += `<div class="msg-ia" style="color:#ff3366; font-size:12px;">Erro: ${e.message}</div>`; cb.scrollTop = cb.scrollHeight;
        }
    });

    if (typeof FullCalendar !== 'undefined') {
        const cfg = { initialView: 'dayGridMonth', locale: 'pt-br', headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth' }, editable: true, droppable: true, eventClick: (info) => editarTarefa(info.event.id), eventDrop: async (info) => { try { await updateDoc(doc(db, "atividades", info.event.id), { datas: info.event.start.toISOString().split('T')[0] }); } catch (err) { info.revert(); } } };
        if(document.getElementById('calendar-geral')) window.calendarioGeral = new FullCalendar.Calendar(document.getElementById('calendar-geral'), cfg);
        if(document.getElementById('calendar-individual')) window.calendarioIndividual = new FullCalendar.Calendar(document.getElementById('calendar-individual'), cfg);
    }
});
