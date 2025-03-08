<template>
  <div class="chat-layout">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <!-- 用户信息 -->
      <div class="user-info-header">
        <div class="user-info">
          <span class="username">{{ userInfo.username }}</span>
          <span v-if="userInfo.isTeamLeader" class="leader-badge">组长</span>
        </div>
        <el-button type="text" @click="handleLogout">退出登录</el-button>
      </div>

      <!-- 团队会话部分 -->
      <div v-if="userInfo.team" class="chat-section">
        <div class="team-info">
          <h3>{{ userInfo.team.name }}</h3>
        </div>
        
        <!-- 团队成员列表 -->
        <div class="team-members">
          <div class="section-title">团队成员</div>
          <div v-for="member in teamMembers" 
               :key="member.username" 
               class="member-item">
            <div class="member-info">
              <span class="member-name">{{ member.username }}</span>
              <span v-if="member.role === 'TEAM_LEADER'" 
                    class="leader-badge">组长</span>
            </div>
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

        <!-- 团队聊天入口 -->
        <div class="team-chat-section">
          <div class="section-title">
            <span>团队聊天</span>
            <el-button 
              v-if="userInfo.isTeamLeader"
              type="danger" 
              link 
              size="small"
              @click.stop="clearTeamChat">
              清空会话
            </el-button>
          </div>
          <div class="history-item team-chat"
               :class="{ active: currentSessionType === 'team' }"
               @click="switchToTeamChat">
            <el-icon><ChatRound /></el-icon>
            <span class="chat-title">团队聊天室</span>
          </div>
        </div>
      </div>

      <!-- 个人会话部分 -->
      <div class="chat-section">
        <div class="section-header">
          <div class="section-title">个人会话</div>
          <el-button 
            type="primary" 
            size="small" 
            @click="createAndOpenPersonalChat">
            新建会话
          </el-button>
        </div>
        <div v-for="session in personalSessions" 
             :key="session.sessionId" 
             class="history-item"
             @click="openPersonalChat(session.sessionId)">
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
              @click.stop="deletePersonalSession(session.sessionId)">
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

    <!-- 添加重命名对话框 -->
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

// 添加自动刷新相关的状态
const autoRefreshInterval = ref(null)
const lastMessageTimestamp = ref(0)

// 添加团队成员相关的状态
const teamMembers = ref([])
const isTeamLeader = computed(() => {
  return userInfo.value.isTeamLeader
})

// 添加状态管理
const userSessions = ref([])
const currentSessionId = ref('')

// 添加个人会话和团队会话的状态管理
const personalSessions = ref([])
const teamSessions = ref([])
const currentSessionType = ref('team') // 'team' 或 'personal'

// 获取用户的所有会话列表
const fetchUserSessions = async () => {
  try {
    const response = await fetch(`/api/chat/sessions/${userInfo.value.username}`)
    if (response.ok) {
      const data = await response.json()
      userSessions.value = data
    }
  } catch (error) {
    console.error('获取会话列表失败:', error)
  }
}

// 获取特定会话的聊天记录
const fetchChatHistory = async (sessionId) => {
  try {
    const response = await fetch(`/api/chat/history/${userInfo.value.username}/${sessionId}`)
    if (response.ok) {
      const data = await response.json()
      messages.value = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      await scrollToBottom()
    }
  } catch (error) {
    console.error('获取聊天记录失败:', error)
  }
}

// 获取团队会话历史记录
const fetchTeamChatHistory = async () => {
  if (!userInfo.value.team?.sessionId) return
  
  try {
    const response = await fetch(`/api/team-chat/history//${userInfo.value.team.sessionId}`)
    if (response.ok) {
      const data = await response.json()
      messages.value = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      await scrollToBottom()
    }
  } catch (error) {
    console.error('获取团队聊天记录失败:', error)
  }
}

// 切换会话
const switchSession = async (sessionId) => {
  currentSessionId.value = sessionId
  await fetchChatHistory(sessionId)
}

// 切换到团队会话
const switchToTeamChat = async () => {
  currentSessionType.value = 'team'
  try {
    const response = await fetch(`/api/team-chat/history/${userInfo.value.username}/${userInfo.value.team.sessionId}`)
    if (response.ok) {
      const data = await response.json()
      messages.value = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      
      // 更新最新消息时间戳
      if (messages.value.length > 0) {
        lastMessageTimestamp.value = new Date(messages.value[messages.value.length - 1].createdAt).getTime()
      }
      
      await scrollToBottom()
      // 启动自动刷新
      startAutoRefresh()
    }
  } catch (error) {
    console.error('获取团队聊天记录失败:', error)
  }
}

