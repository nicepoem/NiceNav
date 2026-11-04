import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initSiteIconCache } from '@/utils/site-icon'
import { registerCategoryIcons } from '@/utils/register-icons'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 命令式 ElMessage / ElMessageBox 不会走按需样式注入，需显式引入
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import './styles/main.scss'

registerCategoryIcons()
initSiteIconCache()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
