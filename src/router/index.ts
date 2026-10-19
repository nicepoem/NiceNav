import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

const isExtension = import.meta.env.VITE_APP_TARGET === 'extension'

const router = createRouter({
  history: isExtension
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { moduleId: 'nav' },
    },

    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router
