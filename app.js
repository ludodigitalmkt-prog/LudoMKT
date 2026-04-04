import { db, auth, storage } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ESTADO GLOBAL
let userLogged = null;
let currentColabId = null;
let appConfig = {};

// --- FUNÇÕES DE INTERFACE ---
window.toggleIA = () => document.getElementById('ludotech-chat').classList.toggle('chat-hidden');
window.abrirModal = () => { document.getElementById('task-id').value = ""; document.getElementById('task-form').reset(); document.getElementById('task-modal').style.display = 'flex'; };
window.fecharModal = () => document.getElementById('task-modal').style.display = 'none';
window.fecharModalRH = () => document.getElementById('modal-colaborador').style.display = 'none';

window.mudarVisaoAgenda = (v) => {
    document.querySelectorAll('.agenda-view').forEach(el => el.style.display = 'none');
    document.getElementById('visao-' + v).style.display = 'block';
    if(v === 'calendario' && window.calendarioGeral) setTimeout(() => window.calendarioGeral.render(), 100);
};

// --- LOGO ENGINE (CADASTRO DE LOGOS) ---
async function carregarLogos() {
    const snap = await getDoc(doc(db, 'config', 'visual'));
    if(snap.exists()) {
        const d = snap.data();
        if(d.logoIntro) document.getElementById('logo-intro').src = d.logoIntro;
        if(d.logoLogin) document.getElementById('logo-login').src = d.logoLogin;
        if(d.logoMenu) document.getElementById('logo-menu').src = d.logoMenu;
    }
}

// --- PERMISSÕES ENGINE ---
function aplicarPermissoes(permissoes) {
    const nav = document.getElementById('main-nav');
    const links = {
        home: { icon: 'home', label: 'Início' },
        agenda: { icon: 'view_kanban', label: 'Agenda Geral' },
        planner: { icon: 'event_note', label: 'Meu Planner' },
        beneficios: { icon: 'star', label: 'Benefícios' },
        music: { icon: 'headphones', label: 'LudoMusic' },
        ferramentas: { icon: 'apps', label: 'Links Úteis' },
        rh: { icon: 'groups', label: 'Portal RH' },
        admin: { icon: 'settings', label: 'Configurações' }
    };

    nav.innerHTML = "";
    Object.keys(links).forEach(key => {
        if(permissoes[key]) {
            const btn = document.createElement('button');
            btn.className = "menu-btn";
            btn.dataset.target = key;
            btn.innerHTML = `<span class="material-icons">${links[key].icon}</span> ${links[key].label}`;
            btn.onclick = () => {
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(key).classList.add('active');
            };
            nav.appendChild(btn);
        }
    });
}

// --- RH ENGINE ---
async function carregarColaboradores() {
    const qs = await getDocs(collection(db, "usuarios"));
    const container = document.getElementById('lista-colaboradores-cards');
    container.innerHTML = "";
    qs.forEach(d => {
        const u = d.data();
        const card = document.createElement('div');
        card.className = "colab-card";
        card.innerHTML = `<strong>${u.nome}</strong><br><small>${u.cargo || 'Membro'}</small>`;
        card.onclick = () => abrirPastaColaborador(d.id, u);
        container.appendChild(card);
    });
}

window.abrirPastaColaborador = async (id, data) => {
    currentColabId = id;
    document.getElementById('modal-rh-nome').innerText = "Pasta: " + data.nome;
    document.getElementById('modal-colaborador').style.display = 'flex';
    monitorarHistorico(id);
};

function monitorarHistorico(id) {
    const q = query(collection(db, `usuarios/${id}/historico`), orderBy("data", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('historico-rh-lista');
        list.innerHTML = "";
        snap.forEach(d => {
            const ev = d.data();
            list.innerHTML += `
                <div class="history-item">
                    <div><strong>${ev.tipo}</strong><br><small>${ev.desc}</small></div>
                    <div style="text-align:right">R$ ${ev.valor || '0'}<br><small>${new Date(ev.data).toLocaleDateString()}</small></div>
                </div>`;
        });
    });
}

