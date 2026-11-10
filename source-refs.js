/* source-refs.js — 出處資料模型（區塊 #12，抽自桃園政策島）
 * 出處集中寫成一份字典，內容裡只寫 key，畫面上自動列出處。
 * 字典格式：{ key: ["媒體｜標題", "網址", "日期"] }
 * 不依賴任何其他檔案。CSS（.srcs）由使用的 App 自己寫。用法見 source-refs-使用說明.md
 */
(function (global) {
  "use strict";

  function create(dict, opts) {
    opts = opts || {};
    var cls = opts.className || "srcs";   // 外框 class
    var arrow = opts.arrow == null ? " ↗" : opts.arrow;

    // 取一筆出處，拆成好用的欄位；key 不存在時回傳 null 並在 console 警告
    function get(key) {
      var r = dict[key];
      if (!r) { console.warn("[SourceRefs] 找不到出處：" + key); return null; }
      return { key: key, title: r[0], url: r[1], date: r[2], outlet: String(r[0]).split("｜")[0] };
    }

    // 產生出處列表 HTML（keys 依傳入順序列出，找不到的 key 自動略過）
    function list(keys) {
      var items = (keys || []).map(get).filter(Boolean);
      return '<div class="' + cls + '">' + items.map(function (s) {
        return '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.title + arrow + "<span>" + s.date + "</span></a>";
      }).join("") + "</div>";
    }

    // 檢查：回傳在字典裡找不到的 key（上線前跑一次，抓打錯字）
    function missing(keys) {
      return (keys || []).filter(function (k) { return !dict[k]; });
    }

    // 檢查：回傳字典裡從來沒被引用的 key（清理用）
    function unused(usedKeys) {
      var used = {};
      (usedKeys || []).forEach(function (k) { used[k] = 1; });
      return Object.keys(dict).filter(function (k) { return !used[k]; });
    }

    return { get: get, list: list, missing: missing, unused: unused, dict: dict };
  }

  global.SourceRefs = { create: create };
})(window);
