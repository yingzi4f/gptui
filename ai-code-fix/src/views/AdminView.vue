<template>
  <div class="admin-layout">
    <el-container>
      <!-- 左侧导航 -->
      <el-aside width="200px">
        <div class="logo">
          <h3>管理控制台</h3>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="admin-menu"
          @select="handleMenuSelect">
          <el-menu-item index="teams">
            <el-icon><Folder /></el-icon>
            <span>团队管理</span>
          </el-menu-item>
          <el-menu-item index="users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="models">
            <el-icon><Monitor /></el-icon>
            <span>模型管理</span>
          </el-menu-item>
          <el-menu-item index="chats">
            <el-icon><ChatRound /></el-icon>
            <span>会话管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <!-- 顶部栏 -->
        <el-header>
          <div class="header-content">
            <h2>{{ menuTitles[activeMenu] }}</h2>
            <div class="user-info">
              <span>{{ displayTeamName }}</span>
              <el-button type="text" @click="handleLogout">退出登录</el-button>
            </div>
          </div>
        </el-header>
        
        <!-- 主内容区 -->
        <el-main>
          <!-- 团队管理 -->
          <div v-show="activeMenu === 'teams'">
            <div class="action-bar">
              <el-button type="primary" @click="dialogVisible = true">
                创建团队
              </el-button>
            </div>
            
            <el-card>
              <el-table :data="teams" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="name" label="团队名称">
                  <template #default="scope">
                    <el-button 
                      type="text" 
                      @click="showTeamMembers(scope.row)">
                      {{ scope.row.name }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="sessionId" label="会话ID" />
                <el-table-column fixed="right" label="操作" width="200">
                  <template #default="scope">
                    <el-button 
                      type="primary" 
                      link 
                      @click="showAssignUserDialog(scope.row)">
                      添加成员
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>

            <!-- 团队成员展示对话框 -->
            <el-dialog
              v-model="teamMembersVisible"
              :title="`${currentTeam.name || '未选择团队'} - 团队成员`"
              width="50%">
              <el-table :data="teamMembers" style="width: 100%">
                <el-table-column prop="username" label="用户名" />
                <el-table-column prop="role" label="角色">
                  <template #default="scope">
                    <el-tag :type="scope.row.role === 'ADMIN' ? 'danger' : scope.row.isLeader ? 'warning' : 'success'">
                      {{ scope.row.role }}{{ scope.row.isLeader ? '(组长)' : '' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column fixed="right" label="操作" width="200">
                  <template #default="scope">
                    <el-button 
                      type="primary" 
                      link
                      :disabled="scope.row.role === 'ADMIN' || scope.row.isLeader"
                      @click="setTeamLeader(scope.row)">
                      设为组长
                    </el-button>
                    <el-popconfirm
                      :title="`确定要将 ${scope.row.username} 移出团队吗？`"
                      @confirm="removeUserFromTeam(scope.row)">
                      <template #reference>
                        <el-button 
                          type="danger" 
                          link
                          :disabled="scope.row.role === 'ADMIN' || scope.row.isLeader">
                          移除
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-dialog>
          </div>

          <!-- 用户管理 -->
          <div v-show="activeMenu === 'users'">
            <div class="action-bar">
              <el-button type="primary" @click="showAddUserDialog">
                添加用户
              </el-button>
            </div>
            
            <el-card>
              <el-table :data="users" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="username" label="用户名" />
                <el-table-column prop="role" label="角色">
                  <template #default="scope">
                    <el-tag :type="scope.row.role === 'ADMIN' ? 'danger' : 'success'">
                      {{ scope.row.role }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="所属团队">
                  <template #default="scope">
                    <span v-if="scope.row.team">{{ scope.row.team.name }}</span>
                    <span v-else class="no-team">未分配团队</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>

          <!-- 模型管理 -->
          <div v-show="activeMenu === 'models'">
            <div class="action-bar">
              <el-button type="primary" @click="showAddModelDialog">
                添加模型
              </el-button>
            </div>
            
            <el-card>
              <el-table :data="models" style="width: 100%">
                <el-table-column prop="name" label="模型名称" />
                <el-table-column fixed="right" label="操作" width="120">
                  <template #default="scope">
                    <el-popconfirm
                      :title="`确定要删除模型 ${scope.row.name} 吗？`"
                      @confirm="deleteModel(scope.row)">
                      <template #reference>
                        <el-button type="danger" link>删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>

          <!-- 会话管理 -->
          <div v-show="activeMenu === 'chats'">
            <div class="action-bar">
              <el-button 
                type="danger" 
                @click="clearChatHistory(null, null)">
                清空所有团队会话
              </el-button>
            </div>
            
            <el-card>
              <el-table :data="teams" style="width: 100%">
                <el-table-column prop="name" label="团队名称">
                  <template #default="scope">
                    <el-button 
                      type="text" 
                      @click="showChatHistory(scope.row.id, scope.row.name)">
                      {{ scope.row.name }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="sessionId" label="会话ID" />
                <el-table-column fixed="right" label="操作" width="120">
                  <template #default="scope">
                    <el-button 
                      type="danger" 
                      link
                      @click="clearChatHistory(scope.row.id, scope.row.name)">
                      清空会话
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>

            <!-- 会话记录对话框 -->
            <el-dialog
              v-model="chatHistoryVisible"
              title="会话记录"
              width="80%">
              <div class="chat-history">
                <div v-for="message in chatMessages" 
                     :key="message.id"
                     class="chat-message"
                     :class="{ 'user-message': message.role === 'user' }">
                  <div class="message-header">
                    <span class="username">{{ message.username }}</span>
                    <span class="role-tag" :class="message.role">{{ message.role }}</span>
                    <span v-if="message.modelName" class="model-name">
                      模型: {{ message.modelName }}
                    </span>
                    <span class="time">{{ formatTime(message.createdAt) }}</span>
                  </div>
                  <div class="message-content" v-html="marked(message.content)"></div>
                </div>
              </div>
            </el-dialog>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <!-- 创建团队对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="创建团队"
      width="30%">
      <el-form :model="teamForm">
        <el-form-item label="团队名称">
          <el-input v-model="teamForm.teamName" placeholder="请输入团队名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="createTeam">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加用户到团队对话框 -->
    <el-dialog
      v-model="assignDialogVisible"
      title="添加团队成员"
      width="40%">
      <el-form :model="assignForm">
        <el-form-item label="团队名称">
          <el-input v-model="assignForm.teamName" disabled />
        </el-form-item>
        <el-form-item label="选择用户">
          <el-select 
            v-model="assignForm.targetUsername" 
            placeholder="请选择用户"
            style="width: 100%">
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="user.username"
              :value="user.username"
              :disabled="user.role === 'ADMIN'"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="assignDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="assignUserToTeam">确认</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加用户对话框 -->
    <el-dialog
      v-model="addUserDialogVisible"
      title="添加用户"
      width="30%">
      <el-form :model="userForm" ref="userFormRef" :rules="userRules">
        <el-form-item 
          label="用户名"
          prop="username">
          <el-input v-model="userForm.username" />
        </el-form-item>
        <el-form-item 
          label="角色"
          prop="role">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option label="普通用户" value="USER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addUserDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="addUser">确认</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加模型对话框 -->
    <el-dialog
      v-model="addModelDialogVisible"
      title="添加模型"
      width="30%">
      <el-form :model="modelForm" ref="modelFormRef" :rules="modelRules">
        <el-form-item 
          label="模型名称"
          prop="name">
          <el-input v-model="modelForm.name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <div class="dialog-footer-left">
            <el-dropdown @command="handleLocalModelSelect">
              <el-button type="primary" plain>
                导入本地模型
                <el-icon class="el-icon--right">
                  <arrow-down />
                </el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="model in localModels"
                    :key="model"
                    :command="model">
                    {{ model }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="dialog-footer-right">
            <el-button @click="addModelDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="addModel">确认</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, User, Monitor, ArrowDown, ChatRound } from '@element-plus/icons-vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// 确保图标正确导入
const icons = { Folder, User, Monitor, ChatRound }

const router = useRouter()
const activeMenu = ref('teams')
const menuTitles = {
  teams: '团队管理',
  users: '用户管理',
  models: '模型管理',
  chats: '会话管理'
}

// 对话框控制
const dialogVisible = ref(false)
const assignDialogVisible = ref(false)
const addUserDialogVisible = ref(false)
const addModelDialogVisible = ref(false)

// 数据
const teams = ref([])
const users = ref([])
const models = ref([])

// 表单
const teamForm = reactive({
  teamName: '',
  username: ''
})

const assignForm = reactive({
  username: '',
  teamName: '',
  targetUsername: ''
})

const userForm = ref({
  username: '',
  role: 'USER'
})

const modelForm = ref({
  name: ''
})

const userRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ]
}

const modelRules = {
  name: [
    { required: true, message: '请输入模型名称', trigger: 'blur' }
  ]
}

const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

// 确保即使 team 为 null 也能正常显示
const displayTeamName = computed(() => userInfo.value.team?.name || '系统管理员')

// 添加新的状态变量
const teamMembersVisible = ref(false)
const teamMembers = ref([])
const currentTeam = ref({})

// 添加本地模型状态
const localModels = ref([])

// 添加会话管理相关的状态
const chatHistoryVisible = ref(false)
const currentSessionId = ref('')
const chatMessages = ref([])

// 添加新的状态
const teamChatHistories = ref([])

// 配置 marked
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return code
  }
})

// 添加格式化时间的函数
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

// 菜单选择
const handleMenuSelect = (index) => {
  activeMenu.value = index
}

// 显示添加用户对话框
const showAddUserDialog = () => {
  userForm.value = {
    username: '',
    role: 'USER'
  }
  addUserDialogVisible.value = true
}

// 添加用户
const addUser = async () => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...userForm.value,
        password: '123123'
      })
    })
    
    if (response.ok) {
      ElMessage.success('添加用户成功')
      addUserDialogVisible.value = false
      await fetchUsers()
    } else {
      ElMessage.error('添加用户失败')
    }
  } catch (error) {
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 获取团队列表
const fetchTeams = async () => {
  try {
    const response = await fetch('/api/teams/list')
    if (response.ok) {
      const data = await response.json()
      teams.value = data
    } else {
      throw new Error('获取团队列表失败')
    }
  } catch (error) {
    console.error('获取团队列表失败:', error)
    ElMessage.error(error.message || '获取团队列表失败')
  }
}

// 获取用户列表
const fetchUsers = async () => {
  try {
    const response = await fetch('/api/users')
    const data = await response.json()
    users.value = data
  } catch (error) {
    ElMessage.error('获取用户列表失败')
  }
}

// 获取模型列表
const fetchModels = async () => {
  try {
    const response = await fetch('/api/models')
    const data = await response.json()
    models.value = data
  } catch (error) {
    ElMessage.error('获取模型列表失败')
  }
}

// 创建团队
const createTeam = async () => {
  if (!teamForm.teamName.trim()) {
    ElMessage.warning('请输入团队名称')
    return
  }

  try {
    const response = await fetch('/api/teams/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName: teamForm.teamName.trim(),
        username: userInfo.value.username
      })
    })

    if (response.ok) {
      ElMessage.success('创建团队成功')
      dialogVisible.value = false
      teamForm.teamName = ''
      await fetchTeams()
    } else {
      throw new Error('创建团队失败')
    }
  } catch (error) {
    console.error('创建团队失败:', error)
    ElMessage.error(error.message || '创建团队失败')
  }
}

