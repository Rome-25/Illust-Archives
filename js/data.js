/* ============================
   データ管理モーダル
============================ */
const dataBtn = document.getElementById("dataBtn");
const dataModal = document.getElementById("dataModal");
const dataModalCloseBtn = document.getElementById("dataModalCloseBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");

dataBtn.onclick = () => {
  dataModal.style.display = "flex";
};

dataModalCloseBtn.onclick = () => {
  dataModal.style.display = "none";
};

dataModal.addEventListener("click", e => {
  if (e.target === dataModal) dataModal.style.display = "none";
});

/* ============================
   エクスポート
============================ */
exportBtn.onclick = () => {
  const tx1 = db.transaction("arts", "readonly");
  tx1.objectStore("arts").getAll().onsuccess = e1 => {
    const arts = e1.target.result || [];

    const tx2 = db.transaction("categories", "readonly");
    tx2.objectStore("categories").getAll().onsuccess = e2 => {
      const cats = e2.target.result || [];

      const tx3 = db.transaction("tagCategories", "readonly");
      tx3.objectStore("tagCategories").getAll().onsuccess = e3 => {
        const tagCats = e3.target.result || [];

        const dump = {
          exportedAt: new Date().toISOString(),
          arts,
          categories: cats,
          tagCategories: tagCats
        };

        const json = JSON.stringify(dump, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `art-archive-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };
    };
  };
};

/* ============================
   インポート開始
============================ */
importBtn.onclick = () => {
  importInput.value = "";
  importInput.click();
};

importInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      showImportChoice(data);
    } catch (err) {
      alert("JSON の読み込みに失敗しました");
    }
  };
  reader.readAsText(file);
};

/* ============================
   上書き or マージ選択
============================ */
function showImportChoice(data) {
  const mode = confirm("OK → 上書き\nキャンセル → マージ");
  if (mode) importOverwrite(data);
  else importMerge(data);
}

/* ============================
   上書きインポート
============================ */
function importOverwrite(data) {
  if (!confirm("現在のデータを完全に上書きします。続行しますか？")) return;

  const arts = data.arts || [];
  const cats = data.categories || [];
  const tagCats = data.tagCategories || [];

  const tx = db.transaction(["arts","categories","tagCategories"], "readwrite");
  const artsStore = tx.objectStore("arts");
  const catsStore = tx.objectStore("categories");
  const tagCatsStore = tx.objectStore("tagCategories");

  artsStore.clear();
  catsStore.clear();
  tagCatsStore.clear();

  arts.forEach(a => artsStore.put(a));
  cats.forEach(c => catsStore.put(c));
  tagCats.forEach(t => tagCatsStore.put(t));

  tx.oncomplete = () => {
    alert("上書きインポートが完了しました");
    loadAll();
    loadCategories();
    loadTagCategories();
  };
}

/* ============================
   マージインポート
============================ */
function importMerge(data) {
  const arts = data.arts || [];
  const cats = data.categories || [];
  const tagCats = data.tagCategories || [];

  const tx = db.transaction(["arts","categories","tagCategories"], "readwrite");
  const artsStore = tx.objectStore("arts");
  const catsStore = tx.objectStore("categories");
  const tagCatsStore = tx.objectStore("tagCategories");

  /* arts: id が無ければ追加 */
  arts.forEach(a => {
    const exists = items.some(x => x.id === a.id);
    if (!exists) artsStore.put(a);
  });

  /* categories: id が無ければ追加 */
  cats.forEach(c => {
    const exists = categories.some(x => x.id === c.id);
    if (!exists) catsStore.put(c);
  });

  /* tagCategories: tag が無ければ追加 */
  tagCats.forEach(t => {
    const exists = tagCategoryList.some(x => x.tag === t.tag);
    if (!exists) tagCatsStore.put(t);
  });

  tx.oncomplete = () => {
    alert("マージインポートが完了しました");
    loadAll();
    loadCategories();
    loadTagCategories();
  };
}