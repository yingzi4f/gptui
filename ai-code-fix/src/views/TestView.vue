<template>
  <div class="test-container">
    <h1>测试页面</h1>
    <p>如果你能看到这个页面，说明路由系统正常工作</p>
    <el-button @click="goToAdmin">前往管理页面</el-button>
    <el-button @click="goToChat">前往聊天页面</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToAdmin = () => {
  router.push('/admin')
}

const goToChat = () => {
  router.push('/chat')
}
</script>

<style scoped>
.test-container {
  padding: 20px;
  text-align: center;
}
</style> 