// 显示添加用户对话框
const showAssignUserDialog = (team) => {
  currentTeam.value = team
  assignForm.teamName = team.name
  assignForm.targetUsername = ''
  assignDialogVisible.value = true
}

// 添加用户到团队
const assignUserToTeam = async () => {
  if (!assignForm.targetUsername) {
    ElMessage.warning('请选择要添加的用户')
    return
  }

  try {
    const response = await fetch('/api/teams/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: userInfo.value.username,
        teamName: currentTeam.value.name,
        targetUsername: assignForm.targetUsername
      })
    })

    if (response.ok) {
      ElMessage.success('添加成员成功')
      assignDialogVisible.value = false
      assignForm.targetUsername = ''
      await showTeamMembers(currentTeam.value)
    } else {
      throw new Error('添加成员失败')
    }
  } catch (error) {
    console.error('添加成员失败:', error)
    ElMessage.error(error.message || '添加成员失败')
  }
}

// 显示团队成员
const showTeamMembers = async (team) => {
  currentTeam.value = team
  teamMembersVisible.value = true
  
  try {
    const response = await fetch(`/api/teams/${team.id}/members`)
    const data = await response.json()
    
    if (response.ok) {
      teamMembers.value = data.map(member => ({
        ...member,
        isLeader: member.teamRole === 'LEADER'
      }))
    } else {
      throw new Error(data.error || '获取团队成员失败')
    }
  } catch (error) {
    console.error('获取团队成员失败:', error)
    ElMessage.error(error.message || '获取团队成员失败')
  }
}

