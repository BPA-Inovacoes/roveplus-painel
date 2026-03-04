/**
 * Netlify Function que expõe a API Express.
 * O build copia server/dist para _server (scripts/copy-server-for-netlify.js).
 */
import serverless from 'serverless-http'
import app from './_server/app.js'

export const handler = serverless(app)
