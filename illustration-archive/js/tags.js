/* ============================
   分類追加
============================ */
const addCategoryBtn = document.getElementById("addCategoryBtn");
const newCategoryName = document.getElementById("newCategoryName");
const newCategoryColor = document.getElementById("newCategoryColor");

addCategoryBtn.onclick = () => {
  const name = newCategoryName.value.trim();
  const color = newCategoryColor.value;

  if (!name) return alert("分類名を入力してください");

  const cat = {
    id: Date.now(),
    name,
    color
  };

  const tx = db.transaction("categories", "readwrite");
  tx.objectStore("categories").put(cat);

  categories.push(cat);

  newCategoryName.value = "";
  renderTagManager();
  renderTags();
};

/* ============================
   分類更新
============================ */
function updateCategory(cat) {
  const tx = db.transaction("categories", "readwrite");
  tx.objectStore("categories").put(cat);

  renderTags();
  renderTagManager();
}

/* ============================
   分類削除
============================ */
function deleteCategory(id) {
  if (!confirm("この分類を削除しますか？")) return;

  const tx = db.transaction("categories", "readwrite");
  tx.objectStore("categories").delete(id);

  categories = categories.filter(c => c.id !== id);

  // この分類に紐づいていたタグの categoryId を解除
  tagCategoryList.forEach(tc => {
    if (tc.categoryId === id) tc.categoryId = null;
  });

  const tx2 = db.transaction("tagCategories", "readwrite");
  tagCategoryList.forEach(tc => tx2.objectStore("tagCategories").put(tc));

  rebuildTagCategoryMap();
  renderTagManager();
  renderTags();
}

/* ============================
   タグに分類を設定
============================ */
function setTagCategory(tag, categoryId) {
  let tc = tagCategoryList.find(x => x.tag === tag);
  if (!tc) {
    tc = { tag, categoryId, priority: 0 };
    tagCategoryList.push(tc);
  } else {
    tc.categoryId = categoryId;
  }

  const tx = db.transaction("tagCategories", "readwrite");
  tx.objectStore("tagCategories").put(tc);

  rebuildTagCategoryMap();
  renderTags();
  renderTagManager();
}

/* ============================
   タグに優先度を設定
============================ */
function setTagPriority(tag, priority) {
  let tc = tagCategoryList.find(x => x.tag === tag);
  if (!tc) {
    tc = { tag, categoryId: null, priority };
    tagCategoryList.push(tc);
  } else {
    tc.priority = priority;
  }

  const tx = db.transaction("tagCategories", "readwrite");
  tx.objectStore("tagCategories").put(tc);

  rebuildTagCategoryMap();
  renderTags();
  renderTagManager();
}

/* ============================
   タグ管理画面の描画
============================ */
function renderTagManager() {
  const catList = document.getElementById("categoryList");
  const tagList = document.getElementById("tagManageList");
  if (!catList || !tagList) return;

  /* ---- 分類一覧 ---- */
  catList.innerHTML = "";
  categories.forEach(cat => {
    const row = document.createElement("div");
    row.className = "category-row";

    const color = document.createElement("input");
    color.type = "color";
    color.value = cat.color;
    color.onchange = () => {
      cat.color = color.value;
      updateCategory(cat);
    };

    const name = document.createElement("input");
    name.type = "text";
    name.value = cat.name;
    name.onchange = () => {
      cat.name = name.value.trim();
      updateCategory(cat);
    };

    const del = document.createElement("button");
    del.textContent = "削除";
    del.className = "btn-sm";
    del.onclick = () => deleteCategory(cat.id);

    row.append(color, name, del);
    catList.appendChild(row);
  });

  /* ---- タグ一覧 ---- */
  tagList.innerHTML = "";
  const allTags = [...new Set(items.flatMap(i => i.tags || []))].sort();

  allTags.forEach(tag => {
    const row = document.createElement("div");
    row.className = "tag-manage-row";

    const dot = document.createElement("div");
    dot.className = "tag-color-dot";

    const meta = getTagMeta(tag);
    if (meta.category) {
      dot.style.backgroundColor = meta.category.color;
    } else {
      dot.style.backgroundColor = "#fff";
    }

    const label = document.createElement("span");
    label.textContent = tag;

    /* 分類選択 */
    const selectCat = document.createElement("select");
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "分類なし";
    selectCat.appendChild(optNone);

    categories.forEach(c => {
      const op = document.createElement("option");
      op.value = String(c.id);
      op.textContent = c.name;
      selectCat.appendChild(op);
    });

    if (meta.category) selectCat.value = String(meta.category.id);
    else selectCat.value = "";

    selectCat.onchange = () => {
      const val = selectCat.value;
      const cid = val ? Number(val) : null;
      setTagCategory(tag, cid);
    };

    /* 優先度 */
    const selectPri = document.createElement("select");
    const priOptions = [
      { v: "0", label: "優先度なし" },
      { v: "1", label: "⭐︎" },
      { v: "2", label: "⭐︎⭐︎" },
      { v: "3", label: "⭐︎⭐︎⭐︎" }
    ];
    priOptions.forEach(p => {
      const op = document.createElement("option");
      op.value = p.v;
      op.textContent = p.label;
      selectPri.appendChild(op);
    });

    selectPri.value = String(meta.priority || 0);
    selectPri.onchange = () => {
      const p = Number(selectPri.value);
      setTagPriority(tag, p);
    };

    row.append(dot, label, selectCat, selectPri);
    tagList.appendChild(row);
  });
}