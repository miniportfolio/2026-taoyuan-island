/* static-merge.js — 靜態物件合併（效能優化）
 * 問題：場景裡每個小零件都是獨立的 Mesh，每一畫格要對顯示卡下幾千次繪圖指令（draw call），電腦就會卡。
 * 做法：
 *   1. 快轉模擬一段動畫（呼叫 sample(t)），記下哪些物件的位置／旋轉／縮放／顯示／材質／形狀會變 → 視為「會動」
 *   2. 不會動、而且目前看得到的 Mesh，依「同材質＋同陰影設定＋同屬性格式＋同一塊區域」分組，各組合併成一個 Mesh
 *   3. 原本的 Mesh 保留在場景裡但設為隱藏：Raycaster 不檢查 visible，所以點擊物件（PICK）照常可用
 * 不依賴其他檔案（需要 THREE r128 左右）。
 *
 * 用法：
 *   StaticMerge.run({
 *     THREE, scene,
 *     sample: t => ANIM.forEach(f => f(t, 1/60)),   // 依時間 t 驅動所有「純時間」動畫
 *     exclude: [player, boss, ...],                 // 由程式控制、模擬不到的動態物件（連同子物件都不合併）
 *     span: 24, samples: 61,                        // 模擬幾秒、取樣幾次
 *     cell: 60                                      // 合併區塊大小（世界座標單位），太大會失去視錐裁切
 *   }) → { meshes, merged, groups, skipped, moving, singles, movingObjects, anchored }（統計數字，除錯用）
 */
