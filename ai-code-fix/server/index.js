// 添加前端路由支持
const express = require('express')
const path = require('path')
const app = express()

// API 路由
app.use('/api', apiRoutes)

// 静态文件
app.use(express.static(path.join(__dirname, '../dist')))

// 前端路由支持 - 所有未匹配的路由都返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
}) 