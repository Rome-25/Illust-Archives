/* ============================
   モーダル開閉
============================ */
const modal = document.getElementById("modal");
const modalImage = document.getElementById("modalImage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

modalCloseBtn.onclick = () => {
  modal.style.display = "none";
  currentItem = null;
};

function openModal(item) {
  currentItem = JSON.parse(JSON.stringify(item));
  modal.style.display = "flex";

  setupModalImage(item.image);

  favBtn.textContent = item.favorite ? "解除" : "お気に入り";

  viewAuthorSpan.textContent = item.author || "";
  if (item.url) {
    viewUrlLink.textContent = item.url;
    viewUrlLink.href = item.url;
  } else {
    viewUrlLink.textContent = "";
    viewUrlLink.href = "#";
  }

  editUrlInput.value = item.url || "";
  editAuthorInput.value = item.author || "";

  stateSelect.value = item.state || "";
  editStateSelect.value = item.state || "";

  renderModalTagsView();
  renderModalTagsEdit();

  replaceImageInput.value = "";

  setModalMode("view");
}

/* ============================
   閲覧 / 編集モード切り替え
============================ */
const modeViewBtn = document.getElementById("modeViewBtn");
const modeEditBtn = document.getElementById("modeEditBtn");
const viewModeDiv = document.getElementById("viewMode");
const editModeDiv = document.getElementById("editMode");

function setModalMode(mode) {
  modalMode = mode;
  if (mode === "view") {
    modeViewBtn.classList.add("active");
    modeEditBtn.classList.remove("active");
    viewModeDiv.style.display = "";
    editModeDiv.style.display = "none";
  } else {
    modeEditBtn.classList.add("active");
    modeViewBtn.classList.remove("active");
    viewModeDiv.style.display = "none";
    editModeDiv.style.display = "";
  }
}

modeViewBtn.onclick = () => setModalMode("view");
modeEditBtn.onclick = () => setModalMode("edit");

/* ============================
   画像ズーム・ドラッグ
============================ */
let scale = 1, posX = 0, posY = 0;
let startX = 0, startY = 0;
let isDragging = false;

function setupModalImage(src) {
  modalImage.src = src;
  scale = 1;
  posX = 0;
  posY = 0;
  modalImage.style.transform = "translate(0px,0px) scale(1)";
}

modalImage.onmousedown = e => {
  e.preventDefault();
  isDragging = true;
  startX = e.clientX - posX;
  startY = e.clientY - posY;
  modalImage.style.cursor = "grabbing";
};

document.onmousemove = e => {
  if (!isDragging) return;
  posX = e.clientX - startX;
  posY = e.clientY - startY;
  modalImage.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
};

document.onmouseup = () => {
  isDragging = false;
  modalImage.style.cursor = "grab";
};

modalImage.ondblclick = () => {
  scale = (scale === 1 ? 2 : 1);
  modalImage.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
};

window.addEventListener("wheel", e => {
  if (modal.style.display !== "flex") return;
  if (e.ctrlKey) e.preventDefault();

  const delta = e.deltaY;
  const zoomFactor = 1.05;

  if (delta < 0) scale *= zoomFactor;
  else scale /= zoomFactor;

  scale = Math.max(0.2, Math.min(scale, 8));
  modalImage.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
}, { passive: false });

/* ============================
   お気に入り
============================ */
const favBtn = document.getElementById("favBtn");

favBtn.onclick = () => {
  if (!currentItem) return;
  const original = items.find(i => i.id === currentItem.id);
  if (!original) return;

  original.favorite = !original.favorite;
  saveItem(original);

  favBtn.textContent = original.favorite ? "解除" : "お気に入り";
  render();
};

/* ============================
   状態タグ（閲覧）
============================ */
const stateSelect = document.getElementById("stateSelect");
const editStateSelect = document.getElementById("editStateSelect");

stateSelect.onchange = () => {
  if (!currentItem) return;
  const original = items.find(i => i.id === currentItem.id);
  if (!original) return;

  original.state = stateSelect.value;
  editStateSelect.value = original.state;

  saveItem(original);
  render();
};

/* 編集モード側 */
editStateSelect.onchange = () => {
  if (!currentItem) return;
  currentItem.state = editStateSelect.value;
};

/* ============================
   URLボタン
============================ */
const openUrlBtn = document.getElementById("openUrlBtn");

openUrlBtn.onclick = () => {
  if (currentItem && currentItem.url) {
    window.open(currentItem.url, "_blank");
  }
};

/* ============================
   削除
============================ */
const deleteBtn = document.getElementById("deleteBtn");

deleteBtn.onclick = () => {
  if (!currentItem) return;
  if (confirm("削除する？")) {
    deleteItem(currentItem.id);
    items = items.filter(x => x.id !== currentItem.id);
    modal.style.display = "none";
    render();
  }
};

/* ============================
   作者クリックで絞り込み
============================ */
const viewAuthorSpan = document.getElementById("viewAuthor");

viewAuthorSpan.onclick = () => {
  if (!currentItem) return;
  if (!currentItem.author) return;

  activeAuthor = currentItem.author;
  activeTag = null;

  modal.style.display = "none";
  render();
};

/* ============================
   タグ（閲覧モード）
============================ */
const modalTagsViewDiv = document.getElementById("modalTagsView");

function renderModalTagsView() {
  if (!modalTagsViewDiv) return;
  modalTagsViewDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(t);
    if (meta.category) {
      span.classList.add("colored");
      span.style.backgroundColor = meta.category.color;
    }

    span.textContent = t;
    modalTagsViewDiv.appendChild(span);
  });
}

/* ============================
   タグ（編集モード）
============================ */
const modalTagsEditDiv = document.getElementById("modalTagsEdit");
const modalTagInput = document.getElementById("modalTagInput");

function renderModalTagsEdit() {
  if (!modalTagsEditDiv) return;
  modalTagsEditDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(t);
    if (meta.category) {
      span.classList.add("colored");
      span.style.backgroundColor = meta.category.color;
    }

    span.textContent = t + " ×";
    span.onclick = () => {
      currentItem.tags = currentItem.tags.filter(x => x !== t);
      renderModalTagsEdit();
    };

    modalTagsEditDiv.appendChild(span);
  });
}

/* 手入力でタグ追加 */
modalTagInput.onkeydown = e => {
  if (e.key === "Enter") {
    if (!currentItem) return;

    const t = modalTagInput.value.trim();
    if (t && !currentItem.tags.includes(t)) {
      currentItem.tags.push(t);
      renderModalTagsEdit();
    }
    modalTagInput.value = "";
  }
};

/* ============================
   編集保存
============================ */
const editUrlInput = document.getElementById("editUrl");
const editAuthorInput = document.getElementById("editAuthor");
const replaceImageInput = document.getElementById("replaceImageInput");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");

cancelEditBtn.onclick = () => {
  if (!currentItem) return;
  openModal(items.find(i => i.id === currentItem.id));
};

saveEditBtn.onclick = () => {
  if (!currentItem) return;

  const original = items.find(i => i.id === currentItem.id);
  if (!original) return;

  original.url = editUrlInput.value;
  original.author = editAuthorInput.value;
  original.state = currentItem.state;
  original.tags = [...currentItem.tags];

  const file = replaceImageInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      original.image = reader.result;
      saveItem(original);
      modal.style.display = "none";
      render();
    };
    reader.readAsDataURL(file);
  } else {
    saveItem(original);
    modal.style.display = "none";
    render();
  }
};