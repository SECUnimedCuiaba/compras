// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD10ElcL0CaaZPBgHmCzyhhor79fJxFESg",
  authDomain: "fluxo-compras.firebaseapp.com",
  projectId: "fluxo-compras",
  storageBucket: "fluxo-compras.firebasestorage.app",
  messagingSenderId: "807346455861",
  appId: "1:807346455861:web:eecc4f589cc1f8af7f387c",
  measurementId: "G-HHB39DH9LS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Verifica se estamos na página de login
const isLoginPage = window.location.pathname.includes('login.html');
const isIndexPage = window.location.pathname.endsWith('index.html') || 
                    window.location.pathname.endsWith('/');

// Monitora mudanças no estado de autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Usuário está logado
    try {
      // Busca informações do usuário no Firestore usando o UID
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        localStorage.setItem('userLevel', userData.nivel);
        localStorage.setItem('userName', userData.nome);
        localStorage.setItem('userDocId', userDoc.id);
        
        if (isLoginPage) {
          window.location.href = 'index.html';
        }
      } else {
        console.error("Usuário não encontrado no Firestore");
        await signOut(auth);
      }
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      await signOut(auth);
    }
  } else {
    // Usuário não está logado
    localStorage.removeItem('userLevel');
    localStorage.removeItem('userName');
    localStorage.removeItem('userDocId');
    
    // Se não está na página de login, redireciona para login
    if (!isLoginPage && isIndexPage) {
      window.location.href = 'login.html';
    }
  }
});

// Login de usuário
if (isLoginPage) {
  const loginForm = document.getElementById('login-form');
  const errorMessage = document.getElementById('error-message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirecionamento é feito automaticamente pelo onAuthStateChanged
    } catch (error) {
      console.error("Erro no login:", error);
      errorMessage.textContent = getErrorMessage(error.code);
    }
  });
}

// Logout
export function logout() {
  signOut(auth).then(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error("Erro ao fazer logout:", error);
  });
}

// Exportar função de criação de usuário para uso no script.js
export async function createUserWithEmail(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

// Função para obter mensagens de erro amigáveis
function getErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 6 caracteres.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/wrong-password':
      return 'Senha incorreta.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.';
    default:
      return 'Erro desconhecido. Tente novamente.';
  }
}
