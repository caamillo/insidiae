import { Collector } from "."
import { CollectorPool, COLLECTOR_POOL } from "./pool"

export class PoolManager {
    private pools: Map<COLLECTOR_POOL, CollectorPool> = new Map()

    private constructor() {}

    static async create(rawConfig: any[]): Promise<PoolManager> {
        const instance = new PoolManager()
        await instance.init(rawConfig)
        return instance
    }

    private async init(rawConfig: any[]): Promise<void> {
        if (!Array.isArray(rawConfig)) {
            throw new Error("[PoolManager] Config must be an Array")
        }

        for (const entry of rawConfig) {
            const { pool: poolRaw, collectors } = entry
            const { name: poolName, ...poolArgs } = poolRaw

            const poolModule = await import(`../docker/pool/${poolName.toLowerCase()}.js`)

            const poolResult = poolModule.default(poolArgs)
            const poolEntries: Array<{ name: COLLECTOR_POOL, data: any }> = poolResult.services
            const resolvedPoolVolumePath = Object.fromEntries(
                Object.entries(poolResult.volumesPath)
                    .map(([ key, value ]) => [ 
                        key, 
                        `${ value }/${poolName.toLowerCase()}` 
                    ])
            )

            const resolvedPoolName: COLLECTOR_POOL = poolEntries[0].name

            if (this.pools.has(resolvedPoolName)) continue

            const newPool = new CollectorPool(resolvedPoolName, poolEntries)

            if (Array.isArray(collectors)) {
                for (const collectorRaw of collectors) {
                    const { name: collectorName, ...collectorArgs } = collectorRaw

                    const collectorModule = await import(`../docker/collector/${collectorName.toLowerCase()}.js`)

                    const collectorVolumePath = Object.fromEntries(
                        Object.entries(resolvedPoolVolumePath)
                            .map(([ key, value ]) => [ 
                                key, 
                                `${ value }/${collectorName.toLowerCase()}` 
                            ])
                    )

                    const collectorEntries: Array<{ name: any, data: any }> = collectorModule.default({
                        ...collectorArgs,
                        volumesPath: collectorVolumePath
                    })

                    for (const collectorEntry of collectorEntries) {
                        newPool.add(new Collector(collectorEntry.name, collectorEntry.data))
                    }
                }
            }

            this.pools.set(resolvedPoolName, newPool)
        }

        this.validate()
    }

    validate(): boolean {
        if (this.pools.size === 0) {
            throw new Error("[PoolManager] No pools loaded")
        }
        for (const pool of this.pools.values()) {
            pool.validate()
        }
        console.log("[PoolManager] Validation passed")
        return true
    }

    get(name: COLLECTOR_POOL): CollectorPool | undefined { return this.pools.get(name) }
    getAll(): CollectorPool[] { return Array.from(this.pools.values()) }
}