// 删除会话
const deleteSession = async (sessionId) => {
  try {
    const response = await fetch(`/api/chat/history/${userInfo.value.username}/${sessionId}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      ElMessage.success('会话已删除')
      if (currentSessionId.value === sessionId) {
        messages.value = []
        currentSessionId.value = ''
      }
      await fetchUserSessions()
    }
  } catch (error) {
    console.error('删除会话失败:', error)
    ElMessage.error('删除会话失败')
  }
}

// 开始新对话
const startNewChat = () => {
  currentSessionId.value = ''  // 清空当前会话ID
  messages.value = []         // 清空消息列表
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

// 获取团队会话列表
const fetchTeamSessions = async () => {
  if (!userInfo.value.username) return
  
  try {
    const response = await fetch(`/api/team-chat/sessions/${userInfo.value.username}`)
    if (response.ok) {
      const data = await response.json()
      teamSessions.value = data
    }
  } catch (error) {
    console.error('获取团队会话列表失败:', error)
  }
}

// 获取个人会话列表
const fetchPersonalSessions = async () => {
  try {
    const response = await fetch(`/api/personal-chat/sessions/${userInfo.value.username}`)
    if (response.ok) {
      const data = await response.json()
      personalSessions.value = data
    }
  } catch (error) {
    console.error('获取个人会话列表失败:', error)
  }
}

// 创建新的个人会话
const createPersonalSession = async () => {
  try {
    const response = await fetch(`/api/personal-chat/sessions?username=${userInfo.value.username}`, {
      method: 'POST'
    })
    if (response.ok) {
      const data = await response.json()
      await fetchPersonalSessions()
      return data.sessionId
    }
  } catch (error) {
    console.error('创建个人会话失败:', error)
    ElMessage.error('创建个人会话失败')
  }
}

// 删除个人会话
const deletePersonalSession = async (sessionId) => {
  try {
    const response = await fetch(`/api/personal-chat/sessions/${userInfo.value.username}/${sessionId}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      ElMessage.success('会话已删除')
      await fetchPersonalSessions()
    }
  } catch (error) {
    console.error('删除会话失败:', error)
    ElMessage.error('删除会话失败')
  }
}

// 更新个人会话名称
const updateSessionName = async (sessionId, newName) => {
  try {
    const response = await fetch(
      `/api/personal-chat/sessions/${userInfo.value.username}/${sessionId}/name?name=${encodeURIComponent(newName)}`,
      { method: 'PUT' }
    )
    if (response.ok) {
      ElMessage.success('会话名称已更新')
      await fetchPersonalSessions()
    }
  } catch (error) {
    console.error('更新会话名称失败:', error)
    ElMessage.error('更新会话名称失败')
  }
}

// 打开个人会话窗口
const openPersonalChat = (sessionId) => {
  const route = {
    name: 'PersonalChat',
    params: { sessionId },
    query: { username: userInfo.value.username }
  }
  window.open(router.resolve(route).href, '_blank')
}

