import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import clientsRoutes from './routes/clients.js'
import servidoresRoutes from './routes/servidores.js'
import revendedoresRoutes from './routes/revendedores.js'
import salasRoutes from './routes/salas.js'
import indicacoesRoutes from './routes/indicacoes.js'
import auditRoutes from './routes/audit.js'
import cronRoutes from './routes/cron.js'
import usersRoutes from './routes/users.js'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(cookieParser())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/servidores', servidoresRoutes)
app.use('/api/revendedores', revendedoresRoutes)
app.use('/api/salas', salasRoutes)
app.use('/api/indicacoes', indicacoesRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/cron', cronRoutes)
app.use('/api/users', usersRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

export default app
