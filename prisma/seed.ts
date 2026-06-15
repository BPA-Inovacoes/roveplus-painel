import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@roveplus.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash },
    create: {
      nome: 'Administrador',
      email,
      password: hash,
      role: 'admin',
    },
  })
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS password_plain TEXT
  `)
  await prisma.$executeRawUnsafe(
    'UPDATE "User" SET password_plain = $1 WHERE id = $2',
    password,
    user.id
  )
  console.log('Admin criado:', user.email)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
