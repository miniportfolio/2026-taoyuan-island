/* search-index.js — 搜尋索引側欄（區塊 #13，抽自桃園政策島）
 * 一個搜尋框＋一份清單：打字即時篩選，點清單項目就呼叫你的函式（例如跳到那一頁、那座島）。
 * 搜尋不分大小寫、比對你指定的所有文字欄位。
 * 不依賴任何其他檔案。清單樣式由 App 的 CSS 決定。用法見 docs/search-index-使用說明.md
 */
(function (global) {
  "use strict";

  // opts.input     搜尋框 <input>（可省略，省略就只能用 render(q) 手動篩選）
  // opts.list      放清單的元素
  // opts.items()   回傳要列出的資料陣列（用函式，資料更新後重畫就會反映）
  // opts.text(item)  回傳要被搜尋的文字（字串或字串陣列）
  // opts.row(item)   回傳一列的 HTML；可點的元素要帶 data-id
  // opts.empty(q)    找不到時顯示的 HTML（預設「找不到符合「q」的結果。」）
  // opts.onPick(id, el)  點了某一列
  // opts.rowSelector 可點元素的選擇器（預設 "[data-id]"）
  function create(opts) {
    var sel = opts.rowSelector || "[data-id]";
    var empty = opts.empty || function (q) { return '<p class="empty">找不到符合「' + q + "」的結果。</p>"; };

    function textOf(item) {
      var t = opts.text(item);
      return (Array.isArray(t) ? t.join(" ") : String(t)).toLowerCase();
    }

    function render(q) {
      q = (q || "").trim().toLowerCase();
      var L = opts.items().filter(function (i) { return !q || textOf(i).includes(q); });
      opts.list.innerHTML = L.length ? L.map(opts.row).join("") : empty(q);
      opts.list.querySelectorAll(sel).forEach(function (el) {
        el.onclick = function () { opts.onPick && opts.onPick(el.dataset.id, el); };
      });
      return L;
    }

    // 用目前搜尋框的字重畫（資料或完成狀態改變時呼叫）
    function refresh() { return render(opts.input ? opts.input.value : ""); }

    if (opts.input) opts.input.addEventListener("input", function (e) { render(e.target.value); });

    return { render: render, refresh: refresh };
  }

  global.SearchIndex = { create: create };
})(window);
