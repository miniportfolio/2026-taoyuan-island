/* friend-links.js — 友站互連（區塊 #17，抽自桃園政策島）
 * 友站集中寫成一份字典，App 裡任何地方（按鈕、3D 物件、選單）都用 key 打開同一種介紹卡片：
 * 標題、一句說明、「前往 網址 ↗」按鈕、底部附註（例如聯盟連結）。
 * 不依賴任何其他檔案；卡片放進哪個面板由 App 決定（opts.open）。用法見 docs/friend-links-使用說明.md
 */
(function (global) {
  "use strict";

  // dict        { key: { t: "站名", d: "一句說明", u: "https://網址/" } }
  // opts.open(html)  把卡片 HTML 放進 App 的彈出面板
  // opts.color   主色（預設 #d9645b）
  // opts.eyebrow 卡片頂端小標（預設「友站」）
  // opts.note    卡片底部附註 HTML（可省略）
  // opts.titleStyle 標題樣式（預設沿用政策島）
  function create(dict, opts) {
    opts = opts || {};
    var color = opts.color || "#d9645b";
    var eyebrow = opts.eyebrow || "友站";
    var titleStyle = opts.titleStyle || "font-family:var(--f-display);font-weight:400;margin:4px 0 8px;font-size:26px;line-height:1.25";

    // 網址顯示用：去掉 https:// 和結尾斜線
    function shortUrl(u) { return u.replace(/^https:\/\//, "").replace(/\/$/, ""); }

    function html(k) {
      var f = dict[k];
      if (!f) { console.warn("[FriendLinks] 找不到友站：" + k); return ""; }
      return '<div class="eyebrow" style="color:' + color + '">' + eyebrow + "</div>" +
        '<h2 style="' + titleStyle + '">' + f.t + "</h2>" +
        '<p style="margin:0 0 14px">' + f.d + "</p>\n" +
        '  <a class="btn pri" style="display:block;text-align:center;text-decoration:none;background:' + color +
        ";border-color:" + color + '" href="' + f.u + '" target="_blank" rel="noopener">前往 ' + shortUrl(f.u) + " ↗</a>" +
        (opts.note ? "\n  " + opts.note : "");
    }

    function open(k) { var h = html(k); if (h && opts.open) opts.open(h); }

    return { html: html, open: open, keys: function () { return Object.keys(dict); }, dict: dict };
  }

  global.FriendLinks = { create: create };
})(window);
