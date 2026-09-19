// ============ 训练页滑动切换 ============
let touchStartX = 0, touchStartY = 0;
document.getElementById('page-training').addEventListener('touchstart', function(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('beforeunload', persistTrainingState);
document.getElementById('page-training').addEventListener('touchend', function(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) switchExercise(1);   // 左滑 -> 下一个动作
    else switchExercise(-1);         // 右滑 -> 上一个动作
  }
}, { passive: true });

// ============ Service Worker 注册（离线缓存） ============
// sw.js 位于部署根目录，作用域覆盖整个应用；发布新版本需递增 sw.js 中的 CACHE_VERSION。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').catch(function(err) {
      console.warn('Service Worker 注册失败（不影响在线使用）:', err);
    });
  });
}

// ============ 初始化 ============
// 显示登录页面
renderLogin();
