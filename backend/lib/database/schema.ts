import { Prisma, PrismaClient } from '../../src/generated/prisma'

export type Dataset = Prisma.datasetsGetPayload<{}>
export type Product = Prisma.productsGetPayload<{}>
export type Sale = Prisma.salesGetPayload<{}>
export type DailyAnalytics = Prisma.daily_analyticsGetPayload<{}>

export type DateRange = { startDate: Date; endDate: Date }

export type UpsertSalesRow = {
  productName: string
  date: Date
  quantity: number
  hasPromo?: boolean
  source?: string
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { prisma }
