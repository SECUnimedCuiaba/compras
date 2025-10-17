// script.js

// =================================================================================
//  IMPORTS E CONFIGURAÇÃO DO FIREBASE
// =================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, onSnapshot, serverTimestamp,
  query, orderBy, getDocs, deleteDoc, setDoc, getDoc, where, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { logout, createUserWithEmail } from "./auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD10ElcL0CaaZPBgHmCzyhhor79fJxFESg",
  authDomain: "fluxo-compras.firebaseapp.com",
  projectId: "fluxo-compras",
  storageBucket: "fluxo-compras.firebasestorage.app",
  messagingSenderId: "807346455861",
  appId: "1:807346455861:web:eecc4f589cc1f8af7f387c",
  measurementId: "G-HHB39DH9LS",
};

// =================================================================================
//  INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
// =================================================================================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const etapas = [
  { id: 1, nome: "Pedido a Fazer", cor: "#f9e79f" },
  { id: 2, nome: "Pedido Feito - Solicitar Aprovação", cor: "#aed6f1" },
  { id: 3, nome: "Aguardando Aprovação do Gestor", cor: "#f5cba7" },
  { id: 4, nome: "Aprovado — Enviar ao Compras", cor: "#9ce7c8ff" },
  { id: 5, nome: "Aguardando Orçamento", cor: "#92f0f7ff" },
  { id: 6, nome: "Compras Solicita Validação", cor: "#d5f5e3" },
  { id: 7, nome: "Validado - Aguardando Compra", cor: "#fadbd8" },
  { id: 8, nome: "Aguardando Material", cor: "#fcf3cf" },
  { id: 9, nome: "Material Recebido - Processo encerrado", cor: "#d4efdf" },
];

// Elementos do DOM
const kanban = document.getElementById("kanban");
const loader = document.getElementById("loader");
const modalCreate = document.getElementById("modalCreate");
const modalEdit = document.getElementById("modalEdit");
const modalUserCreate = document.getElementById("modalUserCreate");
const modalUserEdit = document.getElementById("modalUserEdit");
const usersGrid = document.getElementById("users-grid");
const closeModals = document.querySelectorAll(".close");

// Formulários
const formCreate = document.getElementById("formCreate");
const formEdit = document.getElementById("formEdit");
const formUserCreate = document.getElementById("formUserCreate");
const formUserEdit = document.getElementById("formUserEdit");
const profileForm = document.getElementById("profile-form");

// Estado da Aplicação
let unsubscribe; // Armazena a função para cancelar o listener do onSnapshot
let currentUser = null;
let userLevel = null;
let userName = null;
let userDocId = null;
let filtroPrivados = false;
let usersNameCache = {}; // Cache de UID -> Nome

// =================================================================================
//  AUTENTICAÇÃO E INICIALIZAÇÃO DA APLICAÇÃO
// =================================================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Carrega dados do localStorage como fallback, mas sempre busca do Firestore para garantir consistência
    await loadUserData(user.uid);
    await carregarNomesUsuarios();
    updateUserInterface();
    carregarCards();
    setupEventListeners();

    if (userLevel === "admin") {
      carregarUsuarios();
    }
  } else {
    // Redirecionamento é tratado pelo auth.js
  }
});

async function loadUserData(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      userLevel = userData.nivel;
      userName = userData.nome;
      userDocId = userDocSnap.id;

      // Atualiza o localStorage para persistência entre sessões
      localStorage.setItem("userLevel", userLevel);
      localStorage.setItem("userName", userName);
      localStorage.setItem("userDocId", userDocId);
    } else {
      console.error("Dados do usuário não encontrados no Firestore. Logout forçado.");
      logout();
    }
  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
  }
}

function updateUserInterface() {
  document.getElementById("headerUserName").textContent = userName;
  document.getElementById("sidebarUserName").textContent = userName;
  document.getElementById("sidebarUserLevel").textContent = userLevel === "admin" ? "Administrador" : "Operador";

  document.querySelectorAll(".admin-only").forEach(item => {
    item.style.display = userLevel === "admin" ? "flex" : "none";
  });

  carregarPerfil();
}

