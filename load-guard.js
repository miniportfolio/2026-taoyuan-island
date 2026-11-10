/* load-guard.js — 載入保險（區塊 #14，抽自桃園政策島）
 * 三件事：
 *   1. loadScript：外部函式庫的 CDN 備援（主要 CDN 寫在 HTML 的 <script>，失敗時依序換備援網址）
 *   2. createRenderer：建立 WebGL 之類容易失敗的物件，失敗就隔一下重試
 *   3. watchContextLost：顯示卡中斷繪圖（webglcontextlost）時通知你
 * 不依賴任何其他檔案。用法見 load-guard-使用說明.md
 */
(function (global) {
  "use strict";

  // 1. CDN 備援
  // opts.test()   → 回傳 true 代表函式庫已經可以用（例如 () => typeof THREE !== "undefined"）
  // opts.urls     → 備援網址陣列，依序嘗試
  // opts.onReady  → 函式庫可用時呼叫
  // opts.onFail   → 全部網址都失敗時呼叫
  function loadScript(opts) {
    var urls = opts.urls || [];
    function attempt(k) {
      if (opts.test()) return opts.onReady && opts.onReady();
      if (k >= urls.length) return opts.onFail && opts.onFail();
      var sc = document.createElement("script");
      sc.src = urls[k];
      sc.onload = function () { attempt(k + 1); };
      sc.onerror = function () { attempt(k + 1); };
      document.head.appendChild(sc);
    }
    attempt(0);
  }

  // 2. 建立物件＋重試
  // opts.create()  → 建立並回傳物件；丟出錯誤或回傳 null 都算失敗
  // opts.retries   → 失敗後再試幾次（預設 2）
  // opts.delay     → 每次重試間隔毫秒（預設 800）
  // opts.onReady(obj) / opts.onFail()
  function createRenderer(opts) {
    var retries = opts.retries == null ? 2 : opts.retries;
    var delay = opts.delay == null ? 800 : opts.delay;
    function attempt(tries) {
      var obj = null;
      try { obj = opts.create(); } catch (e) { obj = null; }
      if (!obj) {
        if (tries < retries) return setTimeout(function () { attempt(tries + 1); }, delay);
        return opts.onFail && opts.onFail();
      }
      opts.onReady && opts.onReady(obj);
    }
    attempt(0);
  }

  // 3. 顯示卡中斷繪圖
  // canvas → renderer.domElement 之類的 <canvas>
  function watchContextLost(canvas, onLost) {
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      onLost && onLost(e);
    });
  }

  global.LoadGuard = { loadScript: loadScript, createRenderer: createRenderer, watchContextLost: watchContextLost };
})(window);
