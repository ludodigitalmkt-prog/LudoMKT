import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCFIL5NCeutlSciYuHj8sV6fr88-T2d-w",
  authDomain: "ludomkt-75d14.firebaseapp.com",
  projectId: "ludomkt-75d14",
  storageBucket: "ludomkt-75d14.firebasestorage.app",
  messagingSenderId: "173305323322",
  appId: "1:173305323322:web:b2cd9947aaa9806dc33a03"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Inicializa Banco de Dados com Cache Offline Ativado
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

console.log("🔥 Firebase Inicializado com Sucesso!");

export { app, auth, db };
