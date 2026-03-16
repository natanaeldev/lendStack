import assert from 'node:assert/strict'
import {
  emitNotification,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../src/lib/notifications.ts'

async function run(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

function matches(document, query = {}) {
  return Object.entries(query).every(([key, value]) => document[key] === value)
}

class FakeCursor {
  constructor(items) {
    this.items = [...items]
  }

  sort(sortSpec) {
    const [[field, direction]] = Object.entries(sortSpec)
    this.items.sort((a, b) => {
      if (a[field] === b[field]) return 0
      return direction < 0
        ? String(a[field]) < String(b[field]) ? 1 : -1
        : String(a[field]) > String(b[field]) ? 1 : -1
    })
    return this
  }

  skip(count) {
    this.items = this.items.slice(count)
    return this
  }

  limit(count) {
    this.items = this.items.slice(0, count)
    return this
  }

  async toArray() {
    return [...this.items]
  }
}

class FakeCollection {
  constructor(items = []) {
    this.items = items
  }

  async createIndex() {}

  find(query = {}) {
    return new FakeCursor(this.items.filter((item) => matches(item, query)))
  }

  async findOne(query = {}) {
    return this.items.find((item) => matches(item, query)) ?? null
  }

  async insertOne(doc) {
    this.items.push(structuredClone(doc))
    return { insertedId: doc._id }
  }

  async insertMany(docs) {
    docs.forEach((doc) => this.items.push(structuredClone(doc)))
    return { insertedCount: docs.length }
  }

  async countDocuments(query = {}) {
    return this.items.filter((item) => matches(item, query)).length
  }

  async updateOne(query, update, options = {}) {
    const item = this.items.find((candidate) => matches(candidate, query))
    if (!item && !options.upsert) {
      return { matchedCount: 0, modifiedCount: 0 }
    }

    if (!item && options.upsert) {
      const next = { ...query }
      if (update.$setOnInsert) Object.assign(next, structuredClone(update.$setOnInsert))
      if (update.$set) Object.assign(next, structuredClone(update.$set))
      this.items.push(next)
      return { matchedCount: 0, modifiedCount: 0, upsertedId: next._id ?? null }
    }

    if (update.$set) Object.assign(item, structuredClone(update.$set))
    if (update.$push) {
      for (const [key, value] of Object.entries(update.$push)) {
        item[key] = Array.isArray(item[key]) ? item[key] : []
        item[key].push(structuredClone(value))
      }
    }
    return { matchedCount: 1, modifiedCount: 1 }
  }

  async updateMany(query, update) {
    let modifiedCount = 0
    for (const item of this.items.filter((candidate) => matches(candidate, query))) {
      if (update.$set) Object.assign(item, structuredClone(update.$set))
      modifiedCount += 1
    }
    return { modifiedCount }
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.collections = new Map()
    for (const [name, items] of Object.entries(seed)) {
      this.collections.set(name, new FakeCollection(items))
    }
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new FakeCollection())
    }
    return this.collections.get(name)
  }
}

await run('emitNotification fans out to tenant users and counts unread', async () => {
  const db = new FakeDb({
    users: [
      { _id: 'user_1', organizationId: 'org_1' },
      { _id: 'user_2', organizationId: 'org_1' },
      { _id: 'user_3', organizationId: 'org_2' },
    ],
  })

  const result = await emitNotification(db, {
    tenantId: 'org_1',
    type: 'loan.created',
    entityType: 'loan',
    entityId: 'loan_1',
    actionUrl: '/app/prestamos?loanId=loan_1',
    message: 'Préstamo creado.',
  })

  assert.equal(result.created, 2)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_1'), 1)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_2'), 1)
  assert.equal(await getUnreadNotificationCount(db, 'org_2', 'user_3'), 0)
})

