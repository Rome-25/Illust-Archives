/* ============================
   要素参照（最上部に集約）
============================ */
const modal = document.getElementById("modal");
const modalImage = document.getElementById("modalImage");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");

const modeViewBtn = document.getElementById("modeViewBtn");
const modeEditBtn = document.getElementById("modeEditBtn");
const viewModeDiv = document.getElementById("viewMode");
const editModeDiv = document.getElementById("editMode");

const favBtn = document.getElementById("favBtn");
const stateSelect = document.getElementById("stateSelect");
const editStateSelect = document.getElementById("editStateSelect");

const openUrlBtn = document.getElementById("openUrlBtn");
const deleteBtn = document.getElementById("deleteBtn");

const viewAuthorSpan = document.getElementById("viewAuthor");
const viewUrlLink = document.getElementById("viewUrl");

const modalTagsViewDiv = document.getElementById("modalTagsView");
const modalTagsEditDiv = document.getElementById("modalTagsEdit");
const modalTagInput = document.getElementById("modalTagInput");

const editUrlInput = document.getElementById("editUrl");
const editAuthorInput = document.getElementById("editAuthor");
const replaceImageInput = document.getElementById("replaceImageInput");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");

/* ============================
   モーダル開閉
============================ */
modalCloseBtn.onclick = () => {
  modal.style.display = "none";
  currentItem = null;
};

/* ---- ズームリセット（存在チェック付き） ---- */
if (zoomResetBtn) {
  zoomResetBtn.onclick = () => {
    scale = 1;
    posX = 0;
    posY = 0;
    applyTransform();
  };
}

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
function setModalMode(mode) {
  modalMode = mode;
  if (mode === "view") {
    modeViewBtn.classList.add("active");
    modeEditBtn.classList.remove("active");
    viewModeDiv.style.display = "";
    editModeDiv.style.display = "none";
  } else {
    modeEditBtn.classList.add("active");
    modeViewDiv.classList.remove("active");
    viewModeDiv.style.display = "none";
    editModeDiv.style.display = "";
  }
}

modeViewBtn.onclick = () => setModalMode("view");
modeEditBtn.onclick = () => setModalMode("edit");

/* ============================
   画像ズーム（PC + iOS）
============================ */
let scale = 1, posX = 0, posY = 0;
let startX = 0, startY = 0;
let isDragging = false;

function applyTransform() {
  modalImage.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
}

function setupModalImage(src) {
  modalImage.src = src;
  scale = 1;
  posX = 0;
  posY = 0;
  applyTransform();
}

/* ---- PCドラッグ ---- */
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
  applyTransform();
};

document.onmouseup = () => {
  isDragging = false;
  modalImage.style.cursor = "grab";
};

/* ---- ダブルタップ（位置基準） ---- */
let lastTap = 0;
modalImage.addEventListener("touchend", e => {
  const now = Date.now();
  if (now - lastTap < 250) {
    const t = e.changedTouches[0];
    const rect = modalImage.getBoundingClientRect();

    const tapX = t.clientX - rect.left;
    const tapY = t.clientY - rect.top;

    const newScale = scale * 1.8;

    posX -= (tapX - posX) * (newScale / scale - 1);
    posY -= (tapY - posY) * (newScale / scale - 1);

    scale = newScale;
    applyTransform();
  }
  lastTap = now;
});

/* ---- ピンチズーム（iOS対応） ---- */
let lastDist = 0;
let lastCenter = { x: 0, y: 0 };

modalImage.addEventListener("touchstart", e => {
  if (e.touches.length === 2) {
    const [t1, t2] = e.touches;
    lastDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    lastCenter = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
  }
});

modalImage.addEventListener("touchmove", e => {
  if (e.touches.length === 2) {
    e.preventDefault();

    const [t1, t2] = e.touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const center = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };

    const deltaScale = dist / lastDist;
    scale *= deltaScale;

    posX += (center.x - lastCenter.x) * (1 - 1 / deltaScale);
    posY += (center.y - lastCenter.y) * (1 - 1 / deltaScale);

    lastDist = dist;
    lastCenter = center;

    applyTransform();
  }
}, { passive: false });

/* ---- ホイールズーム ---- */
window.addEventListener("wheel", e => {
  if (modal.style.display !== "flex") return;
  if (e.ctrlKey) e.preventDefault();

  const delta = e.deltaY;
  const zoomFactor = 1.05;

  if (delta < 0) scale *= zoomFactor;
  else scale /= zoomFactor;

  scale = Math.max(0.2, Math.min(scale, 8));
  applyTransform();
}, { passive: false });

/* ============================
   お気に入り
============================ */
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
   状態タグ
============================ */
stateSelect.onchange = () => {
  if (!currentItem) return;
  const original = items.find(i => i.id === currentItem.id);
  if (!original) return;

  original.state = stateSelect.value;
  editStateSelect.value = original.state;

  saveItem(original);
  render();
};

editStateSelect.onchange = () => {
  if (!currentItem) return;
  currentItem.state = editStateSelect.value;
};

/* ============================
   URLボタン
============================ */
openUrlBtn.onclick = () => {
  if (currentItem && currentItem.url) {
    window.open(currentItem.url, "_blank");
  }
};

/* ============================
   削除
============================ */
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
function renderModalTagsView() {
  modalTagsViewDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(tagName => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(tagName);

    if (meta.category) {
      span.style.backgroundColor = meta.category.color;
    } else {
      span.style.backgroundColor = "rgba(0,0,0,0.15)";
    }

    span.textContent = tagName;
    modalTagsViewDiv.appendChild(span);
  });
}

/* ============================
   タグ（編集モード）
============================ */
function renderModalTagsEdit() {
  modalTagsEditDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(tagName => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(tagName);

    if (meta.category) {
      span.style.backgroundColor = meta.category.color;
    } else {
      span.style.backgroundColor = "rgba(0,0,0,0.15)";
    }

    span.textContent = tagName + " ×";
    span.onclick = () => {
      currentItem.tags = currentItem.tags.filter(x => x !== tagName);
      renderModalTagsEdit();
    };

    modalTagsEditDiv.appendChild(span);
  });
}

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
