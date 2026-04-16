import crypto from 'crypto'
import { DockerSetup } from './utils'
import { PoolManager } from '../collector/manager'

export const LABEL = {
    PROJECT:   'insidiae.project',   // constant marker for all containers
    POOL:      'insidiae.pool',
    TYPE:      'insidiae.type',      // "pool_service" | "collector"
    COLLECTOR: 'insidiae.collector',
    SESSION:   'insidiae.session'    // random 8-hex chars generated per setup
} as const

export const PROJECT_NAME = 'Insidiae'

export type SessionId = string

export interface BuildOpt {
    dependFromPoolServices?: boolean
}

export interface DryRunResult {
    compose: ReturnType<DockerSetup['read']>
    sessionId: SessionId
}

export const generateSessionId = (): SessionId =>
    crypto.randomBytes(4).toString('hex')

/** Derives the bridge network name for a given pool. */
const poolNetworkName = (poolName: string): string =>
    `${poolName.toLowerCase()}_net`

/**
 * Merges identity labels into a service-config object.
 * Supports both array-style labels (YAML default) and object-style.
 */
function injectLabels(config: any, labels: Record<string, string>): void {
    if (!config.labels) config.labels = []

    if (Array.isArray(config.labels)) {
        config.labels = (config.labels as string[]).filter(
            (l) => !Object.keys(labels).some((k) => l.startsWith(`${k}=`))
        )
        for (const [k, v] of Object.entries(labels)) {
            config.labels.push(`${k}=${v}`)
        }
    } else if (typeof config.labels === 'object') {
        Object.assign(config.labels, labels)
    }
}

/**
 * Assigns the pool's bridge network to a service config.
 * Overwrites any previous insidiae-managed network list so re-runs are idempotent.
 */
function injectNetwork(config: any, network: string): void {
    // Preserve any networks the service already declares that aren't ours,
    // then make sure our pool network is present.
    const existing: string[] = Array.isArray(config.networks)
        ? (config.networks as string[]).filter(
              (n) => !n.endsWith('_net')   // strip old insidiae-managed entries
          )
        : []

    config.networks = [...new Set([...existing, network])]
}

// ─── Build ────────────────────────────────────────────────────────────────────

function buildCompose(
    compose: DockerSetup,
    manager: PoolManager,
    buildOpt: BuildOpt,
    sessionId: SessionId
): void {
    for (const pool of manager.getAll()) {
        const network = poolNetworkName(pool.poolName)

        // Register the top-level bridge network for this pool
        compose.setNetwork(network)

        // ── Pool services ─────────────────────────────────────────────────────
        for (const service of pool.services) {
            injectLabels(service.data, {
                [LABEL.PROJECT]: PROJECT_NAME,
                [LABEL.POOL]:    pool.poolName,
                [LABEL.TYPE]:    'pool_service',
                [LABEL.SESSION]: sessionId
            })
            injectNetwork(service.data, network)
            compose.set(service.name.toLowerCase(), service.data)
        }

        // ── depends_on for collectors ─────────────────────────────────────────
        const dependsOn = buildOpt.dependFromPoolServices
            ? pool.services.map((s) => s.name.toLowerCase())
            : [pool.poolName.toLowerCase()]

        pool.editAll({ depends_on: dependsOn })

        // ── Collectors ────────────────────────────────────────────────────────
        for (const collector of pool.toArray()) {
            injectLabels(collector.config, {
                [LABEL.PROJECT]:   PROJECT_NAME,
                [LABEL.POOL]:      pool.poolName,
                [LABEL.TYPE]:      'collector',
                [LABEL.COLLECTOR]: collector.name,
                [LABEL.SESSION]:   sessionId
            })
            injectNetwork(collector.config, network)
            compose.set(collector.name.toLowerCase(), collector.config)
        }
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the compose model, writes docker-compose.yml, returns the session id.
 */
export const setup = async (
    path: string,
    rawConfig: any[],
    buildOpt: BuildOpt = {}
): Promise<SessionId> => {
    const sessionId = generateSessionId()
    const manager   = await PoolManager.create(rawConfig)
    const compose   = new DockerSetup(path)
    buildCompose(compose, manager, buildOpt, sessionId)
    compose.write()
    return sessionId
}

/**
 * Dry-run: builds the compose model in memory only — nothing is written to disk.
 * Returns the plain object representation of what would have been written.
 */
export const dryRun = async (
    rawConfig: any[],
    buildOpt: BuildOpt = {}
): Promise<DryRunResult> => {
    const sessionId = generateSessionId()
    const manager   = await PoolManager.create(rawConfig)
    const compose   = new DockerSetup(null)
    buildCompose(compose, manager, buildOpt, sessionId)
    return { compose: compose.read(), sessionId }
}