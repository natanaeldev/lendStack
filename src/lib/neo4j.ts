import neo4j, { Driver } from 'neo4j-driver'

let _driver: Driver | null = null

/** True when all three Neo4j env-vars are present */
export const isNeo4jConfigured = () =>
  !!(process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD)

function getDriver(): Driver {
  if (!_driver) {
    _driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
    )
  }
  return _driver
}

/** Run a Cypher query and return records as plain objects */
export async function runQuery<T extends Record<string, any> = any>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = getDriver().session()
  try {
    const result = await session.run(cypher, params)
    return result.records.map(r => r.toObject() as T)
  } finally {
    await session.close()
  }
}

/** Safely convert a Neo4j Integer (or plain JS number) to a JS number */
export function toNum(val: any): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  if (typeof val.toNumber === 'function') return val.toNumber()
  return Number(val)
}
