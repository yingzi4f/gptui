<template>
  <div class="chat-layout">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <!-- 团队信息 -->
      <div class="team-info">
        <h3>
          {{ userInfo.team?.name || '未分配团队' }}
          <span v-if="isTeamLeader" class="leader-badge">组长</span>
        </h3>
        <!-- 添加清空按钮 -->
        <el-button 
          v-if="isTeamLeader"
          type="danger" 
          size="small"
          @click="clearChatHistory">
          清空会话
        </el-button>
      </div>

      <!-- 新建聊天按钮 -->
      <div class="new-chat">
        <el-button class="new-chat-btn" @click="startNewChat">
          <el-icon><Plus /></el-icon>
          新对话
        </el-button>
      </div>

      <!-- 团队成员列表 -->
      <div class="team-members">
        <div class="section-title">团队成员</div>
        <div v-for="member in teamMembers" 
             :key="member.id" 
             class="member-item">
          <span class="member-name">
            {{ member.username }}
            <el-tag v-if="member.role === 'TEAM_LEADER'" 
                    size="small" 
                    type="warning">
              组长
            </el-tag>
          </span>
          <el-button 
            v-if="isTeamLeader && member.username !== userInfo.username"
            type="danger" 
            link 
            size="small"
            @click="removeTeamMember(member)">
            移除
          </el-button>
        </div>
      </div>

      <!-- 聊天历史记录 -->
      <div class="chat-history">
        <div v-for="chat in chatHistory" 
             :key="chat.id" 
             class="history-item"
             :class="{ active: currentChatId === chat.id }"
             @click="switchChat(chat.id)">
          <el-icon><ChatRound /></el-icon>
          <span class="chat-title">{{ getHistoryTitle(chat) }}</span>
        </div>
      </div>

      <!-- 底部用户信息 -->
      <div class="sidebar-footer">
        <div class="user-info">
          <span>{{ userInfo.username }}</span>
          <el-button type="text" @click="handleLogout">退出登录</el-button>
        </div>
        <div class="model-selector">
          <el-select v-model="currentModel" class="model-select">
            <el-option
              v-for="model in models"
              :key="model.name"
              :label="model.name"
              :value="model.name"
            />
          </el-select>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="main-content">
      <!-- 聊天消息区域 -->
      <div class="chat-container" ref="chatContainer">
        <template v-if="messages.length">
          <div v-for="message in messages" 
               :key="message.id" 
               class="message-wrapper"
               :class="[message.role === 'user' ? 'user-message' : 'assistant-message']">
            <el-card class="message">
              <!-- 消息头部 -->
              <div class="message-header">
                <span class="username">{{ message.username || '匿名用户' }}</span>
                <span v-if="message.role === 'assistant'" class="model-badge">
                  模型: {{ message.modelName }}
                </span>
                <span class="time">{{ formatTime(message.createdAt) }}</span>
              </div>
              
              <!-- 消息内容 -->
              <div class="message-content">
                <div v-if="message.role === 'assistant' && !message.content" class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
                <div v-else class="message-text">{{ message.content }}</div>
              </div>
            </el-card>
          </div>
        </template>
        <div v-else class="welcome-screen">
          <h1>AI Code Fix</h1>
          <div class="welcome-suggestions">
            <div v-for="(suggestion, index) in suggestions" 
                 :key="index" 
                 class="suggestion-item"
                 @click="usePrompt(suggestion)">
              <el-icon><ChatDotRound /></el-icon>
              <span>{{ suggestion }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-container">
          <el-input
            v-model="userInput"
            type="textarea"
            :rows="3"
            placeholder="输入消息..."
            resize="none"
            @keyup.enter.exact.prevent="sendMessage"
            @keyup.enter.shift.prevent="userInput += '\n'"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
          />
          <el-button 
            class="send-button" 
            type="primary" 
            :disabled="!userInput.trim()" 
            @click="sendMessage">
            <el-icon><Position /></el-icon>
          </el-button>
        </div>
        <div class="input-tip">
          按 Enter 发送消息，Shift + Enter 换行
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, reactive, computed } from 'vue'
import { Plus, ChatRound, Position, ChatDotRound } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const router = useRouter()
const chatContainer = ref(null)
const userInput = ref('')
const messages = ref([])
const currentModel = ref('')
const models = ref([])
const LOCAL_STORAGE_MODEL_KEY = 'selectedModel'

