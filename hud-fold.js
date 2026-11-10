/* hud-fold.js — 窄螢幕 HUD 收合（區塊 #15，抽自桃園政策島）
 * 浮在畫面上的標題卡（HUD）可以手動收合／展開；手機等窄螢幕上，介紹看完後自動收合，
 * 避免擋住主畫面。收合後的樣子由 App 的 CSS 決定（預設加上 .min class）。
 * 不依賴任何其他檔案。用法見 docs/hud-fold-使用說明.md
 */
(function (global) {
  "use strict";

  // opts.panel     要收合的元素
  // opts.button    收合／展開按鈕
  // opts.title     （可選）收合狀態下點它也能展開，例如標題 h1
  // opts.minClass  收合時加上的 class（預設 "min"）
  // opts.icons     { fold: "−", unfold: "＋" } 按鈕上的字
  // opts.labels    { fold: "收合標題", unfold: "展開標題" } 給螢幕閱讀器的說明
  // opts.autoBelow 螢幕寬度小於這個值才自動收合（預設 700）
  // opts.autoDelay 自動收合前等幾毫秒（預設 2500）
  function create(opts) {
    var panel = opts.panel, btn = opts.button;
    var minClass = opts.minClass || "min";
    var icons = Object.assign({ fold: "−", unfold: "＋" }, opts.icons);
    var labels = Object.assign({ fold: "收合標題", unfold: "展開標題" }, opts.labels);
    var autoBelow = opts.autoBelow == null ? 700 : opts.autoBelow;
    var autoDelay = opts.autoDelay == null ? 2500 : opts.autoDelay;

    function isMin() { return panel.classList.contains(minClass); }
    function set(m) {
      panel.classList.toggle(minClass, m);
      btn.textContent = m ? icons.unfold : icons.fold;
      btn.setAttribute("aria-expanded", !m);
      btn.setAttribute("aria-label", m ? labels.unfold : labels.fold);
    }
    // 窄螢幕才收合；在「介紹看完」「教學結束」之類的時機呼叫
    function auto() { if (innerWidth < autoBelow) setTimeout(function () { set(true); }, autoDelay); }

    btn.onclick = function () { set(!isMin()); };
    if (opts.title) opts.title.onclick = function () { if (isMin()) set(false); };

    return { set: set, auto: auto, isMin: isMin, toggle: function () { set(!isMin()); } };
  }

  global.HudFold = { create: create };
})(window);
