import Index from '@/pages/index.vue';
import Songs from '@/pages/songs.vue';
import NotFound from '@/pages/not-found.vue';

export const routes = [
  { path: '/', component: Index },
  { path: '/songs', component: Songs },
  { path: '/:path(.*)', component: NotFound },
];

export default routes;
