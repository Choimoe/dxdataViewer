export const routes = [
  { path: '/', component: () => import('@/pages/source-selector.vue') },
  { path: '/query', component: () => import('@/pages/query.vue') },
  { path: '/songs', component: () => import('@/pages/songs.vue') },
  { path: '/status', component: () => import('@/pages/status.vue') },
  { path: '/covers', component: () => import('@/pages/covers.vue') },
  { path: '/:path(.*)', component: () => import('@/pages/not-found.vue') },
];

export default routes;
