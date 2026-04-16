import { COLLECTOR_POOL } from '../../collector/pool'

const name = COLLECTOR_POOL.Elasticsearch

export default function({
    memoryLimit = '512m',
    port = '9200',
    withKibana = false,
    volumesPath = {
        logsPath: './_data/logs',
        configsPath: './_data/configs'
    },
    logsPath = null,
    configsPath = null
}) {

    if (logsPath   && typeof logsPath   === 'string' && logsPath.length   > 0) volumesPath.logsPath   = logsPath
    if (configsPath && typeof configsPath === 'string' && configsPath.length > 0) volumesPath.configsPath = configsPath

    const services = [
        {
            name,
            data: {
                image: 'docker.elastic.co/elasticsearch/elasticsearch:8.12.0',
                container_name: 'elasticsearch',
                environment: [
                    'discovery.type=single-node',
                    'xpack.security.enabled=false',
                    `ES_JAVA_OPTS=-Xms${memoryLimit} -Xmx${memoryLimit}`
                ],
                ports: [`${port}:9200`, '9300:9300'],
                volumes: [
                    `${volumesPath.logsPath}/${name.toLowerCase()}:/usr/share/elasticsearch/data`
                ],
                restart: 'always'
            }
        }
    ]

    if (withKibana) {
        services.push({
            name: `${name}_kibana`,
            data: {
                image: 'docker.elastic.co/kibana/kibana:8.12.0',
                container_name: 'kibana',
                environment: [
                    `ELASTICSEARCH_HOSTS=http://${name.toLowerCase()}:9200`
                ],
                ports: ['5601:5601'],
                depends_on: [name.toLowerCase()],
                restart: 'always'
            }
        })
    }

    return { services, volumesPath }
}