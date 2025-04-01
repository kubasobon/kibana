import Path from 'path';
import type { ElasticsearchClient } from '@kbn/core/server';

import { bulkInsert, setupTestServers, removeFile } from './lib/helpers';
import { getEntityStoreDataClient } from './lib/entity_store_helpers';

import type { EntityStoreDataClient } from '../lib/entity_analytics/entity_store/entity_store_data_client';

import {
  type TestElasticsearchUtils,
  type TestKibanaUtils,
} from '@kbn/core-test-helpers-kbn-server';
import { Plugin as SecuritySolutionPlugin } from '../plugin';

const logFilePath = Path.join(__dirname, 'entity-store-logs.log');
const securitySolutionPlugin = jest.spyOn(SecuritySolutionPlugin.prototype, 'start');

describe('EntityStore', () => {
  let esServer: TestElasticsearchUtils;
  let kibanaServer: TestKibanaUtils;
  let dataClient: EntityStoreDataClient;
  let esClient: ElasticsearchClient;
  const TEST_INDEX = 'test-entity-store';

  beforeAll(async () => {
    await removeFile(logFilePath);
    const servers = await setupTestServers(logFilePath);
    esServer = servers.esServer;
    kibanaServer = servers.kibanaServer;
    expect(securitySolutionPlugin).toHaveBeenCalledTimes(1);
    esClient = kibanaServer.coreStart.elasticsearch.client.asInternalUser;
    // How to make sure Entity Store is enabled?
    dataClient = getEntityStoreDataClient(securitySolutionPlugin);
    /*
    dataClient = new EntityStoreDataClient({
      clusterClient: clusterClientMock,
      logger: loggerMock,
      namespace: 'default',
      soClient: savedObjectsClientMock.create(),
      kibanaVersion: '9.0.0',
      dataViewsService: dataviewService as unknown as DataViewsService,
      appClient: {
        getSourcererDataViewId: jest.fn().mockReturnValue('security-solution'),
        getAlertsIndex: jest.fn().mockReturnValue('alerts'),
      } as unknown as AppClient,
      config: {} as EntityStoreConfig,
      experimentalFeatures: mockGlobalState.app.enableExperimental,
      taskManager: {} as TaskManagerStartContract,
      security: {
        authz: {
          checkPrivilegesDynamicallyWithRequest: () => mockCheckPrivileges,
        },
      } as unknown as SecurityPluginStart,
      request: {} as KibanaRequest,
    });
    */
  });


  afterAll(async () => {
    if (kibanaServer) {
      await kibanaServer.stop();
    }
    if (esServer) {
      await esServer.stop();
    }
  });

  it('should run at all', async () => {
    expect(1).toEqual(1);
  });
});
