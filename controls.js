/* controls.js — 角色操控＋雙鏡頭（區塊 #4 的一半，抽自桃園政策島）
 *   1. keyboard：記住哪些鍵按著（WASD／方向鍵）
 *   2. joystick：手機左下角的虛擬搖桿
 *   3. moveVector：把按鍵＋搖桿換成「相對鏡頭方向」的移動量
 *   4. walker：角色移動——加速減速、沿路線自動走、繞開障礙、碰到不能走的地方沿邊滑、轉身
 *   5. orbitCam：兩種鏡頭——跟著角色（走路）和自由俯瞰（沙盤）；拖曳旋轉、平移、雙指與滾輪縮放、點一下
 * 需要 three.js（r128 測試過）。用法見 docs/controls-使用說明.md
 */
(function (global) {
  "use strict";

  // 回傳 keys 物件（keys.w === 1 表示按著）。o.onDown(e) 每次按鍵都會呼叫，可放「E 對話」之類的快捷鍵
  function keyboard(o) {
    o = o || {}; var keys = {}, tgt = o.target || global;
    tgt.addEventListener("keydown", function (e) { keys[e.key.toLowerCase()] = 1; if (o.onDown) o.onDown(e); });
    tgt.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = 0; });
    return keys;
  }

  // el：搖桿底座，裡面放一個 <i> 當搖桿頭。回傳 J，J.v 是 null（沒在推）或 {x,y}（-1～1）
  // o.radius 可推多遠（40px）、o.onMove(v) 每次推動時呼叫
  function joystick(el, o) {
    o = o || {}; var knob = o.knob || el.querySelector("i"), m = o.radius || 40, J = { v: null };
    function move(e) {
      var r = el.getBoundingClientRect(); var dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
      var L = Math.hypot(dx, dy); if (L > m) { dx *= m / L; dy *= m / L; }
      knob.style.transform = "translate(" + dx + "px," + dy + "px)"; J.v = { x: dx / m, y: dy / m };
      if (o.onMove) o.onMove(J.v);
    }
    el.addEventListener("pointerdown", function (e) { el.setPointerCapture(e.pointerId); J.v = { x: 0, y: 0 }; move(e); });
    el.addEventListener("pointermove", function (e) { if (J.v) move(e); });
    var end = function () { J.v = null; knob.style.transform = ""; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    return J;
  }

  // 按鍵＋搖桿 → 世界座標的 [wx, wz]（已依鏡頭水平角 yaw 轉好，往畫面上方＝往前）
  function moveVector(keys, joy, yaw) {
    var ix = 0, iz = 0;
    if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1;
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (joy) { ix += joy.x; iz += joy.y; }
    var c = Math.cos(yaw), s = Math.sin(yaw);
    return [c * ix + s * iz, -s * ix + c * iz];
  }

  // 角色移動。o.obj 要移動的 Object3D；o.walkable(x,z)；o.colliders [[x,z,半徑], ...]（可之後再 push）
  // o.state：放自動走路路線的物件，state.auto = { wp:[{x,z},...], done }（預設自己建一個）
  // 其他（預設＝政策島手感）：walkSpeed 6.5、autoSpeed 9.5、accel 10、decel 14、radius .55（角色半徑）、
  //   arrive .35（到點距離）、turnRate 12、turnMin .4（速度超過才轉身）
  function walker(THREE, o) {
    var WS = o.walkSpeed == null ? 6.5 : o.walkSpeed, AS = o.autoSpeed == null ? 9.5 : o.autoSpeed,
      AC = o.accel == null ? 10 : o.accel, DC = o.decel == null ? 14 : o.decel, RAD = o.radius == null ? .55 : o.radius,
      AR = o.arrive == null ? .35 : o.arrive, TR = o.turnRate == null ? 12 : o.turnRate, TM = o.turnMin == null ? .4 : o.turnMin;
    var W = { obj: o.obj, vel: new THREE.Vector3(), state: o.state || { auto: null } };
    // 沿路線自動走（例如 HexNav 的 route 結果），走完呼叫 done
    W.go = function (wp, done) { W.state.auto = { wp: wp, done: done }; };
    W.stop = function () { W.state.auto = null; };
    // 每一格：vx, vz 是 moveVector 的結果（手動輸入會取消自動走路）。回傳 { speed, auto }
    W.update = function (dt, vx, vz) {
      var st = W.state, obj = W.obj, vel = W.vel;
      if (vx || vz) st.auto = null;
      var auto = false;
      if (st.auto) {
        var w = st.auto.wp[0]; var dx = w.x - obj.position.x, dz = w.z - obj.position.z, L = Math.hypot(dx, dz);
        if (L < AR) { st.auto.wp.shift(); if (!st.auto.wp.length) { var d = st.auto.done; st.auto = null; d && d(); } }
        else { vx = dx / L; vz = dz / L; auto = true; }
      }
      var Lm = Math.min(1, Math.hypot(vx, vz)), sp = auto ? AS : WS;
      var dvx = Lm ? vx / Math.hypot(vx, vz) * sp * Lm : 0, dvz = Lm ? vz / Math.hypot(vx, vz) * sp * Lm : 0;
      var kk = 1 - Math.exp(-dt * (Lm ? AC : DC)); vel.x += (dvx - vel.x) * kk; vel.z += (dvz - vel.z) * kk;
      var speed = Math.hypot(vel.x, vel.z);
      if (speed > .05) {
        var nx = obj.position.x + vel.x * dt, nz = obj.position.z + vel.z * dt;
        if (!auto) {
          var C = o.colliders || [];
          for (var i = 0; i < C.length; i++) {
            var cx = C[i][0], cz = C[i][1], r = C[i][2]; var dd = Math.hypot(nx - cx, nz - cz), m = r + RAD;
            if (dd < m) { var k = (m - dd) / (dd || 1); nx += (nx - cx) * k; nz += (nz - cz) * k; }
          }
        }
        var wk = o.walkable;
        if (auto || wk(nx, nz)) { obj.position.x = nx; obj.position.z = nz; }
        else if (wk(nx, obj.position.z)) obj.position.x = nx; else if (wk(obj.position.x, nz)) obj.position.z = nz; else vel.set(0, 0, 0);
        if (speed > TM) {
          var ang = Math.atan2(vel.x, vel.z); var da = ang - obj.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
          obj.rotation.y += da * Math.min(1, dt * TR);
        }
      }
      return { speed: speed, auto: auto };
    };
    return W;
  }

  // 雙模式鏡頭。o.cam 相機、o.canvas 接收拖曳的畫布、o.onTap(e) 點一下（沒拖曳）時呼叫
  // 回傳 C：C.sandbox（true＝俯瞰）、C.yaw、C.pitch、C.walkDist、C.sbDist、C.target（俯瞰焦點 Vector3）
  // 其他（預設＝政策島手感）：pitch .95、walkDist 27、sbDist 150、sbTarget [0,0,8]、walkZoom [10,70]、
  //   sbZoom [26,300]、pitchRange [.32,1.38]、panLimit（俯瞰焦點離原點最遠多少，預設不限）
  function orbitCam(THREE, o) {
    var WZ = o.walkZoom || [10, 70], SZ = o.sbZoom || [26, 300], PR = o.pitchRange || [.32, 1.38];
    var st = o.sbTarget || [0, 0, 8];
    var C = { sandbox: false, yaw: o.yaw || 0, pitch: o.pitch == null ? .95 : o.pitch, walkDist: o.walkDist || 27,
      sbDist: o.sbDist || 150, target: new THREE.Vector3(st[0], st[1], st[2]) };
    var cam = o.cam, cv = o.canvas, clampv = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var camPos = new THREE.Vector3(), look = new THREE.Vector3(), camLook = new THREE.Vector3(), first = true;

    if (cv) {
      var ptrs = new Map(), dragged = false, pinch0 = 0, dist0 = 0, btn = 0;
      cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      cv.addEventListener("pointerdown", function (e) {
        cv.setPointerCapture(e.pointerId); if (!ptrs.size) btn = e.button;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== "mouse", shift: e.shiftKey }); dragged = false;
        if (ptrs.size === 2) { var ab = Array.from(ptrs.values()); pinch0 = Math.hypot(ab[0].x - ab[1].x, ab[0].y - ab[1].y); dist0 = C.sandbox ? C.sbDist : C.walkDist; }
      });
      cv.addEventListener("pointermove", function (e) {
        var p = ptrs.get(e.pointerId); if (!p) return; var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) dragged = true; if (!dragged) return;
        if (ptrs.size === 2) {
          var ab = Array.from(ptrs.values()); var d = Math.hypot(ab[0].x - ab[1].x, ab[0].y - ab[1].y);
          if (pinch0 > 0) { var v = dist0 * pinch0 / d; if (C.sandbox) C.sbDist = clampv(v, SZ[0], SZ[1]); else C.walkDist = clampv(v, WZ[0], WZ[1]); }
          return;
        }
        var pan = C.sandbox && (p.touch || btn === 2 || p.shift);
        if (pan) {
          var k = C.sbDist / innerHeight * 1.15, c = Math.cos(C.yaw), s = Math.sin(C.yaw), mx = -dx * k, mf = dy * k * 1.25, T = C.target;
          T.x += c * mx - s * mf; T.z += -s * mx - c * mf;
          if (o.panLimit) { var L = Math.hypot(T.x, T.z); if (L > o.panLimit) { T.x *= o.panLimit / L; T.z *= o.panLimit / L; } }
        } else { C.yaw -= dx * .006; C.pitch = clampv(C.pitch + dy * .005, PR[0], PR[1]); }
      });
      cv.addEventListener("pointerup", function (e) {
        var p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (!p || dragged || ptrs.size) return;
        if (o.onTap) o.onTap(e);
      });
      cv.addEventListener("pointercancel", function (e) { ptrs.delete(e.pointerId); });
      cv.addEventListener("wheel", function (e) {
        e.preventDefault(); var f = 1 + Math.sign(e.deltaY) * .1;
        if (C.sandbox) C.sbDist = clampv(C.sbDist * f, SZ[0], SZ[1]); else C.walkDist = clampv(C.walkDist * f, WZ[0], WZ[1]);
      }, { passive: false });
    }

    // 每一格：跟隨的角色位置 (px,py,pz) 和速度 (vx,vz)（鏡頭會稍微往前看）。回傳 [fx,fz] 畫面焦點（給陰影用）
    C.update = function (dt, px, py, pz, vx, vz) {
      var fx, fz, T = C.target;
      var cpp = Math.cos(C.pitch), spp = Math.sin(C.pitch), syw = Math.sin(C.yaw), cyw = Math.cos(C.yaw);
      if (C.sandbox) { var D = C.sbDist; camPos.set(T.x + syw * cpp * D, spp * D, T.z + cyw * cpp * D); camLook.copy(T); fx = T.x; fz = T.z; }
      else { var D2 = C.walkDist, tx = px + vx * .3, tz = pz + vz * .3; camPos.set(tx + syw * cpp * D2, py + spp * D2, tz + cyw * cpp * D2); camLook.set(tx, 1 + py, tz); fx = px; fz = pz; }
      if (first) { cam.position.copy(camPos); look.copy(camLook); first = false; }
      var ck = 1 - Math.exp(-dt * (C.sandbox ? 7 : 5)), lk = 1 - Math.exp(-dt * (C.sandbox ? 8 : 7));
      cam.position.lerp(camPos, ck); look.lerp(camLook, lk); cam.lookAt(look);
      return [fx, fz];
    };
    return C;
  }

  global.Controls = { keyboard: keyboard, joystick: joystick, moveVector: moveVector, walker: walker, orbitCam: orbitCam };
})(window);
