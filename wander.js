/* wander.js — 角色隨機走動（區塊 #7 的 3D 部分，抽自桃園政策島）
 * 讓 NPC 在一塊範圍內自己挑目的地、走過去、到了再挑下一個；挑不到就停一下再試。
 * 只處理位置和面向（x、z、rotation.y），不需要 three.js 本身；任何有 position / rotation 的物件都能用。
 * 用法見 docs/wander-使用說明.md
 */
(function (global) {
  "use strict";

  // 角度慢慢轉向 target，rate 越大轉越快；自動走最短方向
  function turnAngle(cur, target, dt, rate) {
    var d = target - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return cur + d * Math.min(1, dt * rate);
  }
  function turnToward(obj, angle, dt, rate) { obj.rotation.y = turnAngle(obj.rotation.y, angle, dt, rate); }

  // 在圓環範圍內隨機挑一個可以直線走過去的目的地；全部失敗回傳 null
  // o.cx, o.cz      範圍中心
  // o.rMin, o.rRange 距中心 rMin ～ rMin+rRange
  // o.inside(x,z)   目的地是否在可走範圍內
  // o.from          {x,z} 現在位置
  // o.blocked(x,z)  路上這一點是否被擋住（例如撞到樹、房子）
  // o.tries         試幾次（預設 14）；o.samples 路線檢查幾個點（預設 8）
  function pickTarget(o) {
    var tries = o.tries || 14, samples = o.samples || 8;
    for (var k = 0; k < tries; k++) {
      var a = Math.random() * Math.PI * 2, r = o.rMin + Math.random() * o.rRange;
      var x = o.cx + Math.cos(a) * r, z = o.cz + Math.sin(a) * r;
      if (o.inside && !o.inside(x, z)) continue;
      var ok = true;
      for (var q = 1; q <= samples && ok; q++) {
        var sx = o.from.x + (x - o.from.x) * q / samples, sz = o.from.z + (z - o.from.z) * q / samples;
        if (o.blocked && o.blocked(sx, sz)) ok = false;
      }
      if (ok) return { x: x, z: z };
    }
    return null;
  }

  // 每一格呼叫：state 是這個角色自己的狀態物件（會用到 state.tgt、state.pause）
  // o.pick(state)  挑新目的地（通常包一層 pickTarget）
  // o.speed        每秒走幾單位（預設 1.05）；o.turn 轉向速度（預設 6）；o.arrive 到達距離（預設 .15）
  // o.retry        挑不到目的地時停幾秒（預設 .3）
  // 回傳 true 代表這一格有在走（用來播走路動畫）
  function step(state, obj, dt, o) {
    if (state.pause > 0) { state.pause -= dt; return false; }
    if (!state.tgt) state.tgt = o.pick(state);
    if (!state.tgt) { state.pause = o.retry == null ? .3 : o.retry; return false; }
    var p = obj.position, dx = state.tgt.x - p.x, dz = state.tgt.z - p.z, L = Math.hypot(dx, dz);
    if (L < (o.arrive == null ? .15 : o.arrive)) { state.tgt = null; return false; }
    var sp = Math.min(L, (o.speed == null ? 1.05 : o.speed) * dt);
    p.x += dx / L * sp; p.z += dz / L * sp;
    turnToward(obj, Math.atan2(dx, dz), dt, o.turn == null ? 6 : o.turn);
    return true;
  }

  global.Wander = { pickTarget: pickTarget, step: step, turnToward: turnToward, turnAngle: turnAngle };
})(window);
