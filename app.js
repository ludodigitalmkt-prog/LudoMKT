import { db, auth, storage } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let userLogged = null;
let currentColabId = null;

// INTERFACE
window.mudarVisaoAgenda = (v) => {
    document.querySelectorAll('.agenda-view').forEach(el => el.style.display = 'none');
    document.getElementById('visao-' + v).style.display = 'block';
};
window.fecharModalRH = () => document.getElementById('modal-colaborador').style.display = 'none';

// PERMISSÕES
function aplicarPermissoes(perm) {
    const nav = document.getElementById('main-nav');
    const links = {
        home: { icon: 'home', label: 'Início' },
        agenda: { icon: 'view_kanban', label: 'Agenda' },
        planner: { icon: 'event_note', label: 'Planner' },
        rh: { icon: 'groups', label: 'RH' },
        admin: { icon: 'settings', label: 'Config' }
    };
    nav.innerHTML = "";
    Object.keys(links).forEach(k => {
        if (!perm || perm[k] !== false) { // Se não houver perm, libera por padrão para não travar
            const btn = document.createElement('button');
            btn.className = "menu-btn";
            btn.innerHTML = `<span class="material-icons">${links[k].icon}</span> ${links[k].label}`;
            btn.onclick = () => {
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(k).classList.add('active');
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            nav.appendChild(btn);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => { document.getElementById('splash-screen').style.display = 'none'; }, 2000);

    // LOGIN
    document.getElementById('btn-entrar').onclick = async () => {
        const e = document.getElementById('email').value, s = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, e, s); } catch (err) { alert("Erro de acesso"); }
    };

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            const d = await getDoc(doc(db, "usuarios", user.uid));
            userLogged = d.exists() ? d.data() : { nome: "Admin" };
            aplicarPermissoes(userLogged.permissoes);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            if(userLogged.permissoes?.rh !== false) carregarColaboradores();
        }
    });

    document.getElementById('btn-sair').onclick = () => { signOut(auth); window.location.reload(); };

    // CADASTRO RH
    document.getElementById('form-rh-completo').onsubmit = async (e) => {
        e.preventDefault();
        const perms = {};
        document.querySelectorAll('#permissoes-cadastro input').forEach(i => perms[i.value] = i.checked);
        try {
            const res = await createUserWithEmailAndPassword(auth, document.getElementById('rh-email').value, document.getElementById('rh-senha').value);
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nome: document.getElementById('rh-nome').value,
                cargo: document.getElementById('rh-cargo').value,
                permissoes: perms
            });
            alert("Sucesso");
            carregarColaboradores();
        } catch(err) { alert(err.message); }
    };
});

async function carregarColaboradores() {
    const qs = await getDocs(collection(db, "usuarios"));
    const container = document.getElementById('lista-colaboradores-cards');
    container.innerHTML = "";
    qs.forEach(d => {
        const u = d.data();
        const card = document.createElement('div');
        card.className = "colab-card";
        card.innerHTML = `<strong>${u.nome}</strong><br><small>${u.cargo || 'Membro'}</small>`;
        card.onclick = () => {
            currentColabId = d.id;
            document.getElementById('modal-rh-nome').innerText = u.nome;
            document.getElementById('modal-colaborador').style.display = 'flex';
        };
        container.appendChild(card);
    });
}
