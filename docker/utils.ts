import yaml from 'js-yaml'
import fs from 'fs'

export const sanitizePath = (path: string): string | undefined => {
    if (!path || typeof path !== 'string') return undefined
    if (path.toLowerCase().includes('docker-compose.yml')) return path
    return `${path.replace(/[\\/]+$/, '')}/docker-compose.yml`
}

export class DockerSetup {
    projectName: string
    services:    Record<string, any>
    networks:    Record<string, any>
    version:     string
    path:        string | undefined

    constructor(path: string | null = null) {
        this.projectName = 'Insidiae'
        this.services    = {}
        this.networks    = {}
        this.version     = '3.8'
        this.path        = sanitizePath(path ?? '') ?? undefined
        if (this.path && fs.existsSync(this.path)) this.parse(this.path)
    }

    parse(path?: string): void {
        const target = path || this.path
        if (!target) return
        const file    = fs.readFileSync(target, 'utf8')
        const compose = yaml.load(file)
        if (compose) Object.assign(this, compose)
    }

    get(name: string)                   { return this.services?.[name] }
    set(name: string, config: any)      { this.services[name] = config }

    // Register a top-level network. Defaults to a plain bridge
    setNetwork(name: string, config: any = { driver: 'bridge' }): void {
        this.networks[name] = config
    }

    read() {
        // Strip internal-only fields; keep networks only when non-empty
        const { path, projectName, networks, ...rest } = this as any
        return Object.keys(networks).length > 0
            ? { ...rest, networks }
            : rest
    }

    write(): void {
        if (!this.path) throw new Error("[DockerSetup] No output path defined")
        const data = yaml.dump(this.read(), { indent: 2 })
        fs.writeFileSync(this.path, data)
    }
}