// 从localStorage获取用户信息
const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

// 示例提示
const suggestions = [
  "帮我解释这段代码的问题",
  "如何优化这个函数的性能？",
  "帮我检查代码中的安全漏洞",
  "生成单元测试用例"
]

// 配置 marked
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return code
  }
})

// 添加时间格式化函数
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

// 添加自动刷新相关的变量和函数
const refreshInterval = ref(null)
const lastMessageId = ref(0)
const isTyping = ref(false)

// 添加团队成员相关的状态
const teamMembers = ref([])
const isTeamLeader = computed(() => userInfo.value.role === 'TEAM_LEADER')

// 修改获取历史记录函数
const fetchChatHistory = async (silent = false) => {
  if (!userInfo.value.team?.sessionId) {
    messages.value = []
    return
  }
  
  try {
    const response = await fetch(`/api/chat/history/${userInfo.value.team.sessionId}`)
    if (response.ok) {
      const data = await response.json()
      const sortedData = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      
      // 更新消息列表
      messages.value = sortedData
      lastMessageId.value = Math.max(...sortedData.map(msg => msg.id))
      
      if (!silent) {
        await scrollToBottom()
      }
    }
  } catch (error) {
    console.error('获取聊天记录失败:', error)
  }
}

// 获取模型列表并设置默认模型
const fetchModels = async () => {
  try {
    const response = await fetch('/api/models')
    const data = await response.json()
    models.value = data
    
    // 获取上次选择的模型
    const savedModel = localStorage.getItem(LOCAL_STORAGE_MODEL_KEY)
    if (savedModel && data.some(model => model.name === savedModel)) {
      currentModel.value = savedModel
    } else if (data.length > 0) {
      currentModel.value = data[0].name
    }
  } catch (error) {
    ElMessage.error('获取模型列表失败')
  }
}

// 添加监听模型变化的函数
watch(currentModel, (newModel) => {
  if (newModel) {
    localStorage.setItem(LOCAL_STORAGE_MODEL_KEY, newModel)
  }
})

