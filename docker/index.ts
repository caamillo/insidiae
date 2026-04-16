import { DockerSetup } from './utils'
import { PoolManager } from '../collector/manager'

interface BuildOpt {
    dependFromPoolServices?: boolean
}

export const setup = async (path: string, rawConfig: any[], buildOpt: BuildOpt = {}): Promise<void> => {
    const manager = await PoolManager.create(rawConfig)
    const compose = new DockerSetup(path)
    if (!compose) return
    build(compose, manager, buildOpt)
}

const build = (compose: DockerSetup, manager: PoolManager, buildOpt: BuildOpt): void => {
    for (const pool of manager.getAll()) {
        for (const service of pool.services) {
            compose.set(service.name.toLowerCase(), service.data)
        }

        const dependsOn = buildOpt.dependFromPoolServices
            ? pool.services.map(s => s.name.toLowerCase())
            : [pool.poolName.toLowerCase()]

        pool.editAll({ depends_on: dependsOn })

        for (const collector of pool.toArray()) {
            compose.set(collector.name.toLowerCase(), collector.config)
        }
    }

    compose.write()
}