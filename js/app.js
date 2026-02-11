/* ============================
   IndexedDB 初期化
============================ */
let db;
let items = [];
let activeTag = null;
let activeAuthor = null;
let currentItem = null;
let modalMode = "view";

let categories = [];          // {id, name, color}
let tagCategoryList = [];     // {tag, categoryId, priority}
let tagCategoryMap = {};      // tag -> {categoryId, priority}

const DB_VERSION = 3;

const req = indexedDB.open("artDB", DB_VERSION);

req.onupgradeneeded = e => {
  db = e.target.result;

  if (!db.objectStoreNames.contains("arts")) {
    db.createObjectStore("arts", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("categories")) {
    db.createObjectStore("categories", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("tagCategories")) {
    db.createObjectStore("tagCategories", { keyPath: "tag" });
  }
};

req.onsuccess = e => {
  db = e.target.result;

  const importBtn = document.getElementById("importBtn");
  if (importBtn) importBtn.disabled = false;

  loadAll();
  loadCategories();
  loadTagCategories();
};

req.onerror = e => {
  console.error("IndexedDB error", e.target.error);
};

/* ============================
   DB 読み込み
============================ */
function loadAll() {
  const tx = db.transaction("arts", "readonly");
  tx.objectStore("arts").getAll().onsuccess = e => {
    items = e.target.result || [];
    render();
  };
}

function loadCategories() {
  const tx = db.transaction("categories", "readonly");
  tx.objectStore("categories").getAll().onsuccess = e => {
    categories = e.target.result || [];
    renderTags();
    renderModalTagsView();
    renderModalTagsEdit();
    renderTagManager && renderTagManager();
  };
}

function loadTagCategories() {
  const tx = db.transaction("tagCategories", "readonly");
  tx.objectStore("tagCategories").getAll().onsuccess = e => {
    tagCategoryList = e.target.result || [];
    rebuildTagCategoryMap();
    renderTags();
    renderModalTagsView();
    renderModalTagsEdit();
    renderTagManager && renderTagManager();
  };
}

function rebuildTagCategoryMap() {
  tagCategoryMap = {};
  tagCategoryList.forEach(tc => {
    tagCategoryMap[tc.tag] = {
      categoryId: tc.categoryId || null,
      priority: typeof tc.priority === "number" ? tc.priority : 0
    };
  });
}

/* ============================
   DB 書き込み
============================ */
function saveItem(item) {
  const tx = db.transaction("arts", "readwrite");
  tx.objectStore("arts").put(item);
}

function deleteItem(id) {
  const tx = db.transaction("arts", "readwrite");
  tx.objectStore("arts").delete(id);
}

/* ============================
   タブ切り替え
============================ */
const tabMain = document.getElementById("tabMain");
const tabTags = document.getElementById("tabTags");
const mainSection = document.getElementById("mainSection");
const tagManageSection = document.getElementById("tagManageSection");

tabMain.onclick = () => {
  tabMain.classList.add("active");
  tabTags.classList.remove("active");
  mainSection.style.display = "";
  tagManageSection.style.display = "none";
};

tabTags.onclick = () => {
  tabTags.classList.add("active");
  tabMain.classList.remove("active");
  mainSection.style.display = "none";
  tagManageSection.style.display = "";
  renderTagManager && renderTagManager();
};

/* ============================
   新規追加
============================ */
const imageInput = document.getElementById("imageInput");
const urlInput = document.getElementById("urlInput");
const authorInput = document.getElementById("authorInput");
const tagInput = document.getElementById("tagInput");
const sortSelect = document.getElementById("sortSelect");
const addBtn = document.getElementById("addBtn");

addBtn.onclick = addItem;

function addItem() {
  const file = imageInput.files[0];
  if (!file) return alert("画像を選択してください");

  const reader = new FileReader();
  reader.onload = () => {
    const now = new Date().toISOString();
    const tags = tagInput.value.split(",").map(t => t.trim()).filter(Boolean);

    const item = {
      id: Date.now(),
      image: reader.result,
      url: urlInput.value,
      author: authorInput.value,
      state: "",
      tags,
      favorite: false,
      createdAt: now
    };

    items.unshift(item);
    saveItem(item);

    imageInput.value = "";
    urlInput.value = "";
    authorInput.value = "";
    tagInput.value = "";

    render();
  };
  reader.readAsDataURL(file);
}

/* ============================
   タグメタ情報
============================ */
function getTagMeta(tag) {
  const meta = tagCategoryMap[tag];
  if (!meta) return { category: null, priority: 0 };

  const category = categories.find(c => c.id === meta.categoryId) || null;
  return { category, priority: meta.priority || 0 };
}

/* ============================
   タグ一覧（最近＋全タグ）
============================ */
function renderTags() {
  const recentContainer = document.getElementById("recentTags");
  const allContainer = document.getElementById("allTags");
  if (!recentContainer || !allContainer) return;

  recentContainer.innerHTML = "";
  allContainer.innerHTML = "";

  const tagLastUsed = {};
  items.forEach(item => {
    const when = item.createdAt || new Date(item.id).toISOString();
    (item.tags || []).forEach(t => {
      if (!tagLastUsed[t] || tagLastUsed[t] < when) {
        tagLastUsed[t] = when;
      }
    });
  });

  const allTagsArr = Object.keys(tagLastUsed);

  allTagsArr.sort((a, b) => {
    const ma = getTagMeta(a);
    const mb = getTagMeta(b);
    if (mb.priority !== ma.priority) return mb.priority - ma.priority;
    if (tagLastUsed[b] !== tagLastUsed[a]) return tagLastUsed[b].localeCompare(tagLastUsed[a]);
    return a.localeCompare(b);
  });

  allTagsArr.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag" + (t === activeTag ? " active" : "");
    const meta = getTagMeta(t);
    if (meta.category) {
      span.classList.add("colored");
      span.style.backgroundColor = meta.category.color;
    }
    span.textContent = t;
    span.onclick = () => {
      activeTag = (activeTag === t) ? null : t;
      activeAuthor = null;
      render();
    };
    recentContainer.appendChild(span);
  });

  const allTagsSorted = [...allTagsArr].sort((a, b) => {
    const ma = getTagMeta(a);
    const mb = getTagMeta(b);
    if (mb.priority !== ma.priority) return mb.priority - ma.priority;
    return a.localeCompare(b);
  });

  allTagsSorted.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag" + (t === activeTag ? " active" : "");
    const meta = getTagMeta(t);
    if (meta.category) {
      span.classList.add("colored");
      span.style.backgroundColor = meta.category.color;
    }
    span.textContent = t;
    span.onclick = () => {
      activeTag = (activeTag === t) ? null : t;
      activeAuthor = null;
      render();
    };
    allContainer.appendChild(span);
  });
}

