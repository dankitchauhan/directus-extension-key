import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './components/KeyList.vue';

export default defineModule({
  id: 'key-manager',
  name: 'Key Manager',
  icon: 'key',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
});
