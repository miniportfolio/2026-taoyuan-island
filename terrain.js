/* terrain.js — 地形產生器（區塊 #5，抽自桃園政策島）
 * 做「大地」用的零件，地圖長什麼樣子（海岸線位置、山在哪、水庫和河怎麼走）由 App 自己給資料：
 *   1. 欄位（field）：查某一點離海岸／湖／河多遠——lineX、blobField、noise、addBumps
 *   2. 高度地形網格：給一個高度函式＋顏色分層，產生一整片低多邊形地面（heightMesh）
 *   3. 水面：沿著一串圓點鋪出湖面或河面（blobSurface）
 *   4. 散布：在範圍內隨機放東西、跳過不合格的位置、彼此不重疊（scatter、scatterZones、spacer、instances）
 *   5. 小工具：可重現的亂數（seeded）、不規則圓形輪廓（blobPolygon）、平面形狀（shape）
 * 地形需要 three.js（r128 測試過）；欄位、散布、亂數不需要。用法見 docs/terrain-使用說明.md
 */
(function (global) {
  "use strict";

  // ---------- 1. 欄位 ----------

  // 一條沿著 z 方向走的折線（例如海岸線）：points = [[x,z], ...]，z 由小到大
  // 回傳 fn(z) → 線在這個 z 的 x；超出兩端時沿最後一段延伸
  function lineX(points) {
    return function (z) {
      for (var i = 0; i < points.length - 1; i++) {
        var a = points[i], b = points[i + 1];
        if (z <= b[1] || i === points.length - 2) { var t = (z - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * t; }
      }
    };
  }

  // 一串圓點組成的區域（湖、河、港池）：list = [[x,z,半徑], ...]
  // 回傳 fn(x,z) → 到最近圓邊的距離；負數＝在裡面。list 之後再 push 也會算進去
  function blobField(list) {
    return function (x, z) {
      var m = 1e9;
      for (var i = 0; i < list.length; i++) { var p = list[i], d = Math.hypot(x - p[0], z - p[1]) - p[2]; if (d < m) m = d; }
      return m;
    };
  }

  // 平滑起伏的雜訊，大約落在 -1.95 ~ 1.95，用來讓山坡不要太整齊
  function noise(x, z) {
    return Math.sin(x * .07) * Math.cos(z * .06) + Math.sin((x + z) * .045) * .6 + Math.sin(x * .13 - z * .11) * .35;
  }

  // 把幾座小山包疊到高度 h 上：bumps = [[[x,z], 高度, 寬度], ...]（高斯形狀，超過 3 倍寬度就不算）
  function addBumps(h, x, z, bumps) {
    for (var i = 0; i < bumps.length; i++) {
      var b = bumps[i], q = Math.hypot(x - b[0][0], z - b[0][1]) / b[2];
      if (q < 3) h += b[1] * Math.exp(-q * q);
    }
    return h;
  }

  // ---------- 2. 高度地形網格 ----------

  // o.size / o.segments  邊長、每邊切幾格（600 / 220）
  // o.cx, o.cz           網格中心
  // o.height(x,z)        高度函式
  // o.bands              [[低於這個高度, 顏色], ...]，由低到高；o.top 是最高那層的顏色
  // 回傳已加進 scene 的 Mesh（低多邊形、頂點上色、接受陰影）
  function heightMesh(THREE, scene, o) {
    var size = o.size || 600, seg = o.segments || 220;
    var G = new THREE.PlaneGeometry(size, size, seg, seg); G.rotateX(-Math.PI / 2); G.translate(o.cx || 0, 0, o.cz || 0);
    var P = G.attributes.position, cols = [], c = new THREE.Color(), bands = o.bands || [];
    for (var i = 0; i < P.count; i++) {
      var x = P.getX(i), z = P.getZ(i), h = o.height(x, z); P.setY(i, h);
      var hex = o.top;
      for (var k = 0; k < bands.length; k++) if (h < bands[k][0]) { hex = bands[k][1]; break; }
      c.set(hex); cols.push(c.r, c.g, c.b);
    }
    G.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); G.computeVertexNormals();
    var land = new THREE.Mesh(G, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    land.receiveShadow = true; scene.add(land);
    return land;
  }

  // ---------- 3. 水面 ----------

  // 沿 points（[[x,z,半徑], ...]）鋪圓形水面，相鄰兩點距離 ≤ o.join（6）時中間再補一片，接成連續水面
  // o.y 水面高度、o.pad 每片比半徑多大（1.2）、o.material、o.segments 圓的邊數（28）
  // o.dummy 可傳入共用的 Object3D（用完會把旋轉、縮放歸零），不傳就自己建一個
  // 回傳 InstancedMesh（還沒加進 scene）
  function blobSurface(THREE, points, o) {
    var pad = o.pad == null ? 1.2 : o.pad, join = o.join == null ? 6 : o.join;
    var m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, o.segments || 28), o.material, points.length * 2);
    var dm = o.dummy || new THREE.Object3D(), n = 0; dm.rotation.set(-Math.PI / 2, 0, 0);
    points.forEach(function (p) { dm.position.set(p[0], o.y, p[1]); dm.scale.set(p[2] + pad, p[2] + pad, 1); dm.updateMatrix(); m.setMatrixAt(n++, dm.matrix); });
    for (var k = 0; k < points.length - 1; k++) {
      var a = points[k], b = points[k + 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > join) continue;
      dm.position.set((a[0] + b[0]) / 2, o.y, (a[1] + b[1]) / 2);
      var w = (a[2] + b[2]) / 2 + pad; dm.scale.set(w, w, 1); dm.updateMatrix(); m.setMatrixAt(n++, dm.matrix);
    }
    m.count = n; dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); return m;
  }

  // ---------- 4. 散布 ----------

  // 在矩形 (x0,z0)～(x0+w,z0+d) 隨機挑點，最多試 o.tries 次、放滿 o.max 個就停
  // o.place(x,z) 自己決定要不要放、放什麼；回傳 false＝這個位置不要
  // o.rnd 亂數（預設 Math.random）。回傳實際放了幾個
  function scatter(o) {
    var rnd = o.rnd || Math.random, n = 0;
    for (var k = 0; k < o.tries && n < o.max; k++) {
      var x = o.x0 + rnd() * o.w, z = o.z0 + rnd() * o.d;
      if (o.place(x, z) === false) continue;
      n++;
    }
    return n;
  }

  // 分區散布：o.zones = [[x0,z0,x1,z1,數量], ...]，每區最多試 數量 × o.tries（12）次
  function scatterZones(o) {
    var rnd = o.rnd || Math.random, mult = o.tries == null ? 12 : o.tries, total = 0;
    o.zones.forEach(function (zn) {
      var x0 = zn[0], z0 = zn[1], x1 = zn[2], z1 = zn[3], cnt = zn[4];
      for (var k = 0, t = 0; k < cnt && t < cnt * mult; t++) {
        var x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (o.place(x, z) === false) continue;
        k++; total++;
      }
    });
    return total;
  }

  // 不重疊檢查：fits(x,z,半徑,間距) → 和已放的東西都不會太近；add(x,z,半徑) 記下來
  function spacer() {
    var list = [];
    return {
      list: list,
      fits: function (x, z, r, gap) { return !list.some(function (p) { return Math.hypot(p[0] - x, p[1] - z) < p[2] + r + gap; }); },
      add: function (x, z, r) { list.push([x, z, r]); }
    };
  }

  // 同一個形狀放很多份（樹林、草叢）：place(dummy, 項目, i) 設定位置／大小／旋轉
  // dummy 可傳入共用的 Object3D，不傳就自己建一個。回傳 InstancedMesh（還沒加進 scene）
  function instances(THREE, geometry, material, list, place, dummy) {
    var m = new THREE.InstancedMesh(geometry, material, list.length), dm = dummy || new THREE.Object3D();
    list.forEach(function (t, i) { place(dm, t, i); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); });
    return m;
  }

  // ---------- 5. 小工具 ----------

  // 可重現的亂數（同一個種子每次結果一樣），回傳 0～1
  function seeded(seed) {
    var sd = seed;
    return function () { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  }

  // 不規則的橢圓輪廓（埤塘、小湖）：rx, rz 半徑；回傳 [[x,z], ...]
  // o.minSides / o.extraSides 邊數 6～9；o.minR / o.varR 每個點半徑 .8～1.15 倍
  function blobPolygon(rnd, rx, rz, o) {
    o = o || {};
    var ms = o.minSides == null ? 6 : o.minSides, es = o.extraSides == null ? 4 : o.extraSides,
      mr = o.minR == null ? .8 : o.minR, vr = o.varR == null ? .35 : o.varR;
    var vs = ms + (rnd() * es | 0), pts = [];
    for (var v = 0; v < vs; v++) { var a = v / vs * Math.PI * 2, r = mr + rnd() * vr; pts.push([Math.cos(a) * rx * r, Math.sin(a) * rz * r]); }
    return pts;
  }

  // [[x,y], ...] → THREE.Shape（可用 ShapeGeometry 做平面）
  function shape(THREE, pts) {
    var s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(function (p) { s.lineTo(p[0], p[1]); });
    return s;
  }

  global.Terrain = {
    lineX: lineX, blobField: blobField, noise: noise, addBumps: addBumps,
    heightMesh: heightMesh, blobSurface: blobSurface,
    scatter: scatter, scatterZones: scatterZones, spacer: spacer, instances: instances,
    seeded: seeded, blobPolygon: blobPolygon, shape: shape
  };
})(window);
