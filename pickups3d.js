/* pickups3d.js — 3D 可撿物品（區塊 #9 的 3D 部分，抽自桃園政策島的隱藏寶物）
 * 場景裡的物品會旋轉、上下浮動、底下光圈明暗閃爍；玩家走到旁邊就自動撿起。
 * 物品長什麼樣子、撿到給什麼獎勵由 App 決定。用法見 docs/pickups3d-使用說明.md
 */
(function (global) {
  "use strict";

  // list   [{ g: 物品群組, glow: 光圈 mesh（可省略）, x, z, … }]
  // t      目前時間（秒）
  // px, pz 玩家位置
  // o.taken(item)  這個物品是否已經撿過（撿過就不動也不檢查）
  // o.onPick(item) 走到旁邊時呼叫（App 自己隱藏物品、存檔、給獎勵）
  // o.enabled      false 時只播動畫、不檢查撿取（例如俯瞰模式）
  // o.radius       撿取距離（預設 1.4）
  // o.baseY / o.bob / o.spin  高度（預設 .7）、浮動幅度（預設 .12）、旋轉速度（預設 1.2）
  function update(list, t, px, pz, o) {
    var radius = o.radius == null ? 1.4 : o.radius;
    var baseY = o.baseY == null ? .7 : o.baseY, bob = o.bob == null ? .12 : o.bob, spin = o.spin == null ? 1.2 : o.spin;
    list.forEach(function (it, k) {
      if (o.taken(it)) return;
      it.g.rotation.y = t * spin;
      it.g.position.y = baseY + Math.sin(t * 3 + k) * bob;
      if (it.glow) it.glow.material.opacity = .3 + Math.sin(t * 3 + k) * .15;
      if (o.enabled !== false && Math.hypot(it.x - px, it.z - pz) < radius) o.onPick(it);
    });
  }

  global.Pickups3D = { update: update };
})(window);
