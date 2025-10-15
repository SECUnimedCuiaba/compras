// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // ALTERADO: Adicionado query e orderBy

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
const db = getFirestore(app);

// ---- CONFIGURAÇÃO DAS ETAPAS ----
const etapas = [
  { id: 1, nome: "Criar pedido de compras", cor: "#faa872ff" },
  { id: 2, nome: "Pedido Feito - Enviar para gestor aprovar", cor: "#cce5ff" },
  { id: 3, nome: "Com gestores — aguardando aprovação", cor: "#d6d8d9" },
  { id: 4, nome: "Aprovada — enviar ao Compras", cor: "#fff3cd" },
  { id: 5, nome: "Enviado ao Compras — aguardando orçamento", cor: "#e2e3e5" },
  { id: 6, nome: "Retorno do Compras para validação", cor: "#d4edda" },
  { id: 7, nome: "Validado - Aguardando Ordem de Compra", cor: "#f8d7da" },
  { id: 8, nome: "Ordem de Compra Emitida. Aguardando Material", cor: "#ffeeba" },
  { id: 9, nome: "Processo encerrado", cor: "#c3e6cb" }
];

const kanban = document.getElementById("kanban");
const loader = document.getElementById("loader");
const modalCreate = document.getElementById("modalCreate");
const modalEdit = document.getElementById("modalEdit");
const formCreate = document.getElementById("formCreate");
const formEdit = document.getElementById("formEdit");
const closeModals = document.querySelectorAll(".close");

// ---- CRIA AS COLUNAS AUTOMATICAMENTE ----
etapas.forEach(etapa => {
  const col = document.createElement("div");
  col.className = "column";
  col.dataset.id = etapa.id;
  col.style.backgroundColor = etapa.cor;
  const title = document.createElement("h2");
  title.textContent = etapa.nome;
  const cardsContainer = document.createElement("div");
  cardsContainer.className = "cards";
  col.appendChild(title);
  col.appendChild(cardsContainer);
  kanban.appendChild(col);
});

// ---- CARREGAMENTO INICIAL E REAL-TIME ----
let unsubscribe;
function carregarCards() {
  loader.style.display = "flex";
  
  // ALTERADO: Criada uma query que ordena os cards.
  // Os mais antigos por 'ultimaAtualizacao' vêm primeiro.
  // Os cards sem atualização (null) são tratados como mais recentes pelo Firestore.
  // A ordenação secundária por 'criadoEm' garante consistência.
  const solicitacoesRef = collection(db, "solicitacoes");
  const q = query(solicitacoesRef, orderBy("ultimaAtualizacao", "asc"), orderBy("criadoEm", "asc"));
  
  unsubscribe = onSnapshot(q, (querySnapshot) => {
    document.querySelectorAll(".cards").forEach(cards => cards.innerHTML = "");
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const card = criarCard(data, docSnapshot.id);
      adicionarCardNaEtapa(data.etapa, card, docSnapshot.id);
    });
    
    loader.style.display = "none";
  }, (error) => {
    console.error("Erro ao carregar: ", error);
    loader.textContent = "Erro ao carregar dados.";
    loader.style.display = "flex";
  });
}
carregarCards();

// ---- MODAL DE CRIAÇÃO ----
document.getElementById("novoCard").addEventListener("click", () => {
  modalCreate.style.display = "block";
  document.getElementById("titulo").focus();
});

formCreate.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = document.getElementById("titulo").value.trim();
  if (!titulo) return alert("Título é obrigatório!");

  const os = document.getElementById("os").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const responsavel = document.getElementById("responsavel").value.trim() || "Não definido";

  try {
    await addDoc(collection(db, "solicitacoes"), {
      titulo,
      os,
      descricao,
      responsavel,
      etapa: 1,
      criadoEm: serverTimestamp(),
      status: "Pendente",
      ultimaAtualizacao: null, 
      responsavelAtualizacao: null 
    });
    modalCreate.style.display = "none";
    formCreate.reset();
    document.getElementById("responsavel").value = "Não definido";
  } catch (error) {
    console.error("Erro ao criar card: ", error);
    alert("Erro ao salvar. Tente novamente.");
  }
});

// ---- MODAL DE EDIÇÃO ----
closeModals.forEach(close => close.addEventListener("click", () => {
  modalCreate.style.display = "none";
  modalEdit.style.display = "none";
}));

window.addEventListener("click", (e) => {
  if (e.target === modalCreate) modalCreate.style.display = "none";
  if (e.target === modalEdit) modalEdit.style.display = "none";
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    modalCreate.style.display = "none";
    modalEdit.style.display = "none";
  }
});

