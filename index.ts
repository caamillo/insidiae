import { setup } from './docker'

setup('./docker-compose.yml', [
    {
        pool: {
            name: "elasticsearch",
            memoryLimit: "1g",
            port: "9200",
            withKibana: true,
        },
        collectors: [
            {
                name: "suricata",
                interface: "eth1"
            },
            {
                name: "zeek"
            }
        ]
    }
])