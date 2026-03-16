import { Db } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationCategory = 'loan' | 'payment' | 'document' | 'compliance' | 'review' | 'system'
export type NotificationEventType =
  | 'loan.created'
  | 'loan.approved'
  | 'loan.rejected'
  | 'payment.due_soon'
  | 'payment.overdue'
  | 'disbursement.sent'
  | 'document.missing'
  | 'document.expiring'
  | 'kyc.failed'
  | 'manual_review.required'

export type NotificationDeliveryStatus = 'pending' | 'delivered' | 'failed'
export type NotificationEntityType = 'loan' | 'client' | 'payment' | 'document' | 'kyc' | 'organization' | 'system'

export interface NotificationChannelState {
  inApp: boolean
  email: boolean
  sms: boolean
  push: boolean
  whatsapp: boolean
}

export interface NotificationRecord {
  _id: string
  tenantId: string
  userId: string
  type: NotificationEventType
  title: string
  message: string
  priority: NotificationPriority
  category: NotificationCategory
  entityType: NotificationEntityType
  entityId: string
  actionUrl: string | null
  isRead: boolean
  readAt: string | null
  channels: NotificationChannelState
  status: NotificationDeliveryStatus
  metadata: Record<string, any>
  dedupeKey: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationPreferenceRecord {
  _id: string
  tenantId: string
  userId: string
  categories: Record<NotificationCategory, NotificationChannelState>
  eventTypes: Partial<Record<NotificationEventType, NotificationChannelState>>
  createdAt: string
  updatedAt: string
}

export interface NotificationListFilters {
  tenantId: string
  userId: string
  page?: number
  pageSize?: number
  category?: NotificationCategory | 'all'
  state?: 'all' | 'read' | 'unread'
}

export interface EmitNotificationInput {
  tenantId: string
  actorUserId?: string | null
  userIds?: string[]
  type: NotificationEventType
  entityType: NotificationEntityType
  entityId: string
  actionUrl?: string | null
  title?: string
  message: string
  priority?: NotificationPriority
  category?: NotificationCategory
  metadata?: Record<string, any>
  dedupeKey?: string | null
}

const DEFAULT_CHANNELS: NotificationChannelState = {
  inApp: true,
  email: false,
  sms: false,
  push: false,
  whatsapp: false,
}

const DEFAULT_CATEGORY_PREFERENCES: Record<NotificationCategory, NotificationChannelState> = {
  loan: { ...DEFAULT_CHANNELS },
  payment: { ...DEFAULT_CHANNELS },
  document: { ...DEFAULT_CHANNELS },
  compliance: { ...DEFAULT_CHANNELS },
  review: { ...DEFAULT_CHANNELS },
  system: { ...DEFAULT_CHANNELS },
}

export const NOTIFICATION_EVENT_CONFIG: Record<
  NotificationEventType,
  {
    category: NotificationCategory
    priority: NotificationPriority
    defaultTitle: string
  }
> = {
  'loan.created': { category: 'loan', priority: 'medium', defaultTitle: 'Nuevo préstamo creado' },
  'loan.approved': { category: 'loan', priority: 'high', defaultTitle: 'Préstamo aprobado' },
  'loan.rejected': { category: 'loan', priority: 'high', defaultTitle: 'Préstamo rechazado' },
  'payment.due_soon': { category: 'payment', priority: 'medium', defaultTitle: 'Pago próximo a vencer' },
  'payment.overdue': { category: 'payment', priority: 'critical', defaultTitle: 'Pago vencido' },
  'disbursement.sent': { category: 'loan', priority: 'high', defaultTitle: 'Desembolso registrado' },
  'document.missing': { category: 'document', priority: 'high', defaultTitle: 'Documentación pendiente' },
  'document.expiring': { category: 'document', priority: 'medium', defaultTitle: 'Documento por vencer' },
  'kyc.failed': { category: 'compliance', priority: 'critical', defaultTitle: 'Validación KYC fallida' },
  'manual_review.required': { category: 'review', priority: 'high', defaultTitle: 'Revisión manual requerida' },
}

function sanitizeText(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback
  const normalized = value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}

function buildDefaultPreferences(tenantId: string, userId: string, now = new Date().toISOString()): NotificationPreferenceRecord {
  return {
    _id: `${tenantId}:${userId}`,
    tenantId,
    userId,
    categories: {
      loan: { ...DEFAULT_CATEGORY_PREFERENCES.loan },
      payment: { ...DEFAULT_CATEGORY_PREFERENCES.payment },
      document: { ...DEFAULT_CATEGORY_PREFERENCES.document },
      compliance: { ...DEFAULT_CATEGORY_PREFERENCES.compliance },
      review: { ...DEFAULT_CATEGORY_PREFERENCES.review },
      system: { ...DEFAULT_CATEGORY_PREFERENCES.system },
    },
    eventTypes: {},
    createdAt: now,
    updatedAt: now,
  }
}

function cloneChannelState(value?: Partial<NotificationChannelState>): NotificationChannelState {
  return {
    inApp: value?.inApp ?? true,
    email: value?.email ?? false,
    sms: value?.sms ?? false,
    push: value?.push ?? false,
    whatsapp: value?.whatsapp ?? false,
  }
}

export async function ensureNotificationIndexes(db: Db) {
  await Promise.all([
    db.collection<NotificationRecord>('notifications').createIndex({ tenantId: 1, userId: 1, createdAt: -1 }),
    db.collection<NotificationRecord>('notifications').createIndex({ tenantId: 1, userId: 1, isRead: 1, createdAt: -1 }),
    db.collection<NotificationRecord>('notifications').createIndex({ tenantId: 1, userId: 1, category: 1, isRead: 1, createdAt: -1 }),
    db.collection<NotificationRecord>('notifications').createIndex({ tenantId: 1, userId: 1, dedupeKey: 1, createdAt: -1 }),
    db.collection<NotificationPreferenceRecord>('notification_preferences').createIndex({ tenantId: 1, userId: 1 }, { unique: true }),
  ])
}

export async function getNotificationPreferences(db: Db, tenantId: string, userId: string) {
  await ensureNotificationIndexes(db)
  const collection = db.collection<NotificationPreferenceRecord>('notification_preferences')
  const existing = await collection.findOne({ tenantId, userId })
  if (existing) {
    return existing
  }

  const seed = buildDefaultPreferences(tenantId, userId)
  await collection.insertOne(seed as any)
  return seed
}

export async function updateNotificationPreferences(
  db: Db,
  tenantId: string,
  userId: string,
  input: Partial<Pick<NotificationPreferenceRecord, 'categories' | 'eventTypes'>>,
) {
  await ensureNotificationIndexes(db)
  const current = await getNotificationPreferences(db, tenantId, userId)
  const now = new Date().toISOString()

  const categories = { ...current.categories }
  for (const key of Object.keys(DEFAULT_CATEGORY_PREFERENCES) as NotificationCategory[]) {
    if (input.categories?.[key]) {
      categories[key] = cloneChannelState(input.categories[key])
    }
  }

  const eventTypes = { ...current.eventTypes }
  for (const key of Object.keys(input.eventTypes ?? {}) as NotificationEventType[]) {
    const value = input.eventTypes?.[key]
    if (value) {
      eventTypes[key] = cloneChannelState(value)
    }
  }

  await db.collection<NotificationPreferenceRecord>('notification_preferences').updateOne(
    { tenantId, userId },
    {
      $set: {
        categories,
        eventTypes,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: `${tenantId}:${userId}`,
        createdAt: now,
      },
    },
    { upsert: true },
  )

  return {
    ...current,
    categories,
    eventTypes,
    updatedAt: now,
  } satisfies NotificationPreferenceRecord
}

async function resolveRecipientUserIds(db: Db, tenantId: string, explicitUserIds?: string[]) {
  if (explicitUserIds?.length) {
    return Array.from(new Set(explicitUserIds.filter(Boolean)))
  }

  const users = await db.collection<{ _id: string; organizationId: string }>('users')
    .find(
      { organizationId: tenantId },
      { projection: { _id: 1 } },
    )
    .toArray()

  return users.map((user) => String(user._id))
}

function shouldDeliverInApp(preferences: NotificationPreferenceRecord, type: NotificationEventType, category: NotificationCategory) {
  const eventOverride = preferences.eventTypes[type]
  if (eventOverride) return !!eventOverride.inApp
  return !!preferences.categories[category]?.inApp
}

export async function emitNotification(db: Db, input: EmitNotificationInput) {
  await ensureNotificationIndexes(db)

  const config = NOTIFICATION_EVENT_CONFIG[input.type]
  const category = input.category ?? config.category
  const priority = input.priority ?? config.priority
  const now = new Date().toISOString()
  const userIds = await resolveRecipientUserIds(db, input.tenantId, input.userIds)
  if (userIds.length === 0) return { created: 0 }

  const docs: NotificationRecord[] = []
  for (const userId of userIds) {
    const preferences = await getNotificationPreferences(db, input.tenantId, userId)
    if (!shouldDeliverInApp(preferences, input.type, category)) continue

    const dedupeKey = input.dedupeKey ?? `${input.type}:${input.entityType}:${input.entityId}`
    const existing = await db.collection<NotificationRecord>('notifications').findOne({
      tenantId: input.tenantId,
      userId,
      dedupeKey,
      isRead: false,
    })
    if (existing) continue

    docs.push({
      _id: uuidv4(),
      tenantId: input.tenantId,
      userId,
      type: input.type,
      title: sanitizeText(input.title ?? config.defaultTitle),
      message: sanitizeText(input.message),
      priority,
      category,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl ?? null,
      isRead: false,
      readAt: null,
      channels: { ...DEFAULT_CHANNELS, inApp: true },
      status: 'delivered',
      metadata: input.metadata ?? {},
      dedupeKey,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (docs.length === 0) return { created: 0 }
  await db.collection<NotificationRecord>('notifications').insertMany(docs as any[])
  return { created: docs.length }
}

export async function listNotifications(db: Db, filters: NotificationListFilters) {
  await ensureNotificationIndexes(db)
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20))

  const query: Record<string, any> = {
    tenantId: filters.tenantId,
    userId: filters.userId,
  }
  if (filters.category && filters.category !== 'all') query.category = filters.category
  if (filters.state === 'read') query.isRead = true
  if (filters.state === 'unread') query.isRead = false

  const collection = db.collection<NotificationRecord>('notifications')
  const [items, total, unreadCount] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(query),
    collection.countDocuments({ tenantId: filters.tenantId, userId: filters.userId, isRead: false }),
  ])