// =================================================================================
//  NAVEGAÇÃO E UI (SIDEBAR, MODAIS, SEÇÕES)
// =================================================================================
function setupEventListeners() {
  // Menu Lateral
  document.getElementById("menuToggle").addEventListener("click", toggleMenu);
  document.getElementById("closeSidebar").addEventListener("click", toggleMenu);
  document.getElementById("sidebarOverlay").addEventListener("click", toggleMenu);

  // Navegação
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const sectionId = item.getAttribute("data-section");
      if (sectionId) showSection(sectionId);
      toggleMenu(false); // Força o fechamento
    });
  });

  // Logout
  document.getElementById("logoutBtnSidebar").addEventListener("click", logout);

  // Botões de Ação Principais
  document.getElementById("novoCard").addEventListener("click", openCreateModal);
  if (userLevel === 'admin') {
    document.getElementById("novoUsuario").addEventListener("click", () => modalUserCreate.style.display = "block");
  }
  document.getElementById("visibilityToggle").addEventListener("click", toggleVisibilityFilter);

  // Fechar Modais
  closeModals.forEach(close => close.addEventListener("click", () => close.parentElement.parentElement.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
  });
}

function toggleMenu(forceState) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const show = typeof forceState === 'boolean' ? forceState : !sidebar.classList.contains("active");
  sidebar.classList.toggle("active", show);
  overlay.classList.toggle("active", show);
}

function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach(section => section.classList.remove("active"));
  document.getElementById(sectionId).classList.add("active");
  
  document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-section") === sectionId);
  });
}

function toggleVisibilityFilter() {
  filtroPrivados = !filtroPrivados;
  const toggleButton = document.getElementById("visibilityToggle");
  toggleButton.classList.toggle("active", filtroPrivados);
  toggleButton.title = filtroPrivados ? "Mostrar todos os cards" : "Mostrar apenas meus cards";
  carregarCards();
}

// =================================================================================
//  LÓGICA DO KANBAN (COLUNAS, CARDS, DRAG & DROP)
// =================================================================================
function criarColunas() {
  kanban.innerHTML = ''; // Limpa colunas existentes para evitar duplicação
  etapas.forEach((etapa) => {
    const col = document.createElement("div");
    col.className = "column";
    col.dataset.id = etapa.id;
    col.innerHTML = `
      <h2 style="background-color: ${etapa.cor}; border: 1px solid #ccc;">${etapa.nome}</h2>
      <div class="cards"></div>
    `;
    kanban.appendChild(col);
  });
}
criarColunas(); // Cria as colunas uma vez na inicialização

function carregarCards() {
  loader.style.display = "flex";

  // CORREÇÃO: Cancela a inscrição do listener anterior para evitar vazamentos de memória
  if (unsubscribe) {
    unsubscribe();
  }

  const solicitacoesRef = collection(db, "solicitacoes");
  const q = query(solicitacoesRef, orderBy("ultimaAtualizacao", "desc"));

  unsubscribe = onSnapshot(q, (querySnapshot) => {
    document.querySelectorAll(".cards").forEach(cards => cards.innerHTML = "");

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const isMeuCard = data.criadoPor === currentUser.uid;
      const isCardPublico = data.visibilidade === "publico";

      const deveMostrar = filtroPrivados ? isMeuCard : (isMeuCard || isCardPublico);

      if (deveMostrar) {
        const card = criarCardElemento(data, docSnapshot.id);
        const column = document.querySelector(`.column[data-id="${data.etapa}"] .cards`);
        if (column) {
          column.appendChild(card);
        }
      }
    });
    loader.style.display = "none";
  }, (error) => {
    console.error("Erro ao carregar cards: ", error);
    loader.textContent = "Erro ao carregar dados.";
  });
}

