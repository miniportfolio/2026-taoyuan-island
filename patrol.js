/* patrol.js — 巡邏角色狀態機（區塊 #8，抽自桃園政策島）
 * 兩個工具：
 *   1. machine：角色在幾種狀態之間切換（例如 說話 → 跳下台 → 走路 → 跳上台 → 說話），每一格只跑目前狀態
 *   2. follow：沿著一串路徑點（waypoints）往前走，到一點就換下一點
 * 不需要 three.js 本身；任何有 position 的物件都能用。用法見 docs/patrol-使用說明.md
 */
(function (global) {
  "use strict";

  // state      存狀態的物件，目前狀態放在 state.mode（例如 "speak"）
  // handlers   { 狀態名: function(ctx){…} }；要換狀態就改 state.mode
  function machine(state, handlers) {
    return {
      step: function (ctx) { var h = handlers[state.mode]; if (h) h(ctx); return state.mode; },
      go: function (mode) { state.mode = mode; },
      state: state
    };
  }

  // 沿路徑點走一格
  // pos      要移動的位置（obj.position）
  // wp       路徑點陣列 [{x,z}, …]，走到的點會從前面移除
  // dt       這一格的秒數
  // o.speed  每秒幾單位；o.arrive 距離小於多少算到達
  // 回傳 { moved, reached, done, dx, dz, L }
  //   reached：這一格剛到達一個點（這一格不移動）
  //   done：整條路徑走完
  //   dx, dz：移動方向（用來算面向）
  function follow(pos, wp, dt, o) {
    var w = wp[0], dx = w.x - pos.x, dz = w.z - pos.z, L = Math.hypot(dx, dz);
    if (L < o.arrive) { wp.shift(); return { moved: false, reached: true, done: !wp.length, dx: dx, dz: dz, L: L }; }
    var sp = Math.min(L, o.speed * dt);
    pos.x += dx / L * sp; pos.z += dz / L * sp;
    return { moved: true, reached: false, done: false, dx: dx, dz: dz, L: L };
  }

  global.Patrol = { machine: machine, follow: follow };
})(window);
