import Index from '@/pages/index.vue';
import Songs from '@/pages/songs.vue';
import Merged from '@/pages/merged.vue';
import NotFound from '@/pages/not-found.vue';

export const routes = [
  { path: '/', component: Index },
  { path: '/songs', component: Songs },
  { path: '/merged', component: Merged },
  { path: '/:path(.*)', component: NotFound },
];

export default routes;
