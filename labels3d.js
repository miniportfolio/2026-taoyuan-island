/* labels3d.js — 3D 錨定標籤（區塊 #6，抽自桃園政策島）
 * 用一般 HTML 按鈕當 3D 物件的名牌：每一格把 3D 位置換算成螢幕座標，標籤跟著物件移動；
 * 離太遠、跑出畫面就加上 .far（CSS 讓它淡出、不能點）。哪種標籤多遠要藏，由 App 的規則決定。
 * 需要 three.js 的鏡頭。用法見 docs/labels3d-使用說明.md
 */
(function (global) {
  "use strict";

  // o.container  放標籤的 HTML 元素（蓋在 3D 畫布上，position:absolute 的父層）
  // o.baseClass  每個標籤都有的 class（預設 "zl"）
  // o.farClass   要藏起來時加的 class（預設 "far"）
  // o.margin     超出畫面多少還算看得到（預設 1.05，1 是剛好畫面邊緣）
  function create(o) {
    var base = o.baseClass || "zl", far = o.farClass || "far", margin = o.margin == null ? 1.05 : o.margin;
    var list = [];

    // html 內容、cls 額外 class、anchor 3D 位置（Vector3，之後改它標籤就跟著動）、onclick、kind 種類（給隱藏規則用）
    function add(html, cls, anchor, onclick, kind) {
      var b = document.createElement("button"); b.className = base + " " + cls; b.innerHTML = html;
      if (onclick) b.onclick = onclick;
      o.container.appendChild(b);
      var l = { el: b, anchor: anchor, kind: kind }; list.push(l); return l;
    }

    // 每一格（render 之後）呼叫
    // hide(label, dist, visible) 回傳 true 就藏；省略則只藏畫面外的
    function update(cam, W, H, hide) {
      list.forEach(function (l) {
        var p = l.anchor.clone().project(cam);
        var vis = p.z < 1 && Math.abs(p.x) < margin && Math.abs(p.y) < margin;
        var dist = cam.position.distanceTo(l.anchor);
        var h = hide ? hide(l, dist, vis) : !vis;
        l.el.classList.toggle(far, h);
        l.el.style.left = ((p.x + 1) / 2 * W) + "px"; l.el.style.top = ((1 - p.y) / 2 * H) + "px";
      });
    }

    return { add: add, update: update, list: list };
  }

  global.Labels3D = { create: create };
})(window);
