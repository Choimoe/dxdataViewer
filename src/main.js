import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import '@/assets/styles/main.css';
import '@/assets/styles/tailwind.css';
import App from '@/app.vue';
import { routes } from '@/routes.js';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

const app = createApp(App);

app.use(router);
app.mount('#app');

const bootShell = document.getElementById('boot-shell');
if (bootShell) {
  bootShell.classList.add('hidden');
  window.setTimeout(() => {
    bootShell.remove();
  }, 220);
}

const loadFonts = () => import('@/assets/styles/fonts.css');

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => {
    loadFonts();
  });
} else {
  window.setTimeout(() => {
    loadFonts();
  }, 1200);
}
