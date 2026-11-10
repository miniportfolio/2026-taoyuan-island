/* confetti3d.js — 3D 彩紙（區塊 #10，抽自桃園政策島）
 * 預先建好一批彩紙片（物件池），需要時從某一點炸開、受重力落下、縮小消失。
 * 需要 three.js（傳入 THREE 和 scene）。主迴圈每一格呼叫 update(dt)。用法見 docs/confetti3d-使用說明.md
 */
(function (global) {
  "use strict";

  // opts.THREE / opts.scene   three.js 與場景
  // opts.material(color)      回傳材質（政策島用自己的 mat() 快取材質）；省略就用 MeshStandardMaterial
  // opts.count                彩紙片數（預設 36）
  // opts.colors               顏色輪流用（預設政策島四色）
  // opts.size                 [半徑, 厚度, 邊數]（預設 [.14, .04, 6]）
  // opts.reduced              true＝使用者偏好減少動態，完全不播放
  // opts.gravity / opts.life  重力（預設 12）、存活秒數（預設 1.6）
  function create(opts) {
    var THREE = opts.THREE, scene = opts.scene;
    var colors = opts.colors || [0xe9715d, 0x1f7a74, 0xe3aa45, 0x7b5cd6];
    var size = opts.size || [.14, .04, 6];
    var count = opts.count || 36;
    var gravity = opts.gravity == null ? 12 : opts.gravity;
    var lifeMax = opts.life == null ? 1.6 : opts.life;
    var material = opts.material || function (c) { return new THREE.MeshStandardMaterial({ color: c }); };
    var geo = new THREE.CylinderGeometry(size[0], size[0], size[1], size[2]);
    var pieces = [];
    for (var i = 0; i < count; i++) {
      var m = new THREE.Mesh(geo, material(colors[i % colors.length]));
      m.visible = false; scene.add(m);
      pieces.push({ m: m, v: new THREE.Vector3(), life: 0, spin: new THREE.Vector3() });
    }

    // 從 (x,y,z) 炸開：全部彩紙片重新發射
    function burst(x, y, z) {
      if (opts.reduced) return;
      pieces.forEach(function (c) {
        c.m.visible = true; c.m.position.set(x, y, z);
        var a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
        c.v.set(Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s);
        c.life = lifeMax;
        c.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      });
    }

    // 每一格呼叫
    function update(dt) {
      pieces.forEach(function (c) {
        if (c.life <= 0) return;
        c.life -= dt; c.v.y -= gravity * dt;
        c.m.position.addScaledVector(c.v, dt);
        c.m.rotation.x += c.spin.x * dt; c.m.rotation.z += c.spin.z * dt;
        c.m.scale.setScalar(Math.max(.01, Math.min(1, c.life)));
        if (c.life <= 0) c.m.visible = false;
      });
    }

    // 連續放好幾次（慶祝用）：center() 回傳 {x,z}，每次在附近隨機位置的半空中炸開
    // o.times（預設 6）、o.interval 毫秒（預設 700）、o.spread（預設 8）、o.yMin（預設 6）、o.yRange（預設 4）
    function shower(center, o) {
      if (opts.reduced) return;
      o = o || {};
      var times = o.times || 6, spread = o.spread == null ? 8 : o.spread;
      var yMin = o.yMin == null ? 6 : o.yMin, yRange = o.yRange == null ? 4 : o.yRange;
      var k = 0;
      var tm = setInterval(function () {
        var p = center();
        burst(p.x + (Math.random() - .5) * spread, yMin + Math.random() * yRange, p.z + (Math.random() - .5) * spread);
        if (++k >= times) clearInterval(tm);
      }, o.interval || 700);
    }

    return { burst: burst, update: update, shower: shower, pieces: pieces };
  }

  global.Confetti3D = { create: create };
})(window);
