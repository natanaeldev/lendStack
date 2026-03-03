import { MongoClient, Db } from 'mongodb'

/** True when MONGODB_URI env-var is present */
export const isDbConfigured = () => !!process.env.MONGODB_URI

// Cache the client promise so we don't open a new connection on every
// serverless invocation during development (HMR-safe via globalThis).
let _clientPromise: Promise<MongoClient> | null = null

function getClientPromise(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  if (process.env.NODE_ENV === 'development') {
    // In development, attach to globalThis so hot-reload doesn't leak connections
    if (!(globalThis as any).__mongoClientPromise) {
      ;(globalThis as any).__mongoClientPromise = new MongoClient(
        process.env.MONGODB_URI
      ).connect()
    }
    return (globalThis as any).__mongoClientPromise as Promise<MongoClient>
  }

  // In production each module instance is fresh; reuse within the instance
  if (!_clientPromise) {
    _clientPromise = new MongoClient(process.env.MONGODB_URI).connect()
  }
  return _clientPromise
}

/** Returns the 'jvf' database handle */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db('jvf')
}
