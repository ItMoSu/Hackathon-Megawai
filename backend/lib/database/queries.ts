import {
  prisma,
  Dataset,
  Product,
  DailyAnalytics,
  UpsertSalesRow,
  DateRange,
} from './schema'

const defaultDatasetStatus = 'pending'
const defaultStoragePath = ''
const defaultSalesSource = 'unknown'

const ensureValidRange = (range: DateRange) => {
  if (!range?.startDate || !range?.endDate) {
    throw new Error('Date range is required')
  }

  const startTime = range.startDate.getTime()
  const endTime = range.endDate.getTime()

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    throw new Error('Invalid date range provided')
  }

  if (startTime > endTime) {
    throw new Error('startDate must be before or equal to endDate')
  }
}

const ensureDatasetForUser = async (userId: string, datasetId: string) => {
  const dataset = await prisma.datasets.findFirst({
    where: { id: datasetId, user_id: userId },
  })

  if (!dataset) {
    throw new Error('Dataset not found for user')
  }

  return dataset
}

const ensureProductForUser = async (
  userId: string,
  datasetId: string,
  productId: string,
) => {
  const product = await prisma.products.findFirst({
    where: { id: productId, dataset_id: datasetId, user_id: userId },
  })

  if (!product) {
    throw new Error('Product not found for user')
  }

  return product
}

/**
 * Create a dataset row scoped to the provided user.
 */
export async function createDataset(
  userId: string,
  payload: { name: string; description?: string | null; sourceFileType?: string | null },
): Promise<Dataset> {
  try {
    if (!userId) {
      throw new Error('userId is required')
    }

    if (!payload?.name) {
      throw new Error('Dataset name is required')
    }

    const dataset = await prisma.datasets.create({
      data: {
        user_id: userId,
        name: payload.name,
        source_file_name: payload.name,
        source_file_type: payload.sourceFileType ?? 'unknown',
        storage_path: defaultStoragePath,
        status: defaultDatasetStatus,
        error_message: null,
        rows_count: null,
      },
    })

    return dataset
  } catch (error) {
    console.error('createDataset failed', error)
    throw error
  }
}

/**
 * Upsert products within a dataset by name for the given user.
 */
export async function upsertProductsForDataset(
  userId: string,
  datasetId: string,
  products: { name: string; category?: string | null; unit?: string | null }[],
): Promise<Product[]> {
  try {
    if (!userId) {
      throw new Error('userId is required')
    }

    if (!datasetId) {
      throw new Error('datasetId is required')
    }

    if (!Array.isArray(products)) {
      throw new Error('products must be an array')
    }

    await ensureDatasetForUser(userId, datasetId)

    if (!products.length) {
      return prisma.products.findMany({
        where: { user_id: userId, dataset_id: datasetId },
        orderBy: { name: 'asc' },
      })
    }

    const normalized = products.map((product) => {
      if (!product.name) {
        throw new Error('Product name is required')
      }

      return {
        name: product.name,
        unit: product.unit ?? 'pcs',
      }
    })

    const productInputs = new Map(normalized.map((product) => [product.name, product]))

    const productNames = Array.from(productInputs.keys())

    const existingProducts = await prisma.products.findMany({
      where: {
        user_id: userId,
        dataset_id: datasetId,
        name: { in: productNames },
      },
    })

    const existingByName = new Map(existingProducts.map((product) => [product.name, product]))

    const operations = productNames.map((name) => {
      const product = productInputs.get(name)
      if (!product) {
        throw new Error(`Product input missing for ${name}`)
      }
      const match = existingByName.get(name)

      if (match) {
        return prisma.products.update({
          where: { id: match.id },
          data: {
            unit: product.unit,
          },
        })
      }

      return prisma.products.create({
        data: {
          user_id: userId,
          dataset_id: datasetId,
          name: product.name,
          unit: product.unit,
        },
      })
    })

    if (operations.length) {
      await prisma.$transaction(operations)
    }

    return prisma.products.findMany({
      where: { user_id: userId, dataset_id: datasetId },
      orderBy: { name: 'asc' },
    })
  } catch (error) {
    console.error('upsertProductsForDataset failed', error)
    throw error
  }
}

/**
 * Bulk upsert sales rows for a dataset, creating products as needed.
 */
