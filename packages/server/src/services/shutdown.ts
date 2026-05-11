import { logger } from './logger'
import { closeDb } from '../db'
import { getGatewayManagerInstance } from './gateway-bootstrap'

function shouldStopGatewaysOnShutdown(signal: string): boolean {
  const override = process.env.HERMES_WEB_UI_STOP_GATEWAYS_ON_SHUTDOWN?.trim()
  if (override === '1' || override === 'true') return true
  if (override === '0' || override === 'false') return false

  const lifecycle = process.env.npm_lifecycle_event
  const isDevServer = Boolean(process.env.TS_NODE_DEV)
    || lifecycle === 'dev'
    || lifecycle === 'dev:server'
    || process.env.NODE_ENV === 'development'

  return signal !== 'SIGUSR2' && !isDevServer
}

export function bindShutdown(server: any, groupChatServer?: any, chatRunServer?: any): void {
  let isShuttingDown = false

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    // Force exit after 3s no matter what
    setTimeout(() => process.exit(0), 3000)

    logger.info('Shutting down (%s)...', signal)

    try {
      if (shouldStopGatewaysOnShutdown(signal)) {
        // Stop gateway processes owned by this Web UI instance first.
        try {
          const gatewayManager = getGatewayManagerInstance()
          if (gatewayManager) {
            await gatewayManager.stopAll()
            logger.info('All gateways stopped')
          }
        } catch (err) {
          logger.warn(err, 'Failed to stop gateways (non-fatal)')
        }
      } else {
        logger.info('Skipping gateway shutdown for %s', signal)
      }

      // Close ChatRunSocket first to abort all active runs and close EventSource connections
      if (chatRunServer) {
        chatRunServer.close()
        logger.info('ChatRunSocket closed')
      }

      // Disconnect Socket.IO before HTTP server to prevent hanging
      if (groupChatServer) {
        groupChatServer.agentClients.disconnectAll()
        groupChatServer.getIO().close()
        logger.info('Socket.IO closed')
      }

      const servers = Array.isArray(server) ? server : [server].filter(Boolean)
      if (servers.length) {
        await Promise.all(servers.map((httpServer) => (
          new Promise<void>((resolve) => {
            httpServer.close(() => {
              logger.info('HTTP server closed')
              resolve()
            })
          })
        )))
      }
    } catch (err) {
      logger.error(err, 'Shutdown error')
    }

    closeDb()
    process.exit(0)
  }

  process.once('SIGUSR2', shutdown)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
