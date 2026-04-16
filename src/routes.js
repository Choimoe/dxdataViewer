import Index from '@/pages/index.vue';
import Songs from '@/pages/songs.vue';
import Status from '@/pages/status.vue';
import NotFound from '@/pages/not-found.vue';

export const routes = [
  { path: '/', component: Index },
  { path: '/songs', component: Songs },
  { path: '/status', component: Status },
  { path: '/:path(.*)', component: NotFound },
];

export default routes;
