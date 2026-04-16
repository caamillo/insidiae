import { COLLECTOR } from '../../collector'

const name = COLLECTOR.Suricata

export default function({
    interface: iface = 'eth0',
    volumesPath
}) {
    return [
        {
            name,
            data: {
                image: 'jasonish/suricata:latest',
                container_name: 'suricata',
                network_mode: 'host',
                cap_add: ['NET_ADMIN', 'NET_RAW', 'SYS_NICE'],
                volumes: [
                    `${volumesPath.logsPath}:/var/log/suricata`,
                    `${volumesPath.configsPath}:/etc/suricata`,
                    `${volumesPath.configsPath}/rules:/var/lib/suricata/rules`
                ],
                environment: [`SURICATA_OPTIONS=-i ${iface}`],
                restart: 'always'
            }
        }
    ]
}