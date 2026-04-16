/**
 * Insidiae Commands
 * ───────────────────────────────────────────────────────────────────────────────────────
 *  -write          Build & write docker-compose.yml, then exit.
 *  -read | -r      Dry-run: print what the docker-compose would look like (YAML),
 *                  no file is written.
 *  -status | -s    Run 'docker ps' filtered for Insidiae containers, parse the
 *                  output and print a structured JSON mapping each container to
 *                  its pool and (when relevant) its collector.
 *  -ps             Print the raw `docker ps` table filtered for Insidiae
 *                  containers (human-readable, no JSON transformation).
 *  -stop           Stop all running Insidiae containers via `docker compose stop`.
 *                  Containers are stopped but not removed (data volumes preserved).
 *  <no args>       Default: setup → write → `docker compose up -d`.
 *                  Streams stdout/stderr of the compose command live to the
 *                  terminal. Process exits when `docker compose up -d` ends.
 */

import { setup, dryRun, LABEL, PROJECT_NAME, SessionId } from './docker'
import yaml from 'js-yaml'
import { spawn, exec }  from 'child_process'
import { promisify }    from 'util'

const execAsync = promisify(exec)

const COMPOSE_PATH = './docker-compose.yml'

/**
 * Edit RAW_CONFIG to adjust your stack.
 * The dynamic import system in PoolManager resolves modules by lower-cased name.
 */
const RAW_CONFIG: any[] = [
    {
        pool: {
            name: 'elasticsearch',
            memoryLimit: '1g',
            port: '9200',
            withKibana: true
        },
        collectors: [
            { name: 'suricata' },
            { name: 'zeek'     }
        ]
    }
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerEntry {
    id:      string
    name:    string
    image:   string
    status:  string
    ports:   string
    created: string
    session: string | undefined
}

interface CollectorEntry extends ContainerEntry {
    collector: string
}

interface PoolStatus {
    pool_services: ContainerEntry[]
    collectors:    CollectorEntry[]
}

type StatusReport = Record<string, PoolStatus>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDockerLabels(raw: string | Record<string, string>): Record<string, string> {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    return Object.fromEntries(
        raw.split(',')
           .map((seg) => {
               const idx = seg.indexOf('=')
               return idx === -1 ? null : [seg.slice(0, idx), seg.slice(idx + 1)]
           })
           .filter(Boolean) as [string, string][]
    )
}

/** Spawn a command with stdio fully inherited (terminal passthrough). */
function spawnInherited(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: 'inherit' })
        proc.on('error', reject)
        proc.on('close', (code) => {
            code === 0
                ? resolve()
                : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
        })
    })
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdWrite(): Promise<SessionId> {
    console.log('[setup] Building docker-compose.yml …')
    const sessionId = await setup(COMPOSE_PATH, RAW_CONFIG)
    console.log(`[setup] Written  → ${COMPOSE_PATH}`)
    console.log(`[setup] Session ID: ${sessionId}`)
    return sessionId
}

async function cmdRead(): Promise<void> {
    console.log('[read] Dry-run — no file will be written.\n')
    const { compose, sessionId } = await dryRun(RAW_CONFIG)
    console.log(`Session ID : ${sessionId}`)
    console.log('─'.repeat(60))
    process.stdout.write(yaml.dump(compose, { indent: 2 }))
}

async function cmdStatus(): Promise<void> {
    let stdout: string
    try {
        const result = await execAsync(
            `docker ps -a --filter "label=${LABEL.PROJECT}=${PROJECT_NAME}" --format "{{json .}}"`
        )
        stdout = result.stdout
    } catch (err: any) {
        console.error('[status] docker ps failed:', err.message)
        process.exit(1)
    }

    const lines = stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
        console.log(JSON.stringify({ message: 'No Insidiae containers found.' }, null, 2))
        return
    }

    const report: StatusReport = {}

    for (const line of lines) {
        let raw: any
        try   { raw = JSON.parse(line) }
        catch { console.warn('[status] Could not parse line:', line); continue }

        const labels    = parseDockerLabels(raw.Labels ?? '')
        const pool      = labels[LABEL.POOL]      ?? 'unknown'
        const type      = labels[LABEL.TYPE]      ?? 'unknown'
        const collector = labels[LABEL.COLLECTOR] ?? undefined

        if (!report[pool]) report[pool] = { pool_services: [], collectors: [] }

        const base: ContainerEntry = {
            id:      raw.ID        ?? '',
            name:    raw.Names     ?? '',
            image:   raw.Image     ?? '',
            status:  raw.Status    ?? '',
            ports:   raw.Ports     ?? '',
            created: raw.CreatedAt ?? '',
            session: labels[LABEL.SESSION]
        }

        if (type === 'collector' && collector) {
            report[pool].collectors.push({ collector, ...base })
        } else {
            report[pool].pool_services.push(base)
        }
    }

    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

async function cmdPs(): Promise<void> {
    await spawnInherited('docker', [
        'ps', '-a',
        '--filter', `label=${LABEL.PROJECT}=${PROJECT_NAME}`
    ])
}

async function cmdStop(): Promise<void> {
    console.log('[stop] Stopping Insidiae containers …')
    await spawnInherited('docker', ['compose', '-f', COMPOSE_PATH, 'stop'])
    console.log('[stop] All containers stopped.')
}

function runComposeUp(): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('[run] docker compose up -d …\n')

        const proc = spawn('docker', ['compose', '-f', COMPOSE_PATH, 'up', '-d'], {
            stdio: ['inherit', 'pipe', 'pipe']
        })

        proc.stdout?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').forEach((line) => {
                if (line.trim()) process.stdout.write(`[docker] ${line}\n`)
            })
        })

        proc.stderr?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').forEach((line) => {
                if (line.trim()) process.stderr.write(`[docker] ${line}\n`)
            })
        })

        proc.on('error', (err) => {
            console.error('[run] Failed to start docker compose:', err.message)
            reject(err)
        })

        proc.on('close', (code) => {
            if (code === 0) {
                console.log('\n[run] docker compose up -d completed successfully.')
                resolve()
            } else {
                const err = new Error(`[run] docker compose up -d exited with code ${code}`)
                console.error(err.message)
                reject(err)
            }
        })
    })
}

async function cmdDefault(): Promise<void> {
    await cmdWrite()
    console.log('')
    await runComposeUp()
}

// ─── Entry point ──────────────────────────────────────────────────────────────

void (async () => {
    const [, , flag] = process.argv

    try {
        switch (flag) {
            case '-write':
            case '-w':
                await cmdWrite()
                break

            case '-read':
            case '-r':
                await cmdRead()
                break

            case '-status':
            case '-s':
                await cmdStatus()
                break

            case '-ps':
                await cmdPs()
                break

            case '-stop':
                await cmdStop()
                break

            case undefined:
                await cmdDefault()
                break

            default:
                console.error(`[main] Unknown command: ${flag}`)
                console.error(
                    'Usage: tsx index.ts [-setup | -read | -r | -status | -s | -ps | -stop]'
                )
                process.exit(1)
        }
    } catch (err: any) {
        console.error('[main] Fatal error:', err?.message ?? err)
        process.exit(1)
    }
})()