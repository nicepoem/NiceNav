import type { AppModule } from '../types'
import TopNav from './slots/TopNav.vue'
import TopFull from './slots/TopFull.vue'
import LeftSidebar from './slots/LeftSidebar.vue'
import Main from './slots/Main.vue'
import Footer from './slots/Footer.vue'

export const navModule: AppModule = {
  id: 'nav',
  title: '网址导航',
  routePath: '/',
  showLeft: true,
  showRight: false,
  slots: {
    topNav: TopNav,
    topFull: TopFull,
    leftSidebar: LeftSidebar,
    main: Main,
    footer: Footer,
  },
}

export {
  NAV_HOST_KEY,
  NAV_MAIN_HANDLERS_KEY,
  type NavHostContext,
  type NavMainHandlers,
} from './host-context'
