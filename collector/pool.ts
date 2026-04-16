import { Collector, COLLECTOR } from "."

export enum COLLECTOR_POOL {
    Elasticsearch = "Elasticsearch"
}

export class CollectorPool {
    public readonly poolName: COLLECTOR_POOL
    public services: Array<{ name: string, data: any }>
    private pool: Partial<Record<COLLECTOR, Collector>> = {}

    constructor(poolName: COLLECTOR_POOL, services: Array<{ name: string, data: any }> = [], initialCollectors: Collector[] = []) {
        this.poolName = poolName
        this.services = services
        initialCollectors.forEach(c => this.add(c))
    }

    add(collector: Collector, overwrite: boolean = false): void {
        if (!(collector instanceof Collector)) {
            throw new Error("Not a valid Collector instance")
        }
        const validNames = Object.values(COLLECTOR) as string[]
        if (!validNames.includes(collector.name)) {
            throw new Error(`${collector.name} is not a valid collector`)
        }
        if (this.pool[collector.name as COLLECTOR]) {
            if (!overwrite) throw new Error(`${collector.name} is already present`)
            console.warn(`[WARNING] Collector ${collector.name} already present — overwriting`)
        }
        this.pool[collector.name as COLLECTOR] = collector
    }

    editAll(additions: Record<string, any>): void {
        for (const collector of this.toArray()) {
            for (const [key, value] of Object.entries(additions)) {
                collector.config[key] = Array.isArray(value) ? [...value] : typeof value === 'object' && value !== null ? { ...value } : value
            }
        }
    }

    validate(): boolean {
        if (!this.poolName || this.poolName.length < 2) {
            throw new Error(`[Pool] Invalid pool name`)
        }
        const collectors = this.toArray()
        if (collectors.length === 0) {
            console.warn(`[Pool] Pool '${this.poolName}' is empty`)
        }
        collectors.forEach(collector => collector.validate())
        return true
    }

    get(name: COLLECTOR): Collector | undefined { return this.pool[name] }
    remove(name: COLLECTOR): void { delete this.pool[name] }
    toArray(): Collector[] { return Object.values(this.pool) as Collector[] }
    toObject() { return this.pool }
}