await run('listNotifications enforces tenant and user isolation', async () => {
  const db = new FakeDb({
    users: [{ _id: 'user_1', organizationId: 'org_1' }],
    notifications: [
      { _id: 'n1', tenantId: 'org_1', userId: 'user_1', type: 'loan.created', title: 'A', message: 'A', priority: 'medium', category: 'loan', entityType: 'loan', entityId: 'loan_1', actionUrl: null, isRead: false, readAt: null, channels: { inApp: true, email: false, sms: false, push: false, whatsapp: false }, status: 'delivered', metadata: {}, dedupeKey: 'd1', createdAt: '2026-03-15T10:00:00.000Z', updatedAt: '2026-03-15T10:00:00.000Z' },
      { _id: 'n2', tenantId: 'org_1', userId: 'user_2', type: 'loan.created', title: 'B', message: 'B', priority: 'medium', category: 'loan', entityType: 'loan', entityId: 'loan_2', actionUrl: null, isRead: false, readAt: null, channels: { inApp: true, email: false, sms: false, push: false, whatsapp: false }, status: 'delivered', metadata: {}, dedupeKey: 'd2', createdAt: '2026-03-15T11:00:00.000Z', updatedAt: '2026-03-15T11:00:00.000Z' },
      { _id: 'n3', tenantId: 'org_2', userId: 'user_1', type: 'loan.created', title: 'C', message: 'C', priority: 'medium', category: 'loan', entityType: 'loan', entityId: 'loan_3', actionUrl: null, isRead: false, readAt: null, channels: { inApp: true, email: false, sms: false, push: false, whatsapp: false }, status: 'delivered', metadata: {}, dedupeKey: 'd3', createdAt: '2026-03-15T12:00:00.000Z', updatedAt: '2026-03-15T12:00:00.000Z' },
    ],
  })

  const result = await listNotifications(db, {
    tenantId: 'org_1',
    userId: 'user_1',
    page: 1,
    pageSize: 20,
    state: 'all',
    category: 'all',
  })

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]._id, 'n1')
})

await run('preferences can disable a category and stop delivery', async () => {
  const db = new FakeDb({
    users: [{ _id: 'user_1', organizationId: 'org_1' }],
  })

  const current = await getNotificationPreferences(db, 'org_1', 'user_1')
  assert.equal(current.categories.document.inApp, true)

  await updateNotificationPreferences(db, 'org_1', 'user_1', {
    categories: {
      ...current.categories,
      document: { inApp: false, email: false, sms: false, push: false, whatsapp: false },
    },
  })

  const result = await emitNotification(db, {
    tenantId: 'org_1',
    userIds: ['user_1'],
    type: 'document.missing',
    entityType: 'client',
    entityId: 'client_1',
    message: 'Documento faltante.',
  })

  assert.equal(result.created, 0)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_1'), 0)
})

await run('markNotificationRead preserves unread counts and markAllNotificationsRead clears the queue', async () => {
  const db = new FakeDb({
    users: [{ _id: 'user_1', organizationId: 'org_1' }],
  })

  await emitNotification(db, {
    tenantId: 'org_1',
    userIds: ['user_1'],
    type: 'loan.created',
    entityType: 'loan',
    entityId: 'loan_1',
    message: 'Uno.',
  })
  await emitNotification(db, {
    tenantId: 'org_1',
    userIds: ['user_1'],
    type: 'payment.overdue',
    entityType: 'client',
    entityId: 'client_1',
    message: 'Dos.',
    dedupeKey: 'custom-two',
  })

  const listed = await listNotifications(db, {
    tenantId: 'org_1',
    userId: 'user_1',
  })

  await markNotificationRead(db, 'org_1', 'user_1', listed.items[0]._id)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_1'), 1)

  const modifiedCount = await markAllNotificationsRead(db, 'org_1', 'user_1')
  assert.equal(modifiedCount, 1)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_1'), 0)
})

await run('emitNotification dedupes repeated unread events', async () => {
  const db = new FakeDb({
    users: [{ _id: 'user_1', organizationId: 'org_1' }],
  })

  const first = await emitNotification(db, {
    tenantId: 'org_1',
    userIds: ['user_1'],
    type: 'payment.overdue',
    entityType: 'client',
    entityId: 'client_1',
    message: 'Cuota vencida.',
    dedupeKey: 'payment.overdue:client_1:2026-03',
  })
  const second = await emitNotification(db, {
    tenantId: 'org_1',
    userIds: ['user_1'],
    type: 'payment.overdue',
    entityType: 'client',
    entityId: 'client_1',
    message: 'Cuota vencida.',
    dedupeKey: 'payment.overdue:client_1:2026-03',
  })

  assert.equal(first.created, 1)
  assert.equal(second.created, 0)
  assert.equal(await getUnreadNotificationCount(db, 'org_1', 'user_1'), 1)
})