function criarCardElemento(data, docId) {
    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.docId = docId;
    card.dataset.etapaId = data.etapa; 

    if (data.visibilidade === "privado") card.classList.add("card-privado");
    
    const dataCriacao = data.criadoEm ? data.criadoEm.toDate().toLocaleDateString("pt-BR") : "N/D";
    let infoAtualizacao = "";
    if (data.ultimaAtualizacao) {
        const dataAtt = data.ultimaAtualizacao.toDate();
        infoAtualizacao = `
            <div class="info-atualizacao">
                <strong>Atualizado em:</strong> ${dataAtt.toLocaleDateString("pt-BR")} ${dataAtt.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}<br>
                <strong>Por:</strong> ${data.responsavelAtualizacao || "N/D"}<br>
            </div>
        `;
    }

    const nomeCriador = usersNameCache[data.criadoPor] || "Desconhecido";
    const podeEditar = data.criadoPor === currentUser.uid;

    let osHtml = "";
    if (data.os) {
        osHtml = `<div class="os-container">`;
        if (isUrl(data.os)) {
            osHtml += `<a href="${data.os}" target="_blank" rel="noopener noreferrer" class="os-link-btn" title="Abrir link">Abrir OS</a>`;
        } else {
            osHtml += `<span class="os-number">OS: ${escapeHTML(data.os)}</span>`;
        }
        osHtml += `</div>`;
    }

    card.innerHTML = `
        ${data.visibilidade === "privado" ? '<div class="card-privado-indicator">PRIVADO</div>' : ""}
        <h3>${escapeHTML(data.titulo)}</h3>
        
        ${osHtml}
        <p>${escapeHTML(data.descricao || "")}</p>
        <div class="info">
            <div class="info-criacao">
                <strong>Criado por:</strong> ${escapeHTML(nomeCriador)}<br>
                <strong>Data:</strong> ${dataCriacao}<br>
            </div>
            ${infoAtualizacao}
        </div>
        ${podeEditar ? `<button class="edit-btn" title="Editar">✏️</button>` : ""}
    `;

    card.querySelector(".edit-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEdicao(data, docId);
    });

    return card;
}

// Drag and Drop
let draggedCard = null;

kanban.addEventListener("dragstart", (e) => {
  if (e.target.classList.contains("card")) {
    draggedCard = e.target;
    setTimeout(() => draggedCard.classList.add("is-dragging"), 0);
  }
});

kanban.addEventListener("dragend", () => {
  if (draggedCard) {
    draggedCard.classList.remove("is-dragging");
    draggedCard = null;
  }
});

kanban.addEventListener("dragover", (e) => {
  e.preventDefault();
  const column = e.target.closest(".column .cards");
  if (column) {
    // Adicionar feedback visual aqui se desejar (ex: borda na coluna)
  }
});

kanban.addEventListener("drop", async (e) => {
  e.preventDefault();
  const columnContainer = e.target.closest(".column");
  if (columnContainer && draggedCard) {
    const cardsContainer = columnContainer.querySelector(".cards");
    const docId = draggedCard.dataset.docId;
    const novaEtapa = parseInt(columnContainer.dataset.id);
    const etapaOriginal = parseInt(draggedCard.dataset.etapaId);
    
    // Se soltar na mesma coluna, não faz nada
    if (novaEtapa === etapaOriginal) return;

    // Movimentação otimista na UI
    const colunaOriginalElem = document.querySelector(`.column[data-id="${etapaOriginal}"] .cards`);
    cardsContainer.appendChild(draggedCard);
    draggedCard.dataset.etapaId = novaEtapa;

    try {
      const solicitacaoRef = doc(db, "solicitacoes", docId);
      await updateDoc(solicitacaoRef, {
        etapa: novaEtapa,
        ultimaAtualizacao: serverTimestamp(),
        responsavelAtualizacao: userName,
      });
    } catch (error) {
      console.error("Erro ao mover card: ", error);
      alert("Erro ao mover o card. A alteração será desfeita.");
      // MELHORIA: Reverte a mudança na UI em caso de erro
      colunaOriginalElem.appendChild(draggedCard);
      draggedCard.dataset.etapaId = etapaOriginal;
    }
  }
});

