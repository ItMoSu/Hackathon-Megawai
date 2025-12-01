import { testDbConnection } from './queries'

;(async () => {
  try {
    await testDbConnection()
    console.log('DB connection ok')
  } catch (error) {
    console.error('DB connection failed', error)
    process.exitCode = 1
  }
})()