export async function bulkUpsertSales(
  userId: string,
  datasetId: string,
  rows: UpsertSalesRow[],
): Promise<void> {
  try {
    if (!userId) {
      throw new Error('userId is required')
    }

    if (!datasetId) {
      throw new Error('datasetId is required')
    }

    if (!Array.isArray(rows)) {
      throw new Error('rows must be an array')
    }

    if (!rows.length) {
      return
    }

    rows.forEach((row) => {
      if (!row.productName) {
        throw new Error('productName is required for each row')
      }

      if (!(row.date instanceof Date) || Number.isNaN(row.date.getTime())) {
        throw new Error('date must be a valid Date')
      }

      if (
        row.quantity === undefined
        || row.quantity === null
        || Number.isNaN(Number(row.quantity))
      ) {
        throw new Error('quantity is required for each row')
      }
    })

    await ensureDatasetForUser(userId, datasetId)

    await prisma.$transaction(async (tx) => {
      const productNames = Array.from(new Set(rows.map((row) => row.productName)))

      const existingProducts = await tx.products.findMany({
        where: {
          user_id: userId,
          dataset_id: datasetId,
          name: { in: productNames },
        },
      })

      const existingByName = new Map(existingProducts.map((product) => [product.name, product]))

      const missingNames = productNames.filter((name) => !existingByName.has(name))

      if (missingNames.length) {
        await tx.products.createMany({
          data: missingNames.map((name) => ({
            user_id: userId,
            dataset_id: datasetId,
            name,
          })),
        })
      }

      const productsForRows = await tx.products.findMany({
        where: {
          user_id: userId,
          dataset_id: datasetId,
          name: { in: productNames },
        },
      })

      const productIdByName = new Map(productsForRows.map((product) => [product.name, product.id]))

      for (const row of rows) {
        const productId = productIdByName.get(row.productName)

        if (!productId) {
          throw new Error(`Product resolution failed for ${row.productName}`)
        }

        await tx.sales.upsert({
          where: {
            product_id_sale_date: {
              product_id: productId,
              sale_date: row.date,
            },
          },
          create: {
            user_id: userId,
            dataset_id: datasetId,
            product_id: productId,
            sale_date: row.date,
            quantity: row.quantity,
            has_promo: row.hasPromo ?? false,
            source: row.source ?? defaultSalesSource,
          },
          update: {
            quantity: row.quantity,
            has_promo: row.hasPromo ?? false,
            source: row.source ?? defaultSalesSource,
            dataset_id: datasetId,
          },
        })
      }
    })
  } catch (error) {
    console.error('bulkUpsertSales failed', error)
    throw error
  }
}

/**
 * Fetch analytics overview for a dataset and date range.
 */
export async function getAnalyticsOverview(
  userId: string,
  datasetId: string,
  range: DateRange,
): Promise<DailyAnalytics[]> {
  try {
    if (!userId) {
      throw new Error('userId is required')
    }

    if (!datasetId) {
      throw new Error('datasetId is required')
    }

    ensureValidRange(range)

    await ensureDatasetForUser(userId, datasetId)

    return prisma.daily_analytics.findMany({
      where: {
        user_id: userId,
        dataset_id: datasetId,
        metric_date: {
          gte: range.startDate,
          lte: range.endDate,
        },
      },
      orderBy: [
        { metric_date: 'asc' },
        { priority_score: 'desc' },
      ],
      include: { products: true },
    })
  } catch (error) {
    console.error('getAnalyticsOverview failed', error)
    throw error
  }
}

/**
 * Fetch analytics for a single product within a dataset and date range.
 */
export async function getProductAnalytics(
  userId: string,
  datasetId: string,
  productId: string,
  range: DateRange,
): Promise<DailyAnalytics[]> {
  try {
    if (!userId) {
      throw new Error('userId is required')
    }

    if (!datasetId) {
      throw new Error('datasetId is required')
    }

    if (!productId) {
      throw new Error('productId is required')
    }

    ensureValidRange(range)

    await ensureDatasetForUser(userId, datasetId)
    await ensureProductForUser(userId, datasetId, productId)

    return prisma.daily_analytics.findMany({
      where: {
        user_id: userId,
        dataset_id: datasetId,
        product_id: productId,
        metric_date: {
          gte: range.startDate,
          lte: range.endDate,
        },
      },
      orderBy: [
        { metric_date: 'asc' },
        { priority_score: 'desc' },
      ],
      include: { products: true },
    })
  } catch (error) {
    console.error('getProductAnalytics failed', error)
    throw error
  }
}

export async function testDbConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

export async function upsertAnalyticsResult(
  userId: string,
  datasetId: string | null,
  productId: string,
  date: Date,
  data: {
    actualQty: number;
    burstScore: number;
    burstLevel: string;
    aiInsight: string; 
  }
) {
  try {
    if (!userId) throw new Error('userId is required');

    return await prisma.daily_analytics.upsert({
      where: {
        product_id_metric_date: {
          product_id: productId,
          metric_date: date,
        },
      },
      create: {
        user_id: userId,
        dataset_id: datasetId,
        product_id: productId,
        metric_date: date,
        actual_quantity: data.actualQty,
        burst_score: data.burstScore,
        burst_level: data.burstLevel,
        ai_insight: data.aiInsight, 
      },
      update: {
        actual_quantity: data.actualQty,
        burst_score: data.burstScore,
        burst_level: data.burstLevel,
        ai_insight: data.aiInsight,
      },
    });
  } catch (error) {
    console.error('upsertAnalyticsResult failed', error);
    throw error;
  }
}