import { COLLECTOR } from '../../collector'

const name = COLLECTOR.Suricata

export default function({
    volumesPath,
    interface: iface = null
}) {
    const environment = iface ? [`SURICATA_OPTIONS=-i ${iface}`] : []

    return [
        {
            name,
            data: {
                image: 'jasonish/suricata:latest',
                container_name: 'suricata',
                volumes: [
                    `${volumesPath.logsPath}:/var/log/suricata`,
                    `${volumesPath.configsPath}:/etc/suricata`,
                    `${volumesPath.configsPath}/rules:/var/lib/suricata/rules`
                ],
                ...(environment.length > 0 && { environment }),
                restart: 'always'
            }
        }
    ]
}