// 修改获取团队成员的函数
const fetchTeamMembers = async () => {
  // 确保有团队ID
  if (!userInfo.value.team?.id) {
    console.log('No team ID found')
    return
  }
  
  try {
    console.log('Fetching team members for team:', userInfo.value.team.id)
    const response = await fetch(`/api/teams/${userInfo.value.team.id}/members`)
    if (response.ok) {
      const data = await response.json()
      console.log('Team members:', data)
      teamMembers.value = data
    } else {
      throw new Error('获取团队成员失败')
    }
  } catch (error) {
    console.error('获取团队成员失败:', error)
    ElMessage.error('获取团队成员失败')
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
    username: userInfo.value.username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempUserMessage)

  const tempAiMessage = {
    id: Date.now() + 1,
    role: 'assistant',
    content: '',
    username: userInfo.value.username,
    modelName: currentModel.value,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempAiMessage)
  
  await scrollToBottom()

  try {
    // 构建请求体
    const requestBody = {
      username: userInfo.value.username,
      sessionId: userInfo.value.team.sessionId, // 使用团队的sessionId
      modelName: currentModel.value,
      content: userMessage
    }

    console.log('Sending message:', requestBody)

    const response = await fetch('/api/team-chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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
    await fetchTeamChatHistory()
  } catch (error) {
    console.error('发送消息失败:', error)
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

// 自动刷新团队消息
const startAutoRefresh = () => {
  // 清除可能存在的旧定时器
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
  }

  // 每3秒检查一次新消息
  autoRefreshInterval.value = setInterval(async () => {
    if (currentSessionType.value === 'team' && userInfo.value.team?.sessionId) {
      try {
        const response = await fetch(`/api/team-chat/history/${userInfo.value.username}/${userInfo.value.team.sessionId}`)
        if (response.ok) {
          const data = await response.json()
          
          // 检查是否有新消息
          const latestMessages = data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          const latestTimestamp = latestMessages.length > 0 
            ? new Date(latestMessages[latestMessages.length - 1].createdAt).getTime()
            : 0

          if (latestTimestamp > lastMessageTimestamp.value) {
            messages.value = latestMessages
            lastMessageTimestamp.value = latestTimestamp
            await scrollToBottom()
          }
        }
      } catch (error) {
        console.error('自动刷新消息失败:', error)
      }
    }
  }, 3000)
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
    autoRefreshInterval.value = null
  }
}

// 监听用户输入状态
const handleInputFocus = () => {
  isTyping.value = true
}

const handleInputBlur = () => {
  isTyping.value = false
}

// 添加获取用户团队信息的函数
const fetchUserTeamInfo = async () => {
  try {
    const response = await fetch(`/api/teams/user/${userInfo.value.username}`)
    if (response.ok) {
      const data = await response.json()
      if (data) {
        userInfo.value.team = data
        // 如果用户属于团队，自动加载团队会话
        if (data.sessionId) {
          currentSessionId.value = data.sessionId
          currentSessionType.value = 'team'
          await fetchTeamChatHistory()
        }
      }
    }
  } catch (error) {
    console.error('获取用户团队信息失败:', error)
  }
}

// 移除团队成员
const removeTeamMember = async (member) => {
  try {
    const response = await fetch(`/api/teams/${userInfo.value.team.id}/members/${member.username}`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      ElMessage.success('成员已移除')
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

// 添加创建并打开新会话的函数
const createAndOpenPersonalChat = async () => {
  try {
    const sessionId = await createPersonalSession()
    if (sessionId) {
      openPersonalChat(sessionId)
    }
  } catch (error) {
    console.error('创建新会话失败:', error)
    ElMessage.error('创建新会话失败')
  }
}

// 添加重命名对话框
const renameDialogVisible = ref(false)
const newSessionName = ref('')
const currentSession = ref(null)

// 显示重命名对话框
const showRenameDialog = (session) => {
  currentSession.value = session
  newSessionName.value = session.name || ''
  renameDialogVisible.value = true
}

// 执行重命名操作
const handleRename = async () => {
  if (!newSessionName.value.trim()) {
    ElMessage.warning('请输入会话名称')
    return
  }

  await updateSessionName(currentSession.value.sessionId, newSessionName.value.trim())
  renameDialogVisible.value = false
}

// 监听会话类型变化
watch(currentSessionType, (newType) => {
  if (newType === 'team') {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

// 添加清空团队会话的函数
const clearTeamChat = async () => {
  if (!userInfo.value.isTeamLeader || !userInfo.value.team?.sessionId) {
    ElMessage.warning('只有团队组长可以清空会话')
    return
  }

  try {
    // 第一次确认
    await ElMessageBox.confirm(
      '是否清空团队会话记录？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 第二次确认
    await ElMessageBox.confirm(
      '此操作将永久删除所有聊天记录，是否继续？',
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )

    const response = await fetch(
      `/api/team-chat/clear/${userInfo.value.team.sessionId}?username=${userInfo.value.username}`,
      { method: 'DELETE' }
    )

    if (response.ok) {
      ElMessage.success('会话记录已清空')
      messages.value = []
    } else {
      throw new Error('清空会话记录失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空会话记录失败:', error)
      ElMessage.error(error.message || '清空会话记录失败')
    }
  }
}

onMounted(async () => {
  console.log('User info:', userInfo.value)
  if (userInfo.value.team?.id) {
    await fetchTeamMembers()
    // 如果是团队会话，启动自动刷新
    if (currentSessionType.value === 'team') {
      startAutoRefresh()
    }
  }
  await Promise.all([
    fetchModels(),
    fetchTeamChatHistory()
  ])
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
/* 用户信息样式 */
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 团队信息样式 */
.team-info {
  padding: 16px;
  border-bottom: 1px solid #2d4a77;
}

.team-info h3 {
  margin: 0;
  font-size: 16px;
  color: #ffffff;
}

/* 团队成员样式 */
.team-members {
  padding: 16px;
  border-bottom: 1px solid #2d4a77;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  font-size: 14px;
}

.leader-badge {
  background-color: #ffd700;
  color: #1a365d;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

/* 团队聊天部分样式 */
.team-chat-section {
  padding: 16px;
  border-bottom: 1px solid #2d4a77;
}

.team-chat {
  background-color: rgba(45, 74, 119, 0.3);
  border-radius: 6px;
  margin-top: 8px;
}

.team-chat:hover {
  background-color: rgba(45, 74, 119, 0.5);
}

.team-chat.active {
  background-color: rgba(45, 74, 119, 0.7);
}

/* 其他样式保持不变 */
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  margin-bottom: 8px;
}

.session-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .session-actions {
  opacity: 1;
}

/* 修改团队聊天标题样式 */
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
}

.section-title .el-button {
  font-size: 12px;
  padding: 2px 8px;
  height: auto;
  color: #ff4d4f;
}

.section-title .el-button:hover {
  color: #ff7875;
  background-color: rgba(255, 77, 79, 0.1);
}
</style> 