// 移除团队成员
const removeUserFromTeam = async (user) => {
  try {
    const response = await fetch(`/api/users/${user.username}/teams/${currentTeam.value.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: userInfo.value.username
      })
    })
    
    if (response.ok) {
      ElMessage.success('移除成员成功')
      // 刷新团队成员列表
      await showTeamMembers(currentTeam.value)
      // 刷新用户列表
      await fetchUsers()
    } else {
      ElMessage.error('移除成员失败')
    }
  } catch (error) {
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 获取本地模型列表
const fetchLocalModels = async () => {
  try {
    const response = await fetch('/api/models/local')
    const data = await response.json()
    localModels.value = data
  } catch (error) {
    ElMessage.error('获取本地模型列表失败')
  }
}

// 选择本地模型
const handleLocalModelSelect = (modelName) => {
  modelForm.value.name = modelName
}

// 显示添加模型对话框
const showAddModelDialog = async () => {
  modelForm.value.name = ''
  addModelDialogVisible.value = true
  // 打开对话框时获取本地模型列表
  await fetchLocalModels()
}

// 添加模型
const addModel = async () => {
  try {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modelForm.value)
    })
    
    if (response.ok) {
      ElMessage.success('添加模型成功')
      addModelDialogVisible.value = false
      await fetchModels()
    } else {
      ElMessage.error('添加模型失败')
    }
  } catch (error) {
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 删除模型
const deleteModel = async (model) => {
  try {
    const response = await fetch(`/api/models/name/${model.name}`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      ElMessage.success('删除模型成功')
      await fetchModels()
    } else {
      ElMessage.error('删除模型失败')
    }
  } catch (error) {
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 添加设置组长的函数
const setTeamLeader = async (user) => {
  try {
    const response = await fetch('/api/users/set-team-leader', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: user.username,
        teamId: currentTeam.value.id
      })
    })

    const data = await response.json()
    
    if (response.ok) {
      ElMessage.success(`已将 ${data.username} 设置为团队组长`)
      // 刷新团队成员列表
      await showTeamMembers(currentTeam.value)
      // 刷新用户列表
      await fetchUsers()
    } else {
      throw new Error(data.error || '设置组长失败')
    }
  } catch (error) {
    console.error('设置组长失败:', error)
    ElMessage.error(error.message || '设置组长失败')
  }
}

// 修改获取会话记录的函数
const showChatHistory = async (teamId, teamName) => {
  try {
    const admininfo = userInfo.value.username
    const response = await fetch(`/api/admin/chat-history/all?username=${admininfo}`)
    if (response.ok) {
      const data = await response.json()
      // 找到对应团队的聊天记录
      const teamHistory = data.find(history => history.teamId === teamId)
      if (teamHistory) {
        chatMessages.value = teamHistory.messages.sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        )
        chatHistoryVisible.value = true
      } else {
        ElMessage.warning('该团队暂无聊天记录')
      }
    } else {
      throw new Error('获取会话记录失败')
    }
  } catch (error) {
    console.error('获取会话记录失败:', error)
    ElMessage.error(error.message || '获取会话记录失败')
  }
}

// 修改清空会话记录的函数
const clearChatHistory = async (teamId, teamName) => {
  try {
    // 第一次确认
    await ElMessageBox.confirm(
      teamId ? `是否清空 ${teamName} 的会话记录？` : '是否清空所有团队的会话记录？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 第二次确认，使用更强烈的警告
    await ElMessageBox.confirm(
      teamId ? 
        '此操作将永久删除该团队的所有聊天记录，是否继续？' : 
        '此操作将永久删除所有团队的聊天记录，此操作不可恢复，是否继续？',
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )

    // 根据是否有teamId选择不同的接口
    const url = teamId ?
      `/api/admin/chat-history/clear/${teamId}?username=admin` :
      '/api/admin/chat-history/clear-all?username=admin'
    
    const response = await fetch(url, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      ElMessage.success(teamId ? '该团队会话记录已清空' : '所有团队会话记录已清空')
      chatHistoryVisible.value = false
      chatMessages.value = []
      // 重新获取聊天记录
      if (teamId) {
        await showChatHistory(teamId, teamName)
      }
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

const handleLogout = () => {
  localStorage.removeItem('userInfo')
  router.push('/login')
}

onMounted(() => {
  fetchTeams()
  fetchUsers()
  fetchModels()
})
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.el-container {
  height: 100vh;
}

.el-aside {
  background-color: #304156;
  color: #fff;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #1f2d3d;
}

.logo h3 {
  color: #fff;
  margin: 0;
}

.admin-menu {
  border-right: none;
  background-color: transparent;
}

:deep(.el-menu) {
  background-color: transparent;
}

:deep(.el-menu-item) {
  color: #bfcbd9;
}

:deep(.el-menu-item.is-active) {
  color: #409EFF;
  background-color: #263445;
}

.el-header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
}

.header-content {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.el-main {
  background-color: #f5f7f9;
  padding: 20px;
}

.action-bar {
  margin-bottom: 20px;
}

.el-card {
  margin-bottom: 20px;
}

:deep(.el-tag) {
  text-transform: lowercase;
}

/* 添加新的样式 */
:deep(.el-button--text) {
  margin: 0;
  padding: 0;
  font-size: inherit;
}

:deep(.el-button--text:hover) {
  color: #409EFF;
}

/* 添加新的样式 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-footer-right {
  display: flex;
  gap: 12px;
}

:deep(.el-dropdown-menu__item) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

/* 添加未分配团队的样式 */
.no-team {
  color: #909399;
  font-style: italic;
}

/* 修改会话记录样式 */
.chat-history {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
}

.chat-message {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 8px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
}

.chat-message.user-message {
  background-color: #e7f1ff;
  border-color: #cce4ff;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  font-size: 12px;
}

.username {
  font-weight: bold;
  color: #2c3e50;
}

.role-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  text-transform: capitalize;
}

.role-tag.user {
  background-color: #409eff;
  color: white;
}

.role-tag.assistant {
  background-color: #67c23a;
  color: white;
}

.model-name {
  color: #606266;
  font-size: 11px;
  background-color: #f4f4f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.time {
  color: #909399;
  margin-left: auto;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

/* Markdown 样式 */
.message-content :deep(p) {
  margin: 0 0 1em;
}

.message-content :deep(pre) {
  background-color: #282c34;
  border-radius: 6px;
  padding: 16px;
  margin: 8px 0;
  overflow-x: auto;
}

.message-content :deep(code) {
  font-family: 'Fira Code', monospace;
  font-size: 14px;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style> 