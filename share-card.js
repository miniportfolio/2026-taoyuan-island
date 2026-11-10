/* share-card.js — 分享圖產生器（區塊 #11，抽自桃園政策島）
 * 你只負責「畫什麼」（draw 函式），這個檔負責其餘流程：
 *   開畫布（9:16 或 4:5）→ 等字型載入 → 呼叫 draw → 轉成 PNG
 *   → 顯示預覽圖＋「分享」「下載」按鈕 → Web Share API 傳檔，不支援就提示長按存圖
 * 不依賴任何其他檔案。按鈕外觀沿用 App 自己的 CSS class。用法見 share-card-使用說明.md
 */
(function (global) {
  "use strict";

  var FORMATS = {
    story: { w: 1080, h: 1920, preview: "340px", label: "限時動態／手機桌布 9:16" },
    post:  { w: 1080, h: 1350, preview: "100%",  label: "貼文 4:5" }
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  // opts.format      "story" | "post"（預設 story）
  // opts.draw(ctx, info)  在畫布上畫圖；info = { W, H, format, story }
  // opts.out         放結果的元素，或元素 id 字串（畫完才去找，畫面已關閉就不顯示）
  // opts.fileName    下載／分享的檔名（預設 share.png）
  // opts.title / opts.text  分享時帶的標題與文字
  // opts.alt         預覽圖的替代文字（預設用 title）
  // opts.onUnsupported(msg)  瀏覽器不支援傳檔時呼叫（例如顯示 toast）；預設用 alert
  // opts.classes     { hint, row, primary, button }，預設 fine / row / "btn pri" / btn
  // opts.texts       { hint, share, download, unsupported } 改按鈕與提示文字
  function render(opts) {
    var fmtKey = FORMATS[opts.format] ? opts.format : "story";
    var fmt = FORMATS[fmtKey];
    var W = fmt.w, H = fmt.h;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    var cls = Object.assign({ hint: "fine", row: "row", primary: "btn pri", button: "btn" }, opts.classes);
    var tx = Object.assign({
      hint: "手機請長按圖片存檔；電腦可以按「下載」。",
      share: "分享",
      download: "下載",
      unsupported: "這個瀏覽器不支援直接分享，請長按圖片存檔或按下載。"
    }, opts.texts);
    var fileName = opts.fileName || "share.png";
    var title = opts.title || "";
    var alt = opts.alt || title;

    function findOut() {
      return typeof opts.out === "string" ? document.getElementById(opts.out) : opts.out;
    }

    function go() {
      opts.draw(ctx, { W: W, H: H, format: fmtKey, story: fmtKey === "story" });
      cv.toBlob(function (b) {
        var out = findOut();
        if (!out || (out.isConnected === false)) return;
        var url = URL.createObjectURL(b);
        out.innerHTML =
          '<img src="' + url + '" alt="' + esc(alt) + '" style="width:100%;max-width:' + fmt.preview +
          ';display:block;margin:0 auto;border-radius:12px;box-shadow:var(--shadow)">' +
          '<p class="' + cls.hint + '">' + tx.hint + "</p>" +
          '<div class="' + cls.row + '"><button class="' + cls.primary + '" data-share>' + tx.share + "</button>" +
          '<a class="' + cls.button + '" data-download href="' + url + '" download="' + esc(fileName) +
          '" style="text-decoration:none">' + tx.download + "</a></div>";
        var file = new File([b], fileName, { type: "image/png" });
        out.querySelector("[data-share]").onclick = async function () {
          try {
            if (navigator.canShare && navigator.canShare({ files: [file] }))
              await navigator.share({ files: [file], title: title, text: opts.text || "" });
            else (opts.onUnsupported || global.alert)(tx.unsupported);
          } catch (e) { /* 使用者取消分享，不用處理 */ }
        };
        opts.onDone && opts.onDone({ blob: b, url: url, file: file });
      }, "image/png");
    }

    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  }

  // 比例切換按鈕：把 container 裡帶 data-f 的按鈕綁成單選，切換時呼叫 onChange(format)
  function bindFormatTabs(container, onChange) {
    var btns = container.querySelectorAll("[data-f]");
    btns.forEach(function (b) {
      b.onclick = function () {
        btns.forEach(function (x) { x.classList.toggle("on", x === b); });
        onChange(b.dataset.f);
      };
    });
  }

  global.ShareCard = { render: render, bindFormatTabs: bindFormatTabs, FORMATS: FORMATS };
})(window);
