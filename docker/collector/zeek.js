import { COLLECTOR } from '../../collector'

const name = COLLECTOR.Zeek

export default function({
    interface: iface = 'eth0',
    volumesPath
}) {
    return [
        {
            name,
            data: {
                image: 'zeek/zeek:latest',
                container_name: 'zeek',
                network_mode: 'host',
                cap_add: ['NET_ADMIN', 'NET_RAW'],
                volumes: [`${volumesPath.logsPath}:/var/log/zeek`],
                environment: [`ZEEK_INTERFACE=${iface}`],
                restart: 'always'
            }
        }
    ]
}