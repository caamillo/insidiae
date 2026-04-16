import { COLLECTOR } from '../../collector'

const name = COLLECTOR.Zeek

export default function({
    volumesPath,
    interface: iface = null
}) {
    const environment = iface ? [`ZEEK_INTERFACE=${iface}`] : []

    return [
        {
            name,
            data: {
                image: 'zeek/zeek:latest',
                container_name: 'zeek',
                volumes: [`${volumesPath.logsPath}:/var/log/zeek`],
                ...(environment.length > 0 && { environment }),
                restart: 'always'
            }
        }
    ]
}