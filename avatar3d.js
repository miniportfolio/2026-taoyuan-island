/* avatar3d.js — 角色模型與動作（區塊 #4 的一半，抽自桃園政策島）
 *   1. human(o)：低多邊形小人（市民、四姐都是它改出來的）
 *   2. penguin(o)：小企鵝（玩家角色），含圍巾、飄帶、眼鏡的掛點
 *   3. setHat(g, kind)：換帽子；內建 6 種，也可以自己加（hats 物件）
 *   4. blink(ud, dt)：眨眼
 *   5. walkPose()：玩家的走路／待機動作（擺腿、擺手、身體晃、偶爾拍翅膀）
 * 需要 three.js（r128 測試過）和 scene3d.js 的 primitives。用法見 docs/avatar3d-使用說明.md
 */
(function (global) {
  "use strict";

  // THREE：three.js；P3：Scene3D.primitives(...) 的回傳值
  function create(THREE, P3) {
    var mesh = P3.mesh, rbox = P3.rbox, box = P3.box, cyl = P3.cyl, sph = P3.sph, cone = P3.cone;

    // o.shirt 衣服顏色（必填）、o.pants 褲子、o.skin 皮膚、o.hair 頭髮、o.grey true＝白髮
    // 回傳 Group；userData 有 L（兩腿）、A（兩手）、body、head、eyes，動畫直接轉這些
    function human(o) {
      var g = new THREE.Group(); var body = new THREE.Group(); g.add(body); var skin = o.skin || 0xf1c9a5; var L = [], A = [];
      [-.17, .17].forEach(function (s) { var l = new THREE.Group(); l.position.set(s, .75, 0); g.add(l); rbox(.26, .62, .28, o.pants || 0x34495e, 0, -.7, 0, l, .12); sph(.17, 0x3a3a3a, 0, -.66, .06, l, 10).scale.set(1, .6, 1.3); L.push(l); });
      sph(.5, o.shirt, 0, 1.05, 0, body, 16).scale.set(.84, .92, .7);
      [-.48, .48].forEach(function (s) { var a = new THREE.Group(); a.position.set(s, 1.5, 0); body.add(a); rbox(.22, .6, .24, o.shirt, 0, -.62, 0, a, .11); sph(.13, skin, 0, -.7, 0, a, 10); A.push(a); });
      var head = new THREE.Group(); head.position.y = 2.05; head.scale.setScalar(1.3); body.add(head);
      sph(.4, skin, 0, 0, 0, head, 14);
      var hair = o.grey ? 0xd8d8d2 : (o.hair || 0x2b211c);
      mesh(new THREE.SphereGeometry(.43, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, .06, -.04, head);
      [[-.2, .3], [.05, .36], [.25, .28]].forEach(function (p) { sph(.15, hair, p[0], p[1], .12, head, 10); });
      var eyes = [-.14, .14].map(function (s) { return sph(.05, 0x1d2a2a, s, .02, .37, head, 6); });
      g.userData = { L: L, A: A, body: body, head: head, eyes: eyes, hatParent: head, hatOff: .37, blink: Math.random() * 4 };
      return g;
    }

    // o.scarf 圍巾顏色（預設 0xe9715d）
    // userData 另外有 scarf[圍巾環, 圍巾尾]、tail2（第二條飄帶，預設隱藏）、tip、gl（眼鏡，預設隱藏）、tailG（圍巾尾的轉軸）
    function penguin(o) {
      o = o || {}; var scarf = o.scarf == null ? 0xe9715d : o.scarf;
      var g = new THREE.Group(); var body = new THREE.Group(); g.add(body); var dark = 0x26323a, L = [], A = [];
      [-.22, .22].forEach(function (s) { var l = new THREE.Group(); l.position.set(s, .32, 0); g.add(l); rbox(.32, .1, .5, 0xf29a38, 0, -.3, .08, l, .04); L.push(l); });
      sph(.62, dark, 0, .95, 0, body, 16).scale.set(1, 1.15, .92);
      sph(.52, 0xfbfaf6, 0, .9, .22, body, 14).scale.set(.85, 1.02, .62);
      [-.6, .6].forEach(function (s) { var a = new THREE.Group(); a.position.set(s, 1.35, 0); body.add(a); var f = rbox(.14, .7, .36, dark, 0, -.7, 0, a, .06); f.rotation.z = s < 0 ? .18 : -.18; A.push(a); });
      var head = new THREE.Group(); head.position.y = 1.82; body.add(head);
      sph(.46, dark, 0, 0, 0, head, 16);
      sph(.36, 0xfbfaf6, 0, -.05, .25, head, 16).scale.set(1.1, .95, .78);
      var eyes = [-.13, .13].map(function (s) { return sph(.06, 0x10181c, s, .03, .52, head, 10); }); [-.12, .14].forEach(function (s) { sph(.02, 0xffffff, s, .06, .575, head, 6); });
      [-.25, .25].forEach(function (s) { sph(.07, 0xf6b2a6, s, -.11, .47, head, 8); });
      var bk = mesh(new THREE.ConeGeometry(.1, .26, 10), 0xf29a38, 0, -.09, .64, head); bk.rotation.x = Math.PI / 2;
      var sc = mesh(new THREE.TorusGeometry(.4, .11, 8, 18), scarf, 0, 1.45, 0, body); sc.rotation.x = Math.PI / 2;
      var tailG = new THREE.Group(); tailG.position.set(.22, 1.4, .4); body.add(tailG); var tail = rbox(.3, .5, .12, scarf, 0, -.5, 0, tailG, .05); tailG.rotation.z = -.3; tailG.userData.t1 = tail;
      var tail2 = rbox(.26, .56, .12, 0x2aa198, .18, -.46, .04, tailG, .05); tail2.rotation.z = .55; tail2.visible = false; var tip = box(.27, .08, .13, 0xb6e03a, 0, -.78, 0, tailG); tip.visible = false;
      var gl = new THREE.Group(); head.add(gl); [-.13, .13].forEach(function (x) { mesh(new THREE.TorusGeometry(.1, .02, 8, 16), 0x2b2b2b, x, .03, .555, gl, false); }); box(.08, .02, .02, 0x2b2b2b, 0, .04, .56, gl); gl.visible = false;
      g.userData = { L: L, A: A, body: body, head: head, eyes: eyes, hatParent: head, hatOff: .36, scarf: [sc, tail], tail2: tail2, tip: tip, gl: gl, tailG: tailG, blink: 2 };
      return g;
    }

    // 帽子樣式：每個函式收到一個已經放在頭頂的 Group h，在裡面蓋帽子
    var hats = {
      cap: function (h) { mesh(new THREE.SphereGeometry(.48, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1f7a74, 0, 0, 0, h); rbox(.5, .06, .5, 0x1f7a74, 0, 0, .45, h, .03); },
      dou: function (h) { cone(.95, .5, 0xd9b86a, 0, -.05, 0, h, 14); },
      helmet: function (h) { mesh(new THREE.SphereGeometry(.54, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf2b134, 0, -.05, 0, h); cyl(.6, .6, .05, 0xf2b134, 0, -.05, 0, h, 16); },
      pilot: function (h) { cyl(.42, .36, .22, 0x1f2f4a, 0, -.02, 0, h, 16); cyl(.5, .5, .06, 0x1f2f4a, 0, .18, 0, h, 16); rbox(.5, .05, .28, 0x111a2a, 0, -.02, .4, h, .03); box(.18, .1, .04, 0xe3b341, 0, .08, .4, h); },
      driver: function (h) { cyl(.44, .4, .24, 0x2c6e80, 0, -.02, 0, h, 16); rbox(.52, .05, .3, 0x1d3433, 0, -.02, .42, h, .03); box(.6, .06, .06, 0xf2c94c, 0, .08, .38, h); },
      umbrella: function (h) { cyl(.025, .025, 1.2, 0x8a6a4f, .55, -.6, 0, h, 6); cone(.95, .42, 0xd64545, .55, .55, 0, h, 16); cone(.96, .05, 0xf2c94c, .55, .55, 0, h, 16); sph(.06, 0x8a6a4f, .55, .98, 0, h, 6); }
    };

    // kind：hats 裡的名字；"none" 或空值＝拿掉帽子
    function setHat(g, kind) {
      var ud = g.userData, par = ud.hatParent || g;
      if (ud.hat) { par.remove(ud.hat); ud.hat = null; }
      if (!kind || kind === "none") return;
      var h = new THREE.Group(); h.position.y = ud.hatOff || 2.3; par.add(h); ud.hat = h;
      if (hats[kind]) hats[kind](h);
    }

    return { human: human, penguin: penguin, setHat: setHat, hats: hats, blink: blink, walkPose: walkPose };
  }

  // 每一格呼叫：每 2.5～5.5 秒眨一次眼
  function blink(ud, dt) {
    ud.blink -= dt; var s = ud.blink < 0 && ud.blink > -.13 ? .15 : 1;
    ud.eyes.forEach(function (e) { e.scale.y = s; });
    if (ud.blink < -.13) ud.blink = 2.5 + Math.random() * 3;
  }

  // 玩家的走路／待機動作。const pose = walkPose(); 每一格 pose(userData, dt, 經過秒數, 移動速度)
  // 速度 6 以上是全速擺動；停下來時身體微微呼吸、每 5 秒拍一下翅膀
  function walkPose() {
    var walkT = 0, idleT = 0;
    return function (ud, dt, t, speed) {
      var k = Math.min(1, speed / 6); walkT += dt * (4 + speed * 1.6) * (k > .02 ? 1 : 0);
      var sw = Math.sin(walkT);
      ud.L[0].rotation.x = sw * .6 * k; ud.L[1].rotation.x = -sw * .6 * k; ud.body.rotation.z = sw * .14 * k; ud.body.position.y = Math.abs(sw) * .1 * k;
      if (k > .02) { ud.A[0].rotation.z = -.25 - Math.abs(Math.cos(walkT)) * .6 * k; ud.A[1].rotation.z = .25 + Math.abs(Math.cos(walkT)) * .6 * k; idleT = 0; }
      else { idleT += dt; var flap = (idleT % 5 > 4.4) ? Math.sin((idleT % 5 - 4.4) * 30) * .5 : 0; ud.A[0].rotation.z = -.15 - Math.max(0, flap); ud.A[1].rotation.z = .15 + Math.max(0, flap); ud.body.scale.y = 1 + Math.sin(t * 2.4) * .018; ud.head.rotation.z = Math.sin(t * .7) * .08; }
      if (ud.tailG) ud.tailG.rotation.x = -.2 - k * .5 + Math.sin(t * 6) * .08 * k;
      ud.head.rotation.x = -k * .12; blink(ud, dt);
    };
  }

  global.Avatar3D = { create: create, blink: blink, walkPose: walkPose };
})(window);