formEdit.addEventListener("submit", async (e) => {
  e.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const titulo = document.getElementById("editTitulo").value.trim();
  if (!titulo) return alert("Título é obrigatório!");

  const os = document.getElementById("editOs").value.trim();
  const descricao = document.getElementById("editDescricao").value.trim();
  const responsavel = document.getElementById("editResponsavel").value.trim() || "Não definido";

  try {
    // ALTERADO: Lógica para pegar usuário (preparada para o futuro)
    // --- INÍCIO: Esboço para pegar usuário logado ---
    // const user = firebase.auth().currentUser; // Exemplo de como pegar o usuário no futuro
    // const responsavelAtualizacao = user ? user.displayName : "Não identificado";
    // --- FIM: Esboço ---
    const responsavelAtualizacao = "Não identificado"; // Fallback para desenvolvimento

    const solicitacaoRef = doc(db, "solicitacoes", docId);
    await updateDoc(solicitacaoRef, {
      titulo,
      os,
      descricao,
      responsavel,
      ultimaAtualizacao: serverTimestamp(),
      responsavelAtualizacao: responsavelAtualizacao
    });
    modalEdit.style.display = "none";
    formEdit.reset();
  } catch (error) {
    console.error("Erro ao editar card: ", error);
    alert("Erro ao salvar alterações. Tente novamente.");
  }
});

// ---- FUNÇÃO PARA ABRIR EDIÇÃO ----
function abrirEdicao(data, docId) {
  document.getElementById("editDocId").value = docId;
  document.getElementById("editTitulo").value = data.titulo;
  document.getElementById("editOs").value = data.os || "";
  document.getElementById("editDescricao").value = data.descricao || "";
  document.getElementById("editResponsavel").value = data.responsavel || "Não definido";
  modalEdit.style.display = "block";
  document.getElementById("editTitulo").focus();
}

// ---- FUNÇÕES AUXILIARES ----
// NOVO: Função para validar se uma string é uma URL
function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function criarCard(data, docId) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  card.dataset.docId = docId;

  const opcoesData = { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric' };
  const opcoesHora = { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' };
  
  const dataCriacao = data.criadoEm ? data.criadoEm.toDate().toLocaleDateString('pt-BR', opcoesData) : 'N/D';
  let infoAtualizacao = '';
  if (data.ultimaAtualizacao) {
    const dataAtt = data.ultimaAtualizacao.toDate();
    const dataFormatada = dataAtt.toLocaleDateString('pt-BR', opcoesData);
    const horaFormatada = dataAtt.toLocaleTimeString('pt-BR', opcoesHora);
    infoAtualizacao = `
      <strong>Última Atualização:</strong> ${dataFormatada} às ${horaFormatada}<br>
      <strong>Atualizado por:</strong> ${data.responsavelAtualizacao || 'N/D'}<br>
    `;
  }
  
  // ALTERADO: Lógica para criar o campo OS com botão de link condicional
  let osHtml = '';
  if (data.os) {
    osHtml += `<div class="os-container">`;
   // osHtml += `<p><strong>OS:</strong></p>`;
    if (isUrl(data.os)) {
      osHtml += `<a href="${data.os}" target="_blank" rel="noopener noreferrer" class="os-link-btn" title="Abrir link">Abrir OS</a>`;
    }
    osHtml += `</div>`;
  }

  let html = `
    <h3>${data.titulo}</h3>
    ${osHtml}
    <p>${data.descricao || ""}</p>
    <div class="info">
      <strong>Responsável:</strong> ${data.responsavel}<br>
      <strong>Criado em:</strong> ${dataCriacao}<br>
      ${infoAtualizacao}
      <strong>Status:</strong> ${data.status || "Pendente"}
    </div>
  `;

  if (data.etapa === 1) {
    html += `<button class="edit-btn" title="Editar">✏️</button>`;
  }
  card.innerHTML = html;

  const editBtn = card.querySelector(".edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirEdicao(data, docId);
    });
  }
  return card;
}

function adicionarCardNaEtapa(idEtapa, card, docId) {
  const col = document.querySelector(`.column[data-id="${idEtapa}"] .cards`);
  if (col) col.appendChild(card);
}

// ---- DRAG AND DROP ----
let draggedCard = null;

kanban.addEventListener("dragstart", (e) => {
  if (e.target.classList.contains("card")) {
    draggedCard = e.target;
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  }
});

kanban.addEventListener("dragend", (e) => {
  if (draggedCard) {
    setTimeout(() => { draggedCard.style.opacity = '1'; draggedCard = null; }, 0);
  }
});

kanban.addEventListener("dragover", e => e.preventDefault());

kanban.addEventListener("drop", async (e) => {
  e.preventDefault();
  const column = e.target.closest('.column');
  if (column && draggedCard) {
    const docId = draggedCard.dataset.docId;
    const novaEtapa = parseInt(column.dataset.id);

    // ALTERADO: Lógica para pegar usuário (preparada para o futuro)
    const responsavelAtualizacao = "Não identificado"; // Fallback para desenvolvimento

    column.querySelector(".cards").appendChild(draggedCard);

    try {
      const solicitacaoRef = doc(db, "solicitacoes", docId);
      await updateDoc(solicitacaoRef, { 
        etapa: novaEtapa,
        ultimaAtualizacao: serverTimestamp(),
        responsavelAtualizacao: responsavelAtualizacao
      });
    } catch (error) {
      console.error("Erro ao mover card: ", error);
      alert("Erro ao mover o card. A página será atualizada para garantir a consistência.");
      window.location.reload();
    }
  }
});

// Limpa listener
window.addEventListener("beforeunload", () => {
  if (unsubscribe) unsubscribe();
});
