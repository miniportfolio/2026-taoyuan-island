/* timeofday.js — 時段系統（區塊 #2，抽自桃園政策島）
 * 幾組預設（清晨、白天、黃昏、夜晚…），一鍵切換天空、霧、天光、太陽；
 * 按鈕自動標示目前時段，選擇會記在瀏覽器裡，下次打開還是同一個時段。
 * 路燈發光、水色、光暈之類場景專屬的變化，用 extra 交給 App 處理。用法見 docs/timeofday-使用說明.md
 */
(function (global) {
  "use strict";

  // 套用基本欄位：bg 天空與霧、sky/gr/hi 天光、sun/si 太陽、off 太陽相對位置
  // ctx = { scene, hemi, sun, sunOffset }（sunOffset 是 Vector3，給 Scene3D.followShadow 用）
  function applyBasic(T, ctx) {
    if (T.bg != null) { ctx.scene.background.setHex(T.bg); if (ctx.scene.fog) ctx.scene.fog.color.setHex(T.bg); }
    if (ctx.hemi) { if (T.sky != null) ctx.hemi.color.setHex(T.sky); if (T.gr != null) ctx.hemi.groundColor.setHex(T.gr); if (T.hi != null) ctx.hemi.intensity = T.hi; }
    if (ctx.sun) { if (T.sun != null) ctx.sun.color.setHex(T.sun); if (T.si != null) ctx.sun.intensity = T.si; }
    if (ctx.sunOffset && T.off) ctx.sunOffset.set(T.off[0], T.off[1], T.off[2]);
  }

  // o.presets     { key: { bg, sky, gr, hi, sun, si, off, …你自己的欄位 } }
  // o.ctx         applyBasic 用的 { scene, hemi, sun, sunOffset }
  // o.extra(T,k)  套用場景專屬的部分（可省略）
  // o.buttons     時段按鈕（帶 data-t），會自動綁定並標示 .on
  // o.storageKey  記住選擇用的 localStorage 名稱（省略就不記）
  // o.fallback    沒記錄或記錄無效時用哪個（預設 "day"）
  function create(o) {
    var current = null;
    function set(k) {
      var T = o.presets[k];
      applyBasic(T, o.ctx);
      if (o.extra) o.extra(T, k);
      if (o.buttons) Array.prototype.forEach.call(o.buttons, function (b) { b.classList.toggle("on", b.dataset.t === k); });
      if (o.storageKey) { try { localStorage.setItem(o.storageKey, k); } catch (e) { } }
      current = k;
    }
    if (o.buttons) Array.prototype.forEach.call(o.buttons, function (b) { b.onclick = function () { set(b.dataset.t); }; });
    var fb = o.fallback || "day", k0 = fb;
    if (o.storageKey) { try { k0 = localStorage.getItem(o.storageKey) || fb; } catch (e) { } }
    set(o.presets[k0] ? k0 : fb);
    return { set: set, current: function () { return current; } };
  }

  global.TimeOfDay = { create: create, applyBasic: applyBasic };
})(window);
