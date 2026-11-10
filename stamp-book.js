/* stamp-book.js — 集章護照（區塊 #9 的非 3D 部分，抽自桃園政策島）
 * 兩件事：
 *   1. 進度與集滿觸發：算已蓋幾個章、集滿時只觸發一次獎勵（例如發證書）
 *   2. 蓋章本畫面：一格一格的章（✓／未蓋），可分區、可藏起未解鎖的名稱
 * 資料存在哪、獎勵是什麼由 App 決定。樣式沿用 App 的 .ph3 / .stps / .stp。用法見 docs/stamp-book-使用說明.md
 */
(function (global) {
  "use strict";

  // opts.count()     目前蓋了幾個章
  // opts.total()     總共幾個章
  // opts.isClaimed() 集滿獎勵是否已經給過（存在 App 的存檔裡）
  // opts.claim()     標記為已給過（App 自己存檔）
  // opts.onComplete() 第一次集滿時呼叫
  function create(opts) {
    function count() { return opts.count(); }
    function total() { return opts.total(); }
    function complete() { return count() === total(); }
    // 每次蓋章後呼叫；集滿且還沒給過獎勵 → 標記並呼叫 onComplete
    function check() {
      if (complete() && !opts.isClaimed()) {
        opts.claim();
        opts.onComplete && opts.onComplete();
        return true;
      }
      return false;
    }
    return { count: count, total: total, complete: complete, check: check };
  }

  // 一格章：on 是否已蓋、text 名稱、sub 小字（可省略）
  function stamp(on, text, sub) {
    return '<div class="stp ' + (on ? "on" : "") + '"><i>' + (on ? "✓" : "") + "</i><b>" + text + "</b>" +
      (sub ? "<small>" + sub + "</small>" : "") + "</div>";
  }

  // 一區：標題＋一排章。cell(item) 回傳 [on, text, sub]
  function section(title, items, cell) {
    return '<h3 class="ph3">' + title + '</h3><div class="stps">' +
      items.map(function (it) { var c = cell(it); return stamp(c[0], c[1], c[2]); }).join("") + "</div>";
  }

  global.StampBook = { create: create, stamp: stamp, section: section };
})(window);
