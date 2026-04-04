import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCFIL5NCeutlSciYuHj8sV6fr88-T2d-w",
  authDomain: "ludomkt-75d14.firebaseapp.com",
  projectId: "ludomkt-75d14",
  storageBucket: "ludomkt-75d14.firebasestorage.app",
  messagingSenderId: "173305323322",
  appId: "1:173305323322:web:b2cd9947aaa9806dc33a03"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
export const storage = getStorage(app);
