<template>
  <div class="chat-layout">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <!-- 用户信息 -->
      <div class="user-info-header">
        <span>{{ userInfo.username }}</span>
        <el-button type="text" @click="window.close()">关闭窗口</el-button>
      </div>

      <!-- 新建聊天按钮 -->
      <div class="new-chat">
        <el-button class="new-chat-btn" @click="createNewChat">
          <el-icon><Plus /></el-icon>
          新对话
        </el-button>
      </div>

      <!-- 会话列表 -->
      <div class="chat-section">
        <div class="section-title">我的会话</div>
        <div v-for="session in personalSessions" 
             :key="session.sessionId" 
             class="history-item"
             :class="{ active: session.sessionId === currentSessionId }"
             @click="switchSession(session.sessionId)">
          <el-icon><ChatRound /></el-icon>
          <span class="chat-title">{{ session.name || '新会话' }}</span>
          <div class="session-actions">
            <el-button 
              type="primary" 
              link 
              size="small"
              @click.stop="showRenameDialog(session)">
              重命名
            </el-button>
            <el-button 
              type="danger" 
              link 
              size="small"
              @click.stop="deleteSession(session.sessionId)">
              删除
            </el-button>
          </div>
        </div>
      </div>

      <!-- 底部模型选择器 -->
      <div class="sidebar-footer">
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
        <div v-for="message in messages" 
             :key="message.id" 
             class="message-wrapper"
             :class="[message.role === 'user' ? 'user-message' : 'assistant-message']">
          <el-card class="message">
            <div class="message-header">
              <span class="username">{{ message.username }}</span>
              <span v-if="message.role === 'assistant'" class="model-badge">
                模型: {{ message.modelName }}
              </span>
              <span class="time">{{ formatTime(message.createdAt) }}</span>
            </div>
            <div class="message-content">
              <div v-if="message.role === 'assistant' && !message.content" class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
              <div v-else class="message-text">{{ message.content }}</div>
            </div>
          </el-card>
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
          />
          <el-button 
            class="send-button" 
            type="primary" 
            :disabled="!userInput.trim()" 
            @click="sendMessage">
            <el-icon><Position /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名会话"
      width="30%">
      <el-input 
        v-model="newSessionName"
        placeholder="请输入新的会话名称"
        @keyup.enter="handleRename"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleRename">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Position, Plus, ChatRound } from '@element-plus/icons-vue'

const route = useRoute()
const chatContainer = ref(null)
const userInput = ref('')
const messages = ref([])
const currentModel = ref('')
const LOCAL_STORAGE_MODEL_KEY = 'selectedModel'

// 从 localStorage 获取用户信息
const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

// 从路由参数获取会话ID和用户名
const sessionId = route.params.sessionId
const username = route.query.username

// 添加时间格式化函数
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

// 获取模型列表并设置默认模型
const fetchModels = async () => {
  try {
    const response = await fetch('/api/models')
    const data = await response.json()
    const savedModel = localStorage.getItem(LOCAL_STORAGE_MODEL_KEY)
    currentModel.value = savedModel && data.some(model => model.name === savedModel)
      ? savedModel
      : data[0]?.name
  } catch (error) {
    console.error('获取模型列表失败:', error)
  }
}

// 获取会话历史记录
const fetchChatHistory = async () => {
  try {
    const response = await fetch(`/api/personal-chat/history/${username}/${sessionId}`)
    if (response.ok) {
      const data = await response.json()
      messages.value = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      await scrollToBottom()
    }
  } catch (error) {
    console.error('获取聊天记录失败:', error)
  }
}

