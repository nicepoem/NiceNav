<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 全宽彩色玻璃块：交错漂浮
 * 色相走 --c；明暗透明度/描边由主题变量控制
 */
const paused = ref(false)

function syncPause() {
  paused.value = document.hidden
}

onMounted(() => {
  syncPause()
  document.addEventListener('visibilitychange', syncPause)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncPause)
})

const tiles = [
  { x: '-4%', y: '10%', w: '200px', h: '58px', rot: '-22deg', c: '244, 114, 140', dur: '9s', delay: '0s', dx: '28px', dy: '-16px', drot: '10deg', scale: '1.06' },
  { x: '8%', y: '52%', w: '168px', h: '50px', rot: '18deg', c: '251, 146, 100', dur: '11s', delay: '-1.5s', dx: '-24px', dy: '18px', drot: '-8deg', scale: '0.94' },
  { x: '18%', y: '6%', w: '186px', h: '54px', rot: '-10deg', c: '96, 165, 250', dur: '10s', delay: '-3s', dx: '22px', dy: '14px', drot: '9deg', scale: '1.05' },
  { x: '30%', y: '48%', w: '210px', h: '52px', rot: '14deg', c: '167, 139, 250', dur: '12s', delay: '-0.8s', dx: '-30px', dy: '-12px', drot: '-11deg', scale: '0.96' },
  { x: '42%', y: '8%', w: '176px', h: '56px', rot: '-26deg', c: '52, 211, 153', dur: '8.5s', delay: '-4s', dx: '20px', dy: '20px', drot: '7deg', scale: '1.08' },
  { x: '52%', y: '55%', w: '192px', h: '48px', rot: '12deg', c: '244, 114, 160', dur: '10.5s', delay: '-2.2s', dx: '-18px', dy: '-20px', drot: '-9deg', scale: '0.93' },
  { x: '62%', y: '14%', w: '164px', h: '54px', rot: '-16deg', c: '250, 204, 100', dur: '9.5s', delay: '-5s', dx: '26px', dy: '12px', drot: '8deg', scale: '1.04' },
  { x: '72%', y: '50%', w: '188px', h: '50px', rot: '20deg', c: '125, 185, 250', dur: '11.5s', delay: '-1s', dx: '-22px', dy: '16px', drot: '-10deg', scale: '0.95' },
  { x: '82%', y: '8%', w: '172px', h: '56px', rot: '-14deg', c: '165, 150, 250', dur: '8s', delay: '-3.5s', dx: '16px', dy: '-14px', drot: '12deg', scale: '1.07' },
  { x: '90%', y: '48%', w: '158px', h: '48px', rot: '24deg', c: '94, 210, 170', dur: '12.5s', delay: '-2.8s', dx: '-28px', dy: '10px', drot: '-7deg', scale: '0.94' },
  { x: '2%', y: '78%', w: '148px', h: '44px', rot: '28deg', c: '251, 146, 120', dur: '10s', delay: '-4.5s', dx: '24px', dy: '-10px', drot: '-6deg', scale: '1.05' },
  { x: '88%', y: '76%', w: '154px', h: '46px', rot: '-28deg', c: '180, 160, 250', dur: '9s', delay: '-6s', dx: '-20px', dy: '14px', drot: '9deg', scale: '0.96' },
] as const
</script>

<template>
  <div class="page-glass" :class="{ 'is-paused': paused }" aria-hidden="true">
    <span
      v-for="(t, i) in tiles"
      :key="i"
      class="page-glass__tile"
      :style="{
        '--x': t.x,
        '--y': t.y,
        '--w': t.w,
        '--h': t.h,
        '--rot': t.rot,
        '--c': t.c,
        '--dur': t.dur,
        '--delay': t.delay,
        '--dx': t.dx,
        '--dy': t.dy,
        '--drot': t.drot,
        '--scale': t.scale,
      }"
    />
  </div>
</template>

<style scoped lang="scss">
.page-glass {
  position: absolute;
  inset: 0;
  width: 100%;
  pointer-events: none;
  overflow: hidden;
}

.page-glass__tile {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--w);
  height: var(--h);
  border-radius: 18px;
  background: rgba(var(--c), var(--nn-glass-tile-alpha, 0.34));
  border: 1px solid var(--nn-glass-tile-border);
  box-shadow: var(--nn-glass-tile-shadow);
  transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
  transform-origin: 50% 50%;
  --move: 1;
  opacity: 0.92;
  animation:
    nn-glass-wander var(--dur) ease-in-out infinite,
    nn-glass-breathe calc(var(--dur) * 0.7) ease-in-out infinite;
  animation-delay: var(--delay), var(--delay);
}

.page-glass.is-paused .page-glass__tile {
  animation-play-state: paused;
}

@keyframes nn-glass-wander {
  0% {
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
  }
  25% {
    transform: translate3d(
        calc(var(--dx) * var(--move, 1) * 0.55),
        calc(var(--dy) * var(--move, 1) * -0.35),
        0
      )
      rotate(calc(var(--rot) + var(--drot) * var(--move, 1) * 0.4))
      scale(calc(1 + (var(--scale) - 1) * 0.45));
  }
  50% {
    transform: translate3d(
        calc(var(--dx) * var(--move, 1)),
        calc(var(--dy) * var(--move, 1)),
        0
      )
      rotate(calc(var(--rot) + var(--drot) * var(--move, 1)))
      scale(var(--scale));
  }
  75% {
    transform: translate3d(
        calc(var(--dx) * var(--move, 1) * 0.35),
        calc(var(--dy) * var(--move, 1) * 0.7),
        0
      )
      rotate(calc(var(--rot) + var(--drot) * var(--move, 1) * 0.55))
      scale(calc(1 + (var(--scale) - 1) * 0.25));
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
  }
}

@keyframes nn-glass-breathe {
  0%,
  100% {
    opacity: var(--nn-glass-tile-opacity-min, 0.78);
  }
  50% {
    opacity: var(--nn-glass-tile-opacity-max, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-glass__tile {
    animation: none;
    opacity: 0.9;
  }
}

@media (max-width: 900px) {
  .page-glass {
    /* 手机端整体更淡，不抢搜索栏 */
    --nn-glass-tile-alpha: 0.22;
    --nn-glass-tile-opacity-min: 0.55;
    --nn-glass-tile-opacity-max: 0.78;
  }

  .page-glass__tile {
    width: calc(var(--w) * 0.52);
    height: calc(var(--h) * 0.68);
    border-radius: 12px;
    --move: 0.4;
  }

  /* 只留 5 块，摆在四周留白，避开搜索栏中心 */
  .page-glass__tile:nth-child(n + 6) {
    display: none;
  }

  .page-glass__tile:nth-child(1) {
    left: -10%;
    top: 4%;
  }

  .page-glass__tile:nth-child(2) {
    left: 68%;
    top: -6%;
  }

  .page-glass__tile:nth-child(3) {
    left: -12%;
    top: 62%;
  }

  .page-glass__tile:nth-child(4) {
    left: 72%;
    top: 58%;
  }

  .page-glass__tile:nth-child(5) {
    left: 36%;
    top: 82%;
    width: calc(var(--w) * 0.42);
  }
}

@media (max-width: 480px) {
  .page-glass__tile {
    width: calc(var(--w) * 0.44);
    height: calc(var(--h) * 0.62);
    --move: 0.28;
  }

  .page-glass__tile:nth-child(n + 5) {
    display: none;
  }
}
</style>