// =================================================================================
//  MODAIS E FORMULÁRIOS (CRIAÇÃO/EDIÇÃO DE CARDS)
// =================================================================================
function openCreateModal() {
    formCreate.reset();
    document.getElementById("responsavel").value = userName;
    modalCreate.style.display = "block";
    document.getElementById("titulo").focus();
}

formCreate.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  toggleButtonLoading(button, true);

  try {
    await addDoc(collection(db, "solicitacoes"), {
      titulo: formCreate.titulo.value.trim(),
      os: formCreate.os.value.trim(),
      descricao: formCreate.descricao.value.trim(),
      responsavel: userName,
      etapa: 1,
      criadoEm: serverTimestamp(),
      ultimaAtualizacao: serverTimestamp(),
      responsavelAtualizacao: userName,
      criadoPor: currentUser.uid,
      visibilidade: formCreate.visibilidade.value,
    });
    modalCreate.style.display = "none";
  } catch (error) {
    console.error("Erro ao criar card: ", error);
    alert("Erro ao salvar. Tente novamente.");
  } finally {
    toggleButtonLoading(button, false);
  }
});

function abrirEdicao(data, docId) {
    formEdit.reset();
    formEdit.editDocId.value = docId;
    formEdit.editTitulo.value = data.titulo || "";
    formEdit.editOs.value = data.os || "";
    formEdit.editDescricao.value = data.descricao || "";
    formEdit.editResponsavel.value = usersNameCache[data.criadoPor] || "Desconhecido";
    formEdit.editVisibilidade.value = data.visibilidade || "publico";
    modalEdit.style.display = "block";
}

formEdit.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  toggleButtonLoading(button, true);

  try {
    const docId = formEdit.editDocId.value;
    const solicitacaoRef = doc(db, "solicitacoes", docId);
    await updateDoc(solicitacaoRef, {
      titulo: formEdit.editTitulo.value.trim(),
      os: formEdit.editOs.value.trim(),
      descricao: formEdit.editDescricao.value.trim(),
      visibilidade: formEdit.editVisibilidade.value,
      ultimaAtualizacao: serverTimestamp(),
      responsavelAtualizacao: userName,
    });
    modalEdit.style.display = "none";
  } catch (error) {
    console.error("Erro ao editar card: ", error);
    alert("Erro ao salvar alterações. Tente novamente.");
  } finally {
    toggleButtonLoading(button, false);
  }
});

// =================================================================================
//  GERENCIAMENTO DE PERFIL DO USUÁRIO
// =================================================================================
async function carregarPerfil() {
    if (currentUser) {
        profileForm.profileName.value = userName || "";
        profileForm.profileEmail.value = currentUser.email || "";
    }
}

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById("profile-message");
    toggleButtonLoading(button, true, "Salvando...");
    messageDiv.textContent = "";

    const name = profileForm.profileName.value.trim();
    const password = profileForm.profilePassword.value;
    const confirmPassword = profileForm.profileConfirmPassword.value;

    try {
        // Atualizar senha se fornecida
        if (password) {
            if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");
            if (password !== confirmPassword) throw new Error("As senhas não coincidem.");
            await updatePassword(currentUser, password);
        }

        // Atualizar nome no Firestore
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { nome: name, atualizadoEm: serverTimestamp() });

        // Atualizar dados locais e UI
        localStorage.setItem("userName", name);
        userName = name;
        usersNameCache[currentUser.uid] = name; // Atualiza o cache
        updateUserInterface();

        messageDiv.textContent = "Perfil atualizado com sucesso!";
        messageDiv.style.color = "green";
        profileForm.profilePassword.value = "";
        profileForm.profileConfirmPassword.value = "";
        
        // Dispara a recarga dos cards para refletir o novo nome
        carregarCards();

    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        messageDiv.textContent = `Erro: ${error.message}`;
        messageDiv.style.color = "red";
    } finally {
        toggleButtonLoading(button, false);
    }
});

// =================================================================================
//  GERENCIAMENTO DE USUÁRIOS (SOMENTE ADMIN)
// =================================================================================