// --- IMPRESSÃO DE COMPROVANTE ---
document.getElementById('btn-gerar-folha')?.addEventListener('click', async () => {
    const snap = await getDocs(query(collection(db, `usuarios/${currentColabId}/historico`), orderBy("data", "desc")));
    let html = `
        <div style="font-family:sans-serif; border:2px solid #000; padding:30px;">
            <h1 style="text-align:center">COMPROVANTE DE VENCIMENTOS - LUDOMKT</h1>
            <hr>
            <p><strong>Colaborador:</strong> ${document.getElementById('modal-rh-nome').innerText}</p>
            <table width="100%" border="1" style="border-collapse:collapse; margin:20px 0;">
                <thead><tr><th>Data</th><th>Evento</th><th>Descrição</th><th>Valor</th></tr></thead>
                <tbody>`;
    
    snap.forEach(d => {
        const e = d.data();
        html += `<tr><td>${new Date(e.data).toLocaleDateString()}</td><td>${e.tipo}</td><td>${e.desc}</td><td>R$ ${e.valor}</td></tr>`;
    });

    html += `</tbody></table>
            <div style="margin-top:50px; display:flex; justify-content:space-between;">
                <div style="border-top:1px solid #000; width:200px; text-align:center">Assinatura Gestor</div>
                <div style="border-top:1px solid #000; width:200px; text-align:center">Assinatura Colaborador</div>
            </div>
        </div>`;
    
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = html;
    window.print();
});

// --- LÓGICA PRINCIPAL ---
document.addEventListener("DOMContentLoaded", () => {
    
    setTimeout(() => { document.getElementById('splash-screen').style.opacity = '0'; setTimeout(()=> document.getElementById('splash-screen').style.display='none', 800); }, 2000);
    carregarLogos();

    // LOGIN
    document.getElementById('btn-entrar').onclick = async () => {
        const e = document.getElementById('email').value, s = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, e, s); } catch(err) { alert("Acesso negado."); }
    };

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            const d = await getDoc(doc(db, "usuarios", user.uid));
            if(d.exists()) {
                const data = d.data();
                userLogged = { uid: user.uid, ...data };
                aplicarPermissoes(data.permissoes || { home: true });
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                document.getElementById('ludotech-widget').style.display = 'block';
                
                // Carrega Spotify
                const conf = await getDoc(doc(db, 'config', 'music'));
                if(conf.exists()) document.getElementById('spotify-iframe').src = conf.data().url;

                if(data.permissoes.rh) carregarColaboradores();
            }
        }
    });

    // CADASTRO COLABORADOR COM PERMISSÕES
    document.getElementById('form-rh-completo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const permissoes = {};
        document.querySelectorAll('#permissões-cadastro input').forEach(i => permissoes[i.value] = i.checked);
        
        try {
            const res = await createUserWithEmailAndPassword(auth, document.getElementById('rh-email').value, document.getElementById('rh-senha').value);
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: document.getElementById('rh-nome').value,
                cargo: document.getElementById('rh-cargo').value,
                setor: document.getElementById('rh-setor').value,
                unidade: document.getElementById('rh-unidade').value,
                contato: document.getElementById('rh-contato').value,
                email: document.getElementById('rh-email').value,
                permissoes: permissoes,
                criadoEm: new Date().getTime()
            });
            alert("Colaborador cadastrado!");
            e.target.reset();
            carregarColaboradores();
        } catch(err) { alert(err.message); }
    });

    // LANÇAMENTO DE EVENTOS RH
    document.getElementById('btn-lancar-rh')?.addEventListener('click', async () => {
        const ev = {
            tipo: document.getElementById('rh-tipo-evento').value,
            valor: document.getElementById('rh-valor-evento').value,
            desc: document.getElementById('rh-desc-evento').value,
            data: new Date().getTime()
        };
        await addDoc(collection(db, `usuarios/${currentColabId}/historico`), ev);
        alert("Lançado no histórico!");
        document.getElementById('rh-valor-evento').value = "";
        document.getElementById('rh-desc-evento').value = "";
    });

    // UPLOAD DE LOGOS
    document.getElementById('btn-save-logos')?.addEventListener('click', async () => {
        const files = {
            logoIntro: document.getElementById('up-logo-intro').files[0],
            logoLogin: document.getElementById('up-logo-login').files[0],
            logoMenu: document.getElementById('up-logo-menu').files[0]
        };
        
        const urls = {};
        for(let key in files) {
            if(files[key]) {
                const r = ref(storage, `config/${key}`);
                await uploadBytes(r, files[key]);
                urls[key] = await getDownloadURL(r);
            }
        }
        if(Object.keys(urls).length > 0) {
            await setDoc(doc(db, 'config', 'visual'), urls, {merge:true});
            alert("Logos atualizadas!");
            carregarLogos();
        }
    });

    // CONFIG SPOTIFY
    document.getElementById('btn-save-spotify')?.addEventListener('click', async () => {
        const url = document.getElementById('config-spotify-url').value;
        const embedUrl = url.replace("spotify.com/", "spotify.com/embed/");
        await setDoc(doc(db, 'config', 'music'), { url: embedUrl });
        alert("Playlist atualizada!");
        document.getElementById('spotify-iframe').src = embedUrl;
    });

    document.getElementById('btn-sair').onclick = () => { signOut(auth); window.location.reload(); };
});
