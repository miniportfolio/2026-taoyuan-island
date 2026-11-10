/* dialogue.js — 多段對話（區塊 #7 的非 3D 部分，抽自桃園政策島）
 * 角色頭像區＋對話泡泡＋「繼續（1/3）」按鈕，一頁一句；最後一句換成你指定的結尾按鈕。
 * 不依賴任何其他檔案；面板由 App 提供（opts.open）。樣式沿用 App 的 .npc-head / .bubble / .row / .btn。
 * 用法見 docs/dialogue-使用說明.md
 */
(function (global) {
  "use strict";

  // opts.open(html)  把對話放進 App 的彈出面板
  // opts.head        { eyebrow, eyebrowClass, eyebrowStyle, name, note } 角色資訊
  // opts.count       總共幾句
  // opts.text(i)     第 i 句的內容（HTML）
  // opts.i           目前第幾句（從 0 開始，預設 0）
  // opts.nextLabel   「繼續」按鈕文字（預設「繼續」，後面自動加「（i/n）」）
  // opts.nextId      「繼續」按鈕的 id（預設 "dlgNext"）
  // opts.end         最後一句時顯示的按鈕 HTML
  // opts.always      每一句都顯示的按鈕 HTML（可省略）
  // opts.after(i, isLast)  畫完後呼叫，用來綁其他按鈕或記錄「聽完了」
  function show(opts) {
    var i = opts.i || 0, n = opts.count, isLast = i >= n - 1;
    var h = opts.head || {};
    var nextId = opts.nextId || "dlgNext";
    var eb = h.eyebrow != null
      ? '<div class="eyebrow' + (h.eyebrowClass || "") + '"' + (h.eyebrowStyle ? ' style="' + h.eyebrowStyle + '"' : "") + ">" + h.eyebrow + "</div>"
      : "";
    var btn = isLast ? (opts.end || "")
      : '<button class="btn pri" id="' + nextId + '">' + (opts.nextLabel || "繼續") + "（" + (i + 1) + "/" + n + "）</button>";
    opts.open('<div class="npc-head"><div>' + eb + "<h2>" + h.name + "</h2><small>" + (h.note || "") + "</small></div></div>\n" +
      '   <div class="bubble">' + opts.text(i) + "</div>\n" +
      '   <div class="row">' + btn + (opts.always || "") + "</div>");
    var nx = document.getElementById(nextId);
    if (nx && !isLast) nx.onclick = function () { show(Object.assign({}, opts, { i: i + 1 })); };
    opts.after && opts.after(i, isLast);
  }

  global.Dialogue = { show: show };
})(window);
