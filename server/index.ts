import 'dotenv/config'
import app from './app.js'

const PORT = process.env.PORT || 3001

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Rove+ API em http://localhost:${PORT}`)
  })
}

export default app