(function (global) {
  "use strict";

  function run(o) {
    var THREE = o.THREE, scene = o.scene;
    var span = o.span || 24, samples = o.samples || 61, cell = o.cell || 30;

    // ---- 1. 拍快照 ----
    var all = [];
    scene.traverse(function (obj) { all.push(obj); });
    function snap(obj) {
      var s = {
        p: obj.position.toArray(), q: obj.quaternion.toArray(), s: obj.scale.toArray(),
        v: obj.visible, m: obj.material, g: obj.geometry, gv: null
      };
      if (obj.geometry && obj.geometry.attributes) {
        var a = obj.geometry.attributes, k = [];
        for (var n in a) k.push(n + ":" + a[n].version);
        s.gv = k.join("|");
      }
      return s;
    }
    var base = new Map();
    all.forEach(function (obj) { base.set(obj, snap(obj)); });
    function same(a, b) {
      for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
      return true;
    }
    function changed(obj) {
      var a = base.get(obj), b = snap(obj);
      return !(same(a.p, b.p) && same(a.q, b.q) && same(a.s, b.s) &&
        a.v === b.v && a.m === b.m && a.g === b.g && a.gv === b.gv);
    }

    // ---- 2. 快轉模擬，找出會動的物件 ----
    var moving = new Set();
    if (o.sample) {
      for (var i = 0; i < samples; i++) {
        var t = 0.37 + i * span / samples;
        try { o.sample(t); } catch (e) { /* 單一動畫出錯不影響整體 */ }
        all.forEach(function (obj) { if (!moving.has(obj) && changed(obj)) moving.add(obj); });
      }
      // 還原到模擬前的狀態
      all.forEach(function (obj) {
        var s = base.get(obj);
        obj.position.fromArray(s.p); obj.quaternion.fromArray(s.q); obj.scale.fromArray(s.s);
        obj.visible = s.v;
        if (s.m !== undefined && obj.material !== s.m) obj.material = s.m;
      });
    }
    var excluded = new Set();
    (o.exclude || []).forEach(function (x) { if (x) excluded.add(x); });

    // ---- 3. 篩選可合併的 Mesh ----
    scene.updateMatrixWorld(true);
    // anchor：最近一個「會動」的上層物件。沒有 → 在世界座標合併；有 → 在它的座標系裡合併，合併結果掛在它底下跟著動
    // 回傳 false 代表不能合併（自己會動、被排除、或中間有隱藏的上層）
    function anchorOf(obj) {
      if (moving.has(obj)) return false;
      for (var q = obj; q && q !== scene; q = q.parent) if (excluded.has(q)) return false;
      if (!obj.visible) return false;
      for (var q2 = obj.parent; q2 && q2 !== scene; q2 = q2.parent) {
        if (moving.has(q2)) return q2;
        if (!q2.visible) return false;
      }
      return null;
    }
    function floatAttr(a) {
      return a && !a.isInterleavedBufferAttribute && a.array instanceof Float32Array;
    }
    var groups = new Map(), skipped = 0, total = 0, movingSkip = 0, tmp = new THREE.Vector3(), inv = new THREE.Matrix4();
    all.forEach(function (m) {
      if (!m.isMesh) return;
      total++;
      var g = m.geometry, mat = m.material;
      var ok = !m.isInstancedMesh && !m.isSkinnedMesh && g && g.isBufferGeometry && mat && !Array.isArray(mat) &&
        !mat.transparent && m.renderOrder === 0 && !g.morphAttributes.position && floatAttr(g.attributes.position) &&
        true;
      var anc = ok ? anchorOf(m) : false;
      if (ok && anc === false) { ok = false; if (m.visible) movingSkip++; }
      if (ok) {
        for (var n in g.attributes) if (!floatAttr(g.attributes[n])) { ok = false; break; }
      }
      if (!ok) { skipped++; return; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      tmp.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld);
      var sig = Object.keys(g.attributes).sort().map(function (n) { return n + g.attributes[n].itemSize; }).join(",");
      var key = mat.uuid + "|" + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0) + "|" + sig + "|" +
        (anc ? "a" + anc.uuid : Math.floor(tmp.x / cell) + "," + Math.floor(tmp.z / cell));
      if (!groups.has(key)) groups.set(key, { anchor: anc, list: [] });
      groups.get(key).list.push(m);
    });

    // 世界座標裡同區塊只有一個的，改成不分區塊再分一次（零星物件也能合併）
    var regroup = new Map();
    groups.forEach(function (G, key) {
      if (G.anchor || G.list.length > 1) return;
      var k2 = key.slice(0, key.lastIndexOf("|")) + "|any";
      if (!regroup.has(k2)) regroup.set(k2, { anchor: null, list: [] });
      regroup.get(k2).list.push(G.list[0]);
      groups.delete(key);
    });
    regroup.forEach(function (G, k2) { groups.set(k2, G); });

    // ---- 4. 合併 ----
    var nm = new THREE.Matrix3(), v = new THREE.Vector3(), merged = 0, made = 0, single = 0, anchoredGroups = 0;
    var rel = new THREE.Matrix4();
    groups.forEach(function (G) {
      var list = G.list, anc = G.anchor;
      if (list.length < 2) { single++; return; }
      var first = list[0], names = Object.keys(first.geometry.attributes), vCount = 0, iCount = 0;
      list.forEach(function (m) {
        var g = m.geometry;
        vCount += g.attributes.position.count;
        iCount += g.index ? g.index.count : g.attributes.position.count;
      });
      var out = {}, idx = new Uint32Array(iCount), vo = 0, io = 0;
      names.forEach(function (n) { out[n] = new Float32Array(vCount * first.geometry.attributes[n].itemSize); });
      list.forEach(function (m) {
        var g = m.geometry, count = g.attributes.position.count;
        var mw = anc ? rel.copy(inv.copy(anc.matrixWorld).invert()).multiply(m.matrixWorld) : m.matrixWorld;
        nm.getNormalMatrix(mw);
        var flip = mw.determinant() < 0;
        names.forEach(function (n) {
          var a = g.attributes[n], src = a.array, sz = a.itemSize, dst = out[n], off = vo * sz;
          if (n === "position" || n === "normal") {
            for (var k = 0; k < count; k++) {
              v.fromArray(src, k * sz);
              if (n === "position") v.applyMatrix4(mw); else v.applyMatrix3(nm).normalize();
              dst[off + k * 3] = v.x; dst[off + k * 3 + 1] = v.y; dst[off + k * 3 + 2] = v.z;
            }
          } else dst.set(src.subarray(0, count * sz), off);
        });
        var gi = g.index, n2 = gi ? gi.count : count;
        for (var k = 0; k < n2; k += 3) {          // 鏡像縮放要翻轉三角形方向，背面裁切才不會出錯
          var a0 = gi ? gi.array[k] : k, a1 = gi ? gi.array[k + 1] : k + 1, a2 = gi ? gi.array[k + 2] : k + 2;
          idx[io++] = vo + a0;
          idx[io++] = vo + (flip ? a2 : a1);
          idx[io++] = vo + (flip ? a1 : a2);
        }
        vo += count;
      });
      var geo = new THREE.BufferGeometry();
      names.forEach(function (n) { geo.setAttribute(n, new THREE.BufferAttribute(out[n], first.geometry.attributes[n].itemSize)); });
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      var mesh = new THREE.Mesh(geo, first.material);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.name = "static-merge";
      if (anc) anc.add(mesh); else { mesh.matrixAutoUpdate = false; scene.add(mesh); }
      list.forEach(function (m) { m.visible = false; });   // 保留給點擊用
      merged += list.length; made++; if (anc) anchoredGroups++;
    });

    return { meshes: total, merged: merged, groups: made, skipped: skipped, moving: movingSkip, singles: single, movingObjects: moving.size, anchored: anchoredGroups };
  }

  global.StaticMerge = { run: run };
})(typeof window !== "undefined" ? window : this);
