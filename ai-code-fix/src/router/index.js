import { createRouter, createWebHistory } from 'vue-router'

// 使用异步导入所有组件，避免直接导入可能的问题
const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../views/ChatView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAuth: true, role: 'ADMIN' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 简化路由守卫
router.beforeEach((to, from, next) => {
  const userInfoStr = localStorage.getItem('userInfo')
  
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!userInfoStr) {
      next('/login')
      return
    }
    
    try {
      const userInfo = JSON.parse(userInfoStr)
      console.log('Current user:', userInfo) // 添加调试日志
      
      if (to.path === '/admin' && userInfo.role !== 'ADMIN') {
        next('/chat')
      } else {
        next()
      }
    } catch (e) {
      console.error('Invalid userInfo in localStorage:', e)
      localStorage.removeItem('userInfo')
      next('/login')
    }
  } else {
    next()
  }
})

export default router 