/* 全タグ展開ボタン */
const toggleAllTagsBtn = document.getElementById("toggleAllTagsBtn");
const allTagsDiv = document.getElementById("allTags");
let allTagsVisible = false;

toggleAllTagsBtn.onclick = () => {
  allTagsVisible = !allTagsVisible;
  allTagsDiv.style.display = allTagsVisible ? "flex" : "none";
  toggleAllTagsBtn.textContent = allTagsVisible ? "タグ一覧 ▲" : "タグ一覧 ▼";
};

/* ============================
   一覧表示
============================ */
function render() {
  renderTags();
  renderList();
}

function renderList() {
  const container = document.getElementById("list");
  container.innerHTML = "";

  let filtered = items.filter(i =>
    (!activeTag || (i.tags || []).includes(activeTag)) &&
    (!activeAuthor || i.author === activeAuthor)
  );

  if (sortSelect.value === "dateAsc") {
    filtered = [...filtered].sort((a, b) => {
      const ta = a.createdAt || new Date(a.id).toISOString();
      const tb = b.createdAt || new Date(b.id).toISOString();
      return ta.localeCompare(tb);
    });
  } else if (sortSelect.value === "dateDesc") {
    filtered = [...filtered].sort((a, b) => {
      const ta = a.createdAt || new Date(a.id).toISOString();
      const tb = b.createdAt || new Date(b.id).toISOString();
      return tb.localeCompare(ta);
    });
  } else if (sortSelect.value === "fav") {
    filtered = [...filtered].sort((a, b) => {
      if (b.favorite !== a.favorite) return b.favorite - a.favorite;
      const ta = a.createdAt || new Date(a.id).toISOString();
      const tb = b.createdAt || new Date(b.id).toISOString();
      return tb.localeCompare(ta);
    });
  }

  filtered.forEach(i => {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    img.src = i.image;
    img.onclick = () => openModal(i);

    const author = document.createElement("div");
    author.className = "author";
    author.textContent = i.author || "";

    div.append(img, author);
    container.appendChild(div);
  });
}

/* ============================
   スクロールボタン
============================ */
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  scrollTopBtn.style.display = window.scrollY > 200 ? "block" : "none";
});

scrollTopBtn.onclick = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.getElementById("sortSelect").onchange = render;

const scrollBottomBtn = document.getElementById("scrollBottomBtn");

window.addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollBottomBtn.style.display = window.scrollY < max - 200 ? "block" : "none";
});

scrollBottomBtn.onclick = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

/* ============================
   画像モーダル（統合版）
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
  viewUrlLink.textContent = item.url || "";
  viewUrlLink.href = item.url || "#";

  editUrlInput.value = item.url || "";
  editAuthorInput.value = item.author || "";

  stateSelect.value = item.state || "";
  editStateSelect.value = item.state || "";

  renderModalTagsView();
  renderModalTagsEdit();

  replaceImageInput.value = "";

  setModalMode("view");
}

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

/* ---- ズーム・ドラッグ ---- */
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

/* ---- ダブルタップ ---- */
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

/* ---- ピンチズーム ---- */
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

/* ---- お気に入り ---- */
favBtn.onclick = () => {
  if (!currentItem) return;
  const original = items.find(i => i.id === currentItem.id);
  if (!original) return;

  original.favorite = !original.favorite;
  saveItem(original);

  favBtn.textContent = original.favorite ? "解除" : "お気に入り";
  render();
};

