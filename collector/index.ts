export enum COLLECTOR {
    Suricata = "Suricata",
    Zeek = "Zeek"
}

export class Collector {
    public readonly name: COLLECTOR
    public config: any

    constructor(name: COLLECTOR, config: any = {}) {
        this.name = name
        this.config = config
    }

    validate(): boolean {
        if (!Object.values(COLLECTOR).includes(this.name)) {
            throw new Error(`[Collector] Invalid name: ${this.name}`)
        }
        if (!this.config || typeof this.config !== 'object') {
            throw new Error(`[Collector] Missing or invalid config for ${this.name}`)
        }
        return true
    }

    get() { return this.config }
    set(config: any = {}) { this.config = config }
}