// 修改发送消息函数
const sendMessage = async () => {
  if (!userInfo.value.team?.sessionId) {
    ElMessage.warning('管理员不能发送消息')
    return
  }

  if (!userInput.value.trim()) return

  const userMessage = userInput.value
  userInput.value = ''

  // 添加临时消息到界面
  const tempUserMessage = {
    id: Date.now(),
    sessionId: userInfo.value.team?.sessionId,
    role: 'user',
    content: userMessage,
    username: userInfo.value.username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempUserMessage)

  // 添加临时的AI响应消息
  const tempAiMessage = {
    id: Date.now() + 1,
    sessionId: userInfo.value.team?.sessionId,
    role: 'assistant',
    content: '',
    username: userInfo.value.username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempAiMessage)
  
  await scrollToBottom()

  try {
    // 创建 EventSource 实例
    const source = new EventSource(
      `/api/chat/stream?sessionId=${userInfo.value.team?.sessionId}&modelName=${currentModel.value}&content=${encodeURIComponent(userMessage)}&username=${encodeURIComponent(userInfo.value.username)}`
    )

    source.onmessage = async (event) => {
      try {
        const jsonData = JSON.parse(event.data)
        if (Array.isArray(jsonData)) {
          const messageContent = jsonData.find(item => 
            item.mediaType === null && 
            item.data && 
            !item.data.includes('id:') && 
            !item.data.includes('event:')
          )
          
          if (messageContent) {
            tempAiMessage.content += messageContent.data
            await nextTick()
            await scrollToBottom()
          }
        }
      } catch (error) {
        console.error('处理消息流失败:', error)
      }
    }

    source.onerror = async () => {
      source.close()
      // 流结束后，从服务器获取完整的对话记录
      await fetchChatHistory()
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    // 移除临时消息
    messages.value = messages.value.filter(msg => msg.id !== tempAiMessage.id)
    ElMessage.error('发送消息失败')
  }
}

const usePrompt = (prompt) => {
  userInput.value = prompt
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const handleLogout = () => {
  localStorage.removeItem('userInfo')
  router.push('/login')
}

// 添加开始自动刷新函数
const startAutoRefresh = () => {
  stopAutoRefresh() // 确保不会重复启动
  refreshInterval.value = setInterval(() => {
    if (!isTyping.value) { // 只在用户不输入时刷新
      fetchChatHistory(true)
    }
  }, 3000) // 每10秒刷新一次
}

// 添加停止自动刷新函数
const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// 监听用户输入状态
const handleInputFocus = () => {
  isTyping.value = true
}

const handleInputBlur = () => {
  isTyping.value = false
}

// 添加获取团队成员的函数
const fetchTeamMembers = async () => {
  if (!userInfo.value.team?.id) {
    teamMembers.value = []
    return
  }
  
  try {
    const response = await fetch(`/api/teams/${userInfo.value.team.id}/members`)
    if (response.ok) {
      const data = await response.json()
      teamMembers.value = data
    } else {
      throw new Error('获取团队成员失败')
    }
  } catch (error) {
    console.error('获取团队成员失败:', error)
    ElMessage.error(error.message || '获取团队成员失败')
  }
}

// 添加移除团队成员的函数
const removeTeamMember = async (member) => {
  try {
    const response = await fetch(`/api/users/${member.username}/teams/${userInfo.value.team.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: "admin"
      })
    })
    
    if (response.ok) {
      ElMessage.success(`已将 ${member.username} 移出团队`)
      await fetchTeamMembers()
    } else {
      throw new Error('移除成员失败')
    }
  } catch (error) {
    console.error('移除成员失败:', error)
    ElMessage.error(error.message || '移除成员失败')
  }
}

// 添加清空会话的函数
const clearChatHistory = async () => {
  try {
    // 第一次确认
    const firstConfirm = await ElMessageBox.confirm(
      '是否删除会话记录？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    if (firstConfirm === 'confirm') {
      // 第二次确认
      const secondConfirm = await ElMessageBox.confirm(
        '真的要删除吗，删除将清空所有数据',
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'danger'
        }
      )
      
      if (secondConfirm === 'confirm') {
        const response = await fetch('/api/chat/clear-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: userInfo.value.team.sessionId
          })
        })
        
        if (response.ok) {
          ElMessage.success('会话记录已清空')
          messages.value = []  // 清空本地消息列表
          await fetchChatHistory()  // 重新获取历史记录
        } else {
          throw new Error('清空会话失败')
        }
      }
    }
  } catch (error) {
    if (error !== 'cancel') {  // 忽略用户取消的情况
      console.error('清空会话失败:', error)
      ElMessage.error(error.message || '清空会话失败')
    }
  }
}

onMounted(() => {
  fetchChatHistory()
  fetchModels()
  startAutoRefresh()
  fetchTeamMembers()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
/* 添加团队信息样式 */
.team-info {
  padding: 16px;
  border-bottom: 1px solid #4b5563;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.team-info h3 {
  color: #fff;
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 清空按钮样式 */
.team-info .el-button--danger {
  background-color: transparent;
  border-color: #f56c6c;
  color: #f56c6c;
}

.team-info .el-button--danger:hover {
  background-color: #f56c6c;
  color: #fff;
}

/* 其他现有样式保持不变 */
.chat-layout {
  display: flex;
  height: 100vh;
  background-color: #ffffff;
}

.sidebar {
  width: 260px;
  background-color: #5f5d6d;
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.new-chat {
  padding: 8px;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: transparent;
  border: 1px solid #4b5563;
  color: #ffffff;
}

.new-chat-btn:hover {
  background-color: #2d2d2d;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  margin: 8px 0;
}

.history-item {
  padding: 10px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #2d2d2d;
}

.history-item.active {
  background-color: #343541;
}

.chat-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid #4b5563;
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.model-selector {
  width: 100%;
}

.model-select {
  width: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  max-width: 1200px;  /* 增加最大宽度 */
  margin: 0 auto;
  width: 100%;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  scroll-behavior: smooth;
  scrollbar-width: none;  /* Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
}

/* 隐藏 Webkit 浏览器的滚动条 */
.chat-container::-webkit-scrollbar {
  display: none;
}

.welcome-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  color: #374151;
}

.welcome-screen h1 {
  font-size: 2rem;
  font-weight: 600;
}

.welcome-suggestions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 1100px;  /* 增加最大宽度 */
  padding: 0 16px;
  margin: 0 auto;
}

.suggestion-item {
  padding: 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.suggestion-item:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.message-wrapper {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-start;
  width: 100%;
  max-width: 1100px;  /* 增加最大宽度 */
  margin: 0 auto;
}

.user-message {
  justify-content: flex-end;
}

.message {
  max-width: 85%;     /* 稍微增加消息宽度 */
  width: fit-content; /* 自适应内容宽度 */
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.message.loading {
  background-color: #f9fafb;
}

.user-message .message {
  flex-direction: row-reverse;
}

.message-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 60px;
}

.avatar-name {
  font-weight: bold;
  font-size: 14px;
}

.model-name, .user-role {
  font-size: 12px;
  color: #666;
}

.user-message .model-name, .user-message .user-role {
  color: #fff;
  opacity: 0.8;
}

.message-content {
  padding: 12px 16px;
  line-height: 1.5;
  word-wrap: break-word;
  max-width: 100%;
  min-height: 24px;
}

.message-content :deep(pre) {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}

.message-content :deep(p) {
  margin: 8px 0;
}

.user-message .el-card {
  background-color: #a2c5e8;  /* 改为淡色背景 */
  border: 1px solid #326ba3;
}

.user-message .message-content {
  color: #2c3e50;  /* 改为深色文字 */
}

.user-message .message-header {
  color: #606266;  /* 改为正常颜色 */
}

.user-message .time {
  color: #909399;  /* 改为正常颜色 */
}

.user-message .model-badge {
  background-color: #8181d0;  /* 改为淡色背景 */
  color: #606266;  /* 改为正常颜色 */
}

/* 添加打字指示器样式 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background-color: #d1d5db;
  border-radius: 50%;
  animation: typing 1s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.input-area {
  border-top: 1px solid #e5e7eb;
  padding: 16px 24px;  /* 减小内边距 */
  background-color: #ffffff;
}

.input-container {
  max-width: 1050px;  /* 增加最大宽度 */
  margin: 0 auto;
  position: relative;
}

.input-container :deep(.el-textarea__inner) {
  padding-right: 48px;
  resize: none;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e7eb;
  transition: box-shadow 0.2s;
  height: auto !important;  /* 防止高度变化 */
}

.input-container :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #3b82f6;
  transform: none;  /* 移除放大效果 */
}

.send-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 8px;
  border-radius: 6px;
}

.input-tip {
  text-align: center;
  color: #6b7280;
  font-size: 12px;
  margin-top: 8px;
}

:deep(.el-select) {
  --el-select-border-color-hover: #4b5563;
  --el-select-input-focus-border-color: #4b5563;
}

:deep(.el-select .el-input__wrapper) {
  background-color: transparent;
  box-shadow: 0 0 0 1px #4b5563;
}

:deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #6b7280;
}

:deep(.el-select .el-input__inner) {
  color: #ffffff;
}

/* 添加新的样式 */
.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
}

.username {
  font-weight: bold;
  margin-right: 10px;
}

.model-badge {
  background-color: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.time {
  margin-left: auto;
  color: #999;
}

/* 修改现有样式 */
.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.user-message .message-header {
  color: rgba(255, 255, 255, 0.9);
}

.user-message .model-badge {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.user-message .time {
  color: rgba(255, 255, 255, 0.7);
}

/* 修改侧边栏，添加团队成员列表 */
.team-members {
  padding: 16px;
  border-top: 1px solid #022555;
  border-bottom: 1px solid #06377a;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 16px;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.member-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-badge {
  background-color: #ffd700;
  color: #000;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.el-tag {
  margin-left: 8px;
}
</style> 