// 修改发送消息函数
const sendMessage = async () => {
  if (!userInput.value.trim()) return

  const userMessage = userInput.value
  userInput.value = ''

  // 添加用户消息到界面
  const tempUserMessage = {
    id: Date.now(),
    role: 'user',
    content: userMessage,
    username: username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempUserMessage)

  const tempAiMessage = {
    id: Date.now() + 1,
    role: 'assistant',
    content: '',
    username: username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempAiMessage)
  
  await scrollToBottom()

  try {
    // 使用 POST 方法发送消息
    const response = await fetch('/api/personal-chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        sessionId: sessionId,
        content: userMessage,
        modelName: currentModel.value
      })
    })

    if (!response.ok) {
      throw new Error('发送消息失败')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      try {
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.trim()) {
            const jsonData = JSON.parse(line)
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
          }
        }
      } catch (error) {
        console.error('处理消息流失败:', error)
      }
    }

    // 消息发送完成后更新历史记录
    await fetchChatHistory()
  } catch (error) {
    console.error('发送消息失败:', error)
    messages.value = messages.value.filter(msg => msg.id !== tempAiMessage.id)
    ElMessage.error('发送消息失败')
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// 添加会话管理相关的状态
const personalSessions = ref([])
const currentSessionId = ref(route.params.sessionId)
const models = ref([])
const renameDialogVisible = ref(false)
const newSessionName = ref('')
const currentSession = ref(null)

// 获取个人会话列表
const fetchPersonalSessions = async () => {
  try {
    const response = await fetch(`/api/personal-chat/sessions/${username}`)
    if (response.ok) {
      const data = await response.json()
      personalSessions.value = data
    }
  } catch (error) {
    console.error('获取会话列表失败:', error)
  }
}

// 创建新会话
const createNewChat = async () => {
  try {
    const response = await fetch(`/api/personal-chat/sessions?username=${username}`, {
      method: 'POST'
    })
    if (response.ok) {
      const data = await response.json()
      await fetchPersonalSessions()
      window.location.href = `/personal-chat/${data.sessionId}?username=${username}`
    }
  } catch (error) {
    console.error('创建会话失败:', error)
    ElMessage.error('创建会话失败')
  }
}

// 切换会话
const switchSession = (sessionId) => {
  window.location.href = `/personal-chat/${sessionId}?username=${username}`
}

// 删除会话
const deleteSession = async (sessionId) => {
  try {
    const response = await fetch(`/api/personal-chat/sessions/${username}/${sessionId}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      ElMessage.success('会话已删除')
      if (sessionId === currentSessionId.value) {
        window.close()
      } else {
        await fetchPersonalSessions()
      }
    }
  } catch (error) {
    console.error('删除会话失败:', error)
    ElMessage.error('删除会话失败')
  }
}

// 重命名会话
const showRenameDialog = (session) => {
  currentSession.value = session
  newSessionName.value = session.name || ''
  renameDialogVisible.value = true
}

const handleRename = async () => {
  if (!newSessionName.value.trim()) {
    ElMessage.warning('请输入会话名称')
    return
  }

  try {
    const response = await fetch(
      `/api/personal-chat/sessions/${username}/${currentSession.value.sessionId}/name?name=${encodeURIComponent(newSessionName.value.trim())}`,
      { method: 'PUT' }
    )
    if (response.ok) {
      ElMessage.success('会话名称已更新')
      await fetchPersonalSessions()
      renameDialogVisible.value = false
    }
  } catch (error) {
    console.error('更新会话名称失败:', error)
    ElMessage.error('更新会话名称失败')
  }
}

// 修改组件挂载时的初始化
onMounted(async () => {
  await Promise.all([
    fetchModels(),
    fetchChatHistory(),
    fetchPersonalSessions()
  ])
})
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background-color: #ffffff;
}

.sidebar {
  width: 260px;
  background-color: #1a365d;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2d4a77;
}

.user-info-header {
  padding: 20px;
  border-bottom: 1px solid #2d4a77;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.new-chat {
  padding: 20px;
  border-bottom: 1px solid #2d4a77;
}

.chat-section {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
}

.history-item {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-start;
  width: 100%;
  cursor: pointer;
}

.history-item.active {
  background-color: #2d4a77;
}

.chat-title {
  margin-left: 10px;
  font-weight: bold;
}

.session-actions {
  margin-left: auto;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #2d4a77;
}

.model-selector {
  max-width: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.message-wrapper {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-start;
  width: 100%;
}

.user-message {
  justify-content: flex-end;
}

.message {
  max-width: 85%;
  width: fit-content;
  margin: 0;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
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

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

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
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}

.input-container {
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
}

.input-container :deep(.el-textarea__inner) {
  padding-right: 48px;
  resize: none;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e7eb;
  transition: box-shadow 0.2s;
}

.input-container :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #3b82f6;
}

.send-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 8px;
  border-radius: 6px;
}

.user-message .el-card {
  background-color: #f0f7ff;
  border-color: #e1effe;
}

.assistant-message .el-card {
  background-color: #ffffff;
  border-color: #e5e7eb;
}
</style> 