/* ---- 状態タグ ---- */
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

/* ---- URLボタン ---- */
openUrlBtn.onclick = () => {
  if (currentItem && currentItem.url) {
    window.open(currentItem.url, "_blank");
  }
};

/* ---- 削除 ---- */
deleteBtn.onclick = () => {
  if (!currentItem) return;
  if (confirm("削除する？")) {
    deleteItem(currentItem.id);
    items = items.filter(x => x.id !== currentItem.id);
    modal.style.display = "none";
    render();
  }
};

/* ---- 作者クリックで絞り込み ---- */
viewAuthorSpan.onclick = () => {
  if (!currentItem) return;
  if (!currentItem.author) return;

  activeAuthor = currentItem.author;
  activeTag = null;

  modal.style.display = "none";
  render();
};

/* ---- タグ（閲覧モード） ---- */
function renderModalTagsView() {
  modalTagsViewDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(tagName => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(tagName);

    span.style.backgroundColor = meta.category
      ? meta.category.color
      : "rgba(0,0,0,0.15)";

    span.textContent = tagName;
    modalTagsViewDiv.appendChild(span);
  });
}

/* ---- タグ（編集モード） ---- */
function renderModalTagsEdit() {
  modalTagsEditDiv.innerHTML = "";
  if (!currentItem || !currentItem.tags) return;

  currentItem.tags.forEach(tagName => {
    const span = document.createElement("span");
    span.className = "tag";

    const meta = getTagMeta(tagName);

    span.style.backgroundColor = meta.category
      ? meta.category.color
      : "rgba(0,0,0,0.15)";

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

/* ---- 編集保存 ---- */
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

/* ============================
   タグ / 作者選択モーダル（統合）
============================ */
const tagSelectModal = document.getElementById("tagSelectModal");
const tagSelectMode = document.getElementById("tagSelectMode");
const tagSelectSort = document.getElementById("tagSelectSort");
const tagSelectSearch = document.getElementById("tagSelectSearch");
const tagSelectList = document.getElementById("tagSelectList");
const tagSelectCancelBtn = document.getElementById("tagSelectCancelBtn");
const tagSelectApplyBtn = document.getElementById("tagSelectApplyBtn");

let tagSelectType = "tag";
let tagSelectSelected = null;

function openTagSelectModal(type) {
  tagSelectType = type;
  tagSelectSelected = null;

  tagSelectMode.value = type;
  tagSelectSearch.value = "";
  tagSelectSort.value = "priority";

  renderTagSelectList();

  tagSelectModal.style.display = "flex";
}

function closeTagSelectModal() {
  tagSelectModal.style.display = "none";
}

function renderTagSelectList() {
  tagSelectList.innerHTML = "";

  let list = [];

  if (tagSelectType === "tag") {
    const tagSet = new Set();
    items.forEach(i => (i.tags || []).forEach(t => tagSet.add(t)));
    list = [...tagSet].map(name => {
      const meta = getTagMeta(name);
      return {
        name,
        priority: meta.priority || 0,
        category: meta.category || null,
        recent: 0
      };
    });
  } else {
    list = [...new Set(items.map(i => i.author).filter(a => a))].map(a => ({
      name: a,
      priority: 0,
      category: null,
      recent: 0
    }));
  }

  const q = tagSelectSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter(x => x.name.toLowerCase().includes(q));
  }

  if (tagSelectSort.value === "priority") {
    list.sort((a, b) => b.priority - a.priority);
  } else if (tagSelectSort.value === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (tagSelectSort.value === "recent") {
    list.sort((a, b) => b.recent - a.recent);
  }

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "tag-select-row";
    div.style.padding = "6px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #333";

    div.textContent = item.name;

    if (tagSelectSelected === item.name) {
      div.style.background = "#4da3ff";
    }

    div.onclick = () => {
      tagSelectSelected = item.name;
      renderTagSelectList();
    };

    tagSelectList.appendChild(div);
  });
}

tagSelectMode.onchange = () => {
  tagSelectType = tagSelectMode.value;
  tagSelectSelected = null;
  renderTagSelectList();
};

tagSelectSort.onchange = () => {
  renderTagSelectList();
};

tagSelectSearch.oninput = () => {
  renderTagSelectList();
};

tagSelectCancelBtn.onclick = () => {
  closeTagSelectModal();
};

tagSelectApplyBtn.onclick = () => {
  if (!currentItem || !tagSelectSelected) {
    closeTagSelectModal();
    return;
  }

  if (tagSelectType === "tag") {
    if (!currentItem.tags.includes(tagSelectSelected)) {
      currentItem.tags.push(tagSelectSelected);
    }
    renderModalTagsEdit();
  } else {
    editAuthorInput.value = tagSelectSelected;
  }

  closeTagSelectModal();
};

const openTagSelectBtn = document.getElementById("openTagSelectBtn");
openTagSelectBtn.onclick = () => {
  openTagSelectModal("tag");
};
