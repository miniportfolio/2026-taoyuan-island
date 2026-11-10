/* scene3d.js — 3D 場景基底（區塊 #1，抽自桃園政策島）
 * 三件事：
 *   1. lights：天光＋環境光＋太陽（含陰影設定）
 *   2. followShadow：陰影範圍和太陽跟著鏡頭焦點走，大場景也只需要一張不太大的陰影貼圖
 *   3. primitives：低多邊形積木工具（圓角方塊、方塊、圓柱、球、錐、屋頂、山牆、文字招牌、地面光暈）
 * 需要 three.js（r128 測試過）。用法見 docs/scene3d-使用說明.md
 */
(function (global) {
  "use strict";

  // o.sky/o.ground/o.hemi    天光顏色、地面反光顏色、強度（預設 0xfffaf0 / 0x6a9c98 / .5）
  // o.ambient                環境光強度（預設 .06）
  // o.sun/o.sunIntensity     太陽顏色、強度（預設 0xfff0d8 / .74）
  // o.sunPos                 [x,y,z] 太陽相對位置（預設 [-30,55,28]）
  // o.shadowMap / o.shadowBias / o.shadowSize  陰影貼圖解析度（預設 2048）、偏移（-.0006）、範圍半徑（46）
  // o.shadowNear / o.shadowFar（預設 1 / 160）
  function lights(THREE, scene, o) {
    o = o || {};
    var hemi = new THREE.HemisphereLight(o.sky == null ? 0xfffaf0 : o.sky, o.ground == null ? 0x6a9c98 : o.ground, o.hemi == null ? .5 : o.hemi);
    scene.add(hemi);
    var amb = new THREE.AmbientLight(0xffffff, o.ambient == null ? .06 : o.ambient); scene.add(amb);
    var sun = new THREE.DirectionalLight(o.sun == null ? 0xfff0d8 : o.sun, o.sunIntensity == null ? .74 : o.sunIntensity);
    var sp = o.sunPos || [-30, 55, 28];
    sun.position.set(sp[0], sp[1], sp[2]); sun.castShadow = true;
    var ms = o.shadowMap || 2048; sun.shadow.mapSize.set(ms, ms);
    sun.shadow.bias = o.shadowBias == null ? -.0006 : o.shadowBias;
    var s = o.shadowSize || 46;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: o.shadowNear || 1, far: o.shadowFar || 160 });
    scene.add(sun); scene.add(sun.target);
    return { hemi: hemi, amb: amb, sun: sun };
  }

  // 每一格呼叫：陰影範圍半徑 size，太陽放在焦點 (fx,fz) 加上 offset（Vector3 或 {x,y,z}）
  function followShadow(sun, fx, fz, size, offset) {
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size });
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(fx + offset.x, offset.y, fz + offset.z);
    sun.target.position.set(fx, 0, fz);
  }

  // o.roughness（預設 .82）、o.font（招牌字型）
  function primitives(THREE, scene, o) {
    o = o || {};
    var rough = o.roughness == null ? .82 : o.roughness;
    var font = o.font || '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    var fontShort = o.fontShort || '"Noto Sans TC","PingFang TC",sans-serif';
    var M = {}, MF = {}, GC = {}, GAB = null, GLOWM = null;

    // 同一個顏色共用同一個材質（省記憶體，也方便一次改全部同色物件，例如夜晚讓燈發光）
    var mat = function (c) { return M[c] || (M[c] = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 })); };
    var matF = function (c) { return MF[c] || (MF[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true })); };

    // 圓角方塊幾何（同尺寸共用快取）
    function RBG(w, h, d, r) {
      var key = [w, h, d, r].join(","); if (GC[key]) return GC[key];
      r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001);
      var g = new THREE.BoxGeometry(w, h, d, 4, 4, 4), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3(),
        hi = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r), lo = hi.clone().negate();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); c.copy(v).clamp(lo, hi); var n = v.clone().sub(c);
        if (n.lengthSq() > 1e-9) n.normalize().multiplyScalar(r); v.copy(c).add(n); p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals(); return GC[key] = g;
    }
    // 放一個物件：顏色可以是數字（自動用 mat）或材質；parent 省略就放進 scene
    function mesh(g, c, x, y, z, parent, shadow) {
      if (x === undefined) x = 0; if (y === undefined) y = 0; if (z === undefined) z = 0; if (parent === undefined) parent = scene; if (shadow === undefined) shadow = true;
      var m = new THREE.Mesh(g, typeof c === "number" ? mat(c) : c); m.position.set(x, y, z);
      if (shadow) { m.castShadow = true; m.receiveShadow = true; }
      (parent || scene).add(m); return m;
    }
    // 以下 y 都是「底部高度」，物件會自動往上放半個高度，直接疊積木不用算
    var rbox = function (w, h, d, c, x, y, z, p, r) { return mesh(RBG(w, h, d, r === undefined ? .12 : r), c, x, y + h / 2, z, p); };
    var box = function (w, h, d, c, x, y, z, p) { return mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, p); };
    var cyl = function (rt, rb, h, c, x, y, z, p, seg) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg === undefined ? 12 : seg), c, x, y + h / 2, z, p); };
    var sph = function (r, c, x, y, z, p, seg) { seg = seg === undefined ? 12 : seg; return mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * .7 | 0)), c, x, y, z, p); };
    var cone = function (r, h, c, x, y, z, p, seg) { return mesh(new THREE.ConeGeometry(r, h, seg === undefined ? 8 : seg), c, x, y + h / 2, z, p); };
    // 四角錐屋頂
    function roof(w, d, h, c, x, y, z, p) {
      var m = mesh(new THREE.ConeGeometry(Math.max(w, d) * .72, h, 4), matF(c), x, y + h / 2, z, p);
      m.rotation.y = Math.PI / 4; m.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); return m;
    }
    // 三角山牆屋頂
    function gable(w, d, h, c, x, y, z, p) {
      if (!GAB) {
        var sh = new THREE.Shape(); sh.moveTo(-.55, 0); sh.lineTo(.55, 0); sh.lineTo(0, 1); sh.lineTo(-.55, 0);
        GAB = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); GAB.translate(0, 0, -.5); GAB.rotateY(Math.PI / 2);
      }
      var m = mesh(GAB, matF(c), x, y, z, p); m.scale.set(w, h, d); return m;
    }
    // 文字招牌：canvas 畫字貼在平面上，字太長會自動縮小
    // opt.fs 字級（預設 70）、opt.ry 旋轉、opt.back 背板顏色
    function sign(text, w, h, bg, fg, x, y, z, p, opt) {
      opt = opt || {};
      var cv = document.createElement("canvas"), S = 128, W = Math.round(S * w / h); cv.width = W; cv.height = S; var c = cv.getContext("2d");
      c.fillStyle = bg; c.beginPath(); c.roundRect ? c.roundRect(0, 0, W, S, 24) : c.rect(0, 0, W, S); c.fill();
      c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
      var fs = opt.fs || 70; c.font = "700 " + fs + "px " + font;
      while (c.measureText(text).width > W - 28 && fs > 20) { fs -= 4; c.font = "700 " + fs + "px " + fontShort; }
      c.fillText(text, W / 2, S / 2 + 4); var t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .7, transparent: true }));
      m.position.set(x, y, z); if (opt.ry) m.rotation.y = opt.ry; (p || scene).add(m);
      if (opt.back) box(w + .12, h + .12, .08, opt.back, x, y - h / 2 - .06, z - .05, p);
      return m;
    }
    // 地面圓形光暈（夜晚路燈下用），預設隱藏
    function glowDisc(x, z, r, op) {
      if (!GLOWM) {
        var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d');
        var g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,226,160,1)'); g.addColorStop(.5, 'rgba(255,214,140,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128); GLOWM = new THREE.CanvasTexture(cv);
      }
      var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: GLOWM, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, .03, z); m.visible = false; m.renderOrder = 2; scene.add(m); return m;
    }

    return { mat: mat, matF: matF, RBG: RBG, mesh: mesh, rbox: rbox, box: box, cyl: cyl, sph: sph, cone: cone, roof: roof, gable: gable, sign: sign, glowDisc: glowDisc };
  }

  global.Scene3D = { lights: lights, followShadow: followShadow, primitives: primitives };
})(window);
