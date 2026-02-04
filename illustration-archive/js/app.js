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
    renderTagManager();
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
    renderTagManager();
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
  renderTagManager();
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