/* hexnav.js — 六角格地圖＋尋路（區塊 #3，抽自桃園政策島）
 * 三件事：
 *   1. grid：六角格座標（軸座標 q,r）換成平面位置、算中心、找出相鄰的格子
 *   2. 可走範圍：六角形島（hub）＋島與島之間的橋；判斷某點能不能走、橋上的拱起高度、某點在哪座島
 *   3. 尋路：每座島有中心＋6 個邊緣導航點，橋兩端各一個入口點，用 Dijkstra 找最短路線
 * 只管「機制」：島和橋長什麼樣子（模型、顏色、欄杆）由 App 自己畫。
 * 不需要 three.js。用法見 docs/hexnav-使用說明.md
 */
(function (global) {
  "use strict";

  function rad(a) { return a * Math.PI / 180; }

  // cells：{ id: [q, r], ... }（軸座標）；spacing：相鄰兩格中心的距離
  // 回傳 { cellPos([q,r]) → [x,z], cx, cz（所有格子的平均中心）, adj：[[idA,idB], ...] 相鄰的格子對 }
  function grid(cells, spacing) {
    var cellPos = function (c) { return [(c[0] + c[1] / 2) * spacing, c[1] * spacing * Math.sin(Math.PI / 3)]; };
    var ids = Object.keys(cells);
    var ps = ids.map(function (id) { return cellPos(cells[id]); });
    var cx = ps.reduce(function (a, p) { return a + p[0]; }, 0) / ps.length;
    var cz = ps.reduce(function (a, p) { return a + p[1]; }, 0) / ps.length;
    var nb = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], adj = [];
    for (var a = 0; a < ids.length; a++) for (var b = a + 1; b < ids.length; b++) {
      var dq = cells[ids[b]][0] - cells[ids[a]][0], dr = cells[ids[b]][1] - cells[ids[a]][1];
      if (nb.some(function (n) { return n[0] === dq && n[1] === dr; })) adj.push([ids[a], ids[b]]);
    }
    return { cellPos: cellPos, cx: cx, cz: cz, adj: adj };
  }

  // 建立一張可走地圖。o（全部可省略，預設值＝政策島目前的手感）：
  //   o.edgeInset      邊緣導航點離島邊多遠（2.2）
  //   o.walkMargin     inHex 預設的內縮距離，角色不會走到島的最邊緣（.6）
  //   o.bridgeWalk     橋面可走的半寬（1.05）
  //   o.archHalfWidth  橋面拱起高度的計算半寬（1.6）
  //   o.archHeight / o.archRatio  橋拱最高多高（1.3）、或橋長 × 比例（.2），取比較小的
  //   o.bridgeOverlap  橋頭伸進島裡多少（.5）
  //   o.entryInset     橋入口導航點離島邊多遠（.7）
  //   o.directDist     同一座島、距離小於這個值就直接走直線（4.5）
  function create(o) {
    o = o || {};
    var EI = o.edgeInset == null ? 2.2 : o.edgeInset, WM = o.walkMargin == null ? .6 : o.walkMargin,
      BW = o.bridgeWalk == null ? 1.05 : o.bridgeWalk, AW = o.archHalfWidth == null ? 1.6 : o.archHalfWidth,
      AH = o.archHeight == null ? 1.3 : o.archHeight, AR = o.archRatio == null ? .2 : o.archRatio,
      OV = o.bridgeOverlap == null ? .5 : o.bridgeOverlap, EN = o.entryInset == null ? .7 : o.entryInset,
      DIR = o.directDist == null ? 4.5 : o.directDist;
    var HUBS = [], BRIDGES = [], NODES = [];

    // 加一座六角形島（尖角朝 ±z）。group 可放 App 自己的模型群組，方便之後找
    function addHub(x, z, r, group) {
      var hub = { x: x, z: z, r: r, ap: r * Math.cos(Math.PI / 6), group: group, bdirs: [], edge: [] };
      HUBS.push(hub); return hub;
    }
    function inHex(h, x, z, m) {
      if (m === undefined) m = WM;
      var dx = x - h.x, dz = z - h.z;
      for (var k = 0; k < 6; k++) { var a = rad(30 + k * 60); if (dx * Math.sin(a) + dz * Math.cos(a) > h.ap - m) return false; }
      return true;
    }
    function segD(px, pz, ax, az, bx, bz) {
      var dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(px - ax - t * dx, pz - az - t * dz);
    }
    function walkable(x, z) {
      return HUBS.some(function (h) { return inHex(h, x, z); }) || BRIDGES.some(function (b) { return segD(x, z, b.ax, b.az, b.bx, b.bz) < BW; });
    }
    function heightAt(x, z) {
      for (var i = 0; i < BRIDGES.length; i++) {
        var b = BRIDGES[i], d = (x - b.ax) * b.ux + (z - b.az) * b.uz;
        if (d <= b.s || d >= b.e) continue;
        var lat = Math.abs(-(x - b.ax) * b.uz + (z - b.az) * b.ux);
        if (lat < AW) return b.H * Math.sin(Math.PI * (d - b.s) / (b.e - b.s));
      }
      return 0;
    }
    function node(x, z, hub) { var n = { x: x, z: z, hub: hub, adj: [] }; NODES.push(n); return n; }
    function link(a, b) { var d = Math.hypot(a.x - b.x, a.z - b.z); a.adj.push([b, d]); b.adj.push([a, d]); }
    function nearestOf(list, x, z, k) {
      return list.map(function (n) { return [n, Math.hypot(n.x - x, n.z - z)]; }).sort(function (a, b) { return a[1] - b[1]; }).slice(0, k);
    }
    // 島的導航點：中心＋6 個邊緣點（都連到中心）
    function makeNav(h) {
      h.c = node(h.x, h.z, h);
      for (var k = 0; k < 6; k++) {
        var a = rad(k * 60);
        var n = node(h.x + Math.cos(a) * (h.ap - EI), h.z + Math.sin(a) * (h.ap - EI), h);
        link(n, h.c); h.edge.push(n);
      }
    }
    // 登記一座橋（A、B 兩座島都要先 makeNav）。回傳畫橋需要的數字：
    //   ux,uz 方向、L 兩島中心距離、s,e 橋頭橋尾（從 A 中心量起）、len 橋長、H 拱高
    function addBridge(A, B) {
      var dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      var s = A.ap - OV, e = L - B.ap + OV, len = e - s, H = Math.min(AH, len * AR);
      BRIDGES.push({ ax: A.x, az: A.z, bx: B.x, bz: B.z, ux: ux, uz: uz, s: s, e: e, H: H });
      A.bdirs.push(Math.atan2(uz, ux)); B.bdirs.push(Math.atan2(-uz, -ux));
      var eA = node(A.x + ux * (A.ap - EN), A.z + uz * (A.ap - EN), A), eB = node(B.x - ux * (B.ap - EN), B.z - uz * (B.ap - EN), B);
      eA.entry = eB.entry = 1; link(eA, eB);
      link(eA, nearestOf(A.edge, eA.x, eA.z, 1)[0][0]); link(eB, nearestOf(B.edge, eB.x, eB.z, 1)[0][0]);
      return { ux: ux, uz: uz, L: L, s: s, e: e, len: len, H: H };
    }
    function hubAt(x, z) { return HUBS.find(function (h) { return inHex(h, x, z, 0); }); }
    // 從 (fx,fz) 到 (tx,tz) 的路線：[{x,z}, ...]，最後一點就是目的地
    function route(fx, fz, tx, tz) {
      var hs = hubAt(fx, fz), ht = hubAt(tx, tz);
      if (hs && hs === ht && Math.hypot(tx - fx, tz - fz) < DIR) return [{ x: tx, z: tz }];
      var cand = function (x, z, h) {
        return h ? nearestOf(NODES.filter(function (n) { return n.hub === h; }), x, z, 3) : nearestOf(NODES.filter(function (n) { return n.entry; }), x, z, 2);
      };
      var dist = new Map(), prev = new Map(), open = new Set();
      cand(fx, fz, hs).forEach(function (p) { dist.set(p[0], p[1]); prev.set(p[0], null); open.add(p[0]); });
      var goals = new Map(cand(tx, tz, ht).map(function (p) { return [p[0], p[1]]; })), best = null, bestC = 1e9;
      while (open.size) {
        var c = null, cd = 1e9;
        open.forEach(function (n) { if (dist.get(n) < cd) { cd = dist.get(n); c = n; } });
        open.delete(c);
        if (cd >= bestC) break;
        if (goals.has(c) && cd + goals.get(c) < bestC) { bestC = cd + goals.get(c); best = c; }
        c.adj.forEach(function (p) {
          var n = p[0], nd = cd + p[1];
          if (nd < (dist.has(n) ? dist.get(n) : 1e9)) { dist.set(n, nd); prev.set(n, c); open.add(n); }
        });
      }
      var wp = [], cur = best;
      while (cur) { wp.unshift({ x: cur.x, z: cur.z }); cur = prev.get(cur); }
      wp.push({ x: tx, z: tz }); return wp;
    }

    return { HUBS: HUBS, BRIDGES: BRIDGES, NODES: NODES, addHub: addHub, makeNav: makeNav, addBridge: addBridge, node: node, link: link,
      inHex: inHex, segD: segD, walkable: walkable, heightAt: heightAt, hubAt: hubAt, route: route, nearestOf: nearestOf };
  }

  global.HexNav = { grid: grid, create: create, rad: rad };
})(window);