  return {
    items,
    total,
    unreadCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getUnreadNotificationCount(db: Db, tenantId: string, userId: string) {
  await ensureNotificationIndexes(db)
  return db.collection<NotificationRecord>('notifications').countDocuments({
    tenantId,
    userId,
    isRead: false,
  })
}

export async function markNotificationRead(db: Db, tenantId: string, userId: string, notificationId: string) {
  await ensureNotificationIndexes(db)
  const now = new Date().toISOString()
  const result = await db.collection<NotificationRecord>('notifications').updateOne(
    { _id: notificationId, tenantId, userId },
    {
      $set: {
        isRead: true,
        readAt: now,
        updatedAt: now,
      },
    },
  )
  if (result.matchedCount === 0) return null
  return db.collection<NotificationRecord>('notifications').findOne({ _id: notificationId, tenantId, userId })
}

export async function markAllNotificationsRead(db: Db, tenantId: string, userId: string) {
  await ensureNotificationIndexes(db)
  const now = new Date().toISOString()
  const result = await db.collection<NotificationRecord>('notifications').updateMany(
    { tenantId, userId, isRead: false },
    {
      $set: {
        isRead: true,
        readAt: now,
        updatedAt: now,
      },
    },
  )
  return result.modifiedCount
}

export function groupNotificationsByRecency(items: NotificationRecord[], now = new Date()) {
  const todayKey = now.toISOString().slice(0, 10)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  return items.reduce(
    (acc, item) => {
      const key = item.createdAt.slice(0, 10)
      if (key === todayKey) acc.today.push(item)
      else if (key === yesterdayKey) acc.yesterday.push(item)
      else acc.earlier.push(item)
      return acc
    },
    {
      today: [] as NotificationRecord[],
      yesterday: [] as NotificationRecord[],
      earlier: [] as NotificationRecord[],
    },
  )
}
