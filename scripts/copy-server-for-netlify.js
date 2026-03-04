/**
 * Copia server/dist para netlify/functions/_server para a Netlify Function
 * conseguir importar a app Express. Deve correr após npm run build:api.
 */
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'server', 'dist')
const dest = path.join(__dirname, '..', 'netlify', 'functions', '_server')

if (!fs.existsSync(src)) {
  console.warn('copy-server-for-netlify: server/dist não encontrado (correr build:api primeiro?)')
  process.exit(0)
}

function copyRecursive (srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name)
    const destPath = path.join(destDir, name)
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

copyRecursive(src, dest)
console.log('copy-server-for-netlify: server/dist copiado para netlify/functions/_server')
