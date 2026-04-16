import SourceSelector from '@/pages/source-selector.vue';
import Query from '@/pages/query.vue';
import Songs from '@/pages/songs.vue';
import Status from '@/pages/status.vue';
import Covers from '@/pages/covers.vue';
import NotFound from '@/pages/not-found.vue';

export const routes = [
  { path: '/', component: SourceSelector },
  { path: '/query', component: Query },
  { path: '/songs', component: Songs },
  { path: '/status', component: Status },
  { path: '/covers', component: Covers },
  { path: '/:path(.*)', component: NotFound },
];

export default routes;