/********************************************************************************
 * *
 * IMPORTANTE: FIRESTORE SECURITY RULES                                        *
 * Para garantir a segurança, você DEVE configurar as regras no seu Firebase.  *
 * Acesse seu projeto > Firestore Database > Rules e use regras como estas:    *
 * *
 * match /databases/{database}/documents {                                     *
 * // Usuários só podem ler/editar seu próprio documento                     *
 * match /users/{userId} {                                                   *
 * allow read, update: if request.auth.uid == userId;                      *
 * // Admins podem ler, criar e deletar qualquer usuário                   *
 * allow read, create, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.nivel == 'admin'; *
 * }                                                                         *
 * *
 * // Regras para as solicitações (cards)                                     *
 * match /solicitacoes/{solicitacaoId} {                                     *
 * // Qualquer usuário logado pode criar e mover cards                     *
 * allow create, update: if request.auth != null;                          *
 * // Ler cards públicos ou os próprios cards                              *
 * allow read: if request.auth != null && (resource.data.visibilidade == 'publico' || resource.data.criadoPor == request.auth.uid); *
 * // Editar ou deletar apenas se for o criador ou admin                   *
 * allow update, delete: if request.auth != null && (resource.data.criadoPor == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.nivel == 'admin'); *
 * }                                                                         *
 * }                                                                           *
 * *
 ********************************************************************************/


async function carregarUsuarios() {
  if (userLevel !== 'admin') return;

  const usersLoader = document.getElementById("users-loader");
  usersLoader.style.display = "block";
  usersGrid.innerHTML = "";

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersGrid.innerHTML = "";
    usersSnapshot.forEach((docSnapshot) => {
      const userData = docSnapshot.data();
      // Não exibe o próprio admin na lista para evitar auto-exclusão
      if (userData.uid !== currentUser.uid) {
        usersGrid.appendChild(criarCardUsuario(userData, docSnapshot.id));
      }
    });
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    usersLoader.textContent = "Erro ao carregar usuários.";
  } finally {
    usersLoader.style.display = "none";
  }
}

function criarCardUsuario(userData, docId) {
  const card = document.createElement("div");
  card.className = "user-card";
  card.innerHTML = `
    <div class="user-card-header">
      <h3 class="user-card-name">${escapeHTML(userData.nome)}</h3>
      <span class="user-card-level">${userData.nivel === "admin" ? "Admin" : "Operador"}</span>
    </div>
    <div class="user-card-email">${escapeHTML(userData.email)}</div>
    <div class="user-card-actions">
      <button class="btn-edit" data-action="edit-user" data-id="${docId}">Editar</button>
      <button class="btn-danger" data-action="delete-user" data-id="${docId}" data-name="${escapeHTML(userData.nome)}">Excluir</button>
    </div>
  `;
  return card;
}

// MELHORIA: Delegação de eventos para gerenciar usuários
usersGrid.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const userId = target.dataset.id;

    if (action === 'edit-user') {
        editarUsuario(userId);
    } else if (action === 'delete-user') {
        const userName = target.dataset.name;
        excluirUsuario(userId, userName);
    }
});

async function editarUsuario(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            formUserEdit.reset();
            formUserEdit.editUserId.value = userId;
            formUserEdit.editUserName.value = userData.nome || "";
            formUserEdit.editUserEmail.value = userData.email || "";
            formUserEdit.editUserLevel.value = userData.nivel || "operador";
            modalUserEdit.style.display = "block";
        } else {
            alert("Erro: Usuário não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar usuário para edição:", error);
    }
}

function excluirUsuario(userId, userName) {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\nESTA AÇÃO É IRREVERSÍVEL.`)) return;

    /*********************************************************************************
     * ALERTA DE SEGURANÇA: EXCLUSÃO DE USUÁRIO                                     *
     * -------------------------------------------------------------------------    *
     * A exclusão completa de um usuário (Firestore + Authentication) não pode      *
     * ser feita de forma segura diretamente do cliente (navegador).                *
     * *
     * SOLUÇÃO CORRETA: Use uma Firebase Cloud Function.                            *
     * 1. O botão abaixo apenas deleta o registro do Firestore.                     *
     * 2. Crie uma Cloud Function (em Node.js) que é acionada "onDelete" na         *
     * coleção /users.                                                           *
     * 3. Dentro da função, use o Firebase Admin SDK para deletar o usuário da      *
     * autenticação: `admin.auth().deleteUser(userId)`                           *
     * *
     * Isso garante que, ao deletar do banco, a conta de autenticação também é      *
     * removida de forma segura no backend. Sem isso, o usuário "fantasma" ainda    *
     * existirá e poderá tentar logar.                                              *
     *********************************************************************************/

    // Passo 1: Deletar do Firestore (acionará a Cloud Function)
    deleteDoc(doc(db, "users", userId))
        .then(() => {
            alert("Usuário removido do banco de dados. A conta de autenticação será removida em segundo plano.");
            carregarUsuarios(); // Atualiza a UI
        })
        .catch(error => {
            console.error("Erro ao remover usuário do Firestore:", error);
            alert("Falha ao remover usuário.");
        });
}

// Formulário para criar novo usuário
formUserCreate.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById("user-create-message");
    toggleButtonLoading(button, true);
    messageDiv.textContent = "";
  
    const name = formUserCreate.userName.value;
    const email = formUserCreate.userEmail.value;
    const password = formUserCreate.userPassword.value;
    const level = formUserCreate.userLevel.value;
  
    try {
      // Cria o usuário na Autenticação
      const userCredential = await createUserWithEmail(email, password);
      const user = userCredential.user;
  
      // Salva informações no Firestore usando o UID como ID do documento
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        nome: name,
        email: email,
        nivel: level,
        criadoEm: serverTimestamp(),
        criadoPor: currentUser.uid,
      });

      // Atualiza o cache de nomes
      usersNameCache[user.uid] = name;
  
      messageDiv.textContent = "Usuário criado com sucesso!";
      messageDiv.style.color = "green";
      
      setTimeout(() => {
        modalUserCreate.style.display = "none";
        carregarUsuarios();
      }, 1500);

    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      messageDiv.textContent = `Erro: ${error.message}`;
      messageDiv.style.color = "red";
    } finally {
      toggleButtonLoading(button, false);
    }
});
  
// Formulário para editar usuário existente
formUserEdit.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById("user-edit-message");
    toggleButtonLoading(button, true);
    messageDiv.textContent = "";

    const docId = formUserEdit.editUserId.value;
    const name = formUserEdit.editUserName.value;
    const level = formUserEdit.editUserLevel.value;

    try {
        const userRef = doc(db, "users", docId);
        await updateDoc(userRef, {
            nome: name,
            nivel: level,
            atualizadoEm: serverTimestamp(),
            atualizadoPor: currentUser.uid,
        });

        // Atualiza o cache de nomes
        usersNameCache[docId] = name;

        messageDiv.textContent = "Usuário atualizado com sucesso!";
        messageDiv.style.color = "green";
        
        setTimeout(() => {
            modalUserEdit.style.display = "none";
            carregarUsuarios();
            carregarCards(); // Recarrega os cards caso o nome de um criador tenha mudado
        }, 1500);

    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        messageDiv.textContent = `Erro: ${error.message}`;
        messageDiv.style.color = "red";
    } finally {
        toggleButtonLoading(button, false);
    }
});

// =================================================================================
//  FUNÇÕES UTILITÁRIAS
// =================================================================================

async function carregarNomesUsuarios() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach(doc => {
      usersNameCache[doc.id] = doc.data().nome; // UID -> Nome
    });
  } catch (error) {
    console.error("Erro ao carregar nomes de usuários:", error);
  }
}

function toggleButtonLoading(button, isLoading, loadingText = "") {
    if (isLoading) {
        button.classList.add("loading");
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        if (loadingText) button.innerHTML = loadingText;
    } else {
        button.classList.remove("loading");
        button.disabled = false;
        if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
    }
}

function escapeHTML(str) {
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}

function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
