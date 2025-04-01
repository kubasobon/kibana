import type {
  CoreStart,
  ElasticsearchClient,
  KibanaRequest,
  SavedObjectsServiceStart,
} from '@kbn/core/server';

import type {
  SecuritySolutionPluginStart,
  SecuritySolutionPluginStartDependencies,
} from '../../plugin_contract';
import { Plugin as SecuritySolutionPlugin } from '../../plugin';
import { type EntityStoreDataClient } from '../../lib/entity_analytics/entity_store';

export function getEntityStoreDataClient(
  spy: jest.SpyInstance<
    SecuritySolutionPluginStart,
    [core: CoreStart, plugins: SecuritySolutionPluginStartDependencies]
  >
): EntityStoreDataClient {
  const pluginInstances = spy.mock.instances;
  if (pluginInstances.length === 0) {
    throw new Error('security_solution plugin not started');
  }
  const plugin = pluginInstances[0];
  if (plugin instanceof SecuritySolutionPlugin) {
    console.log(`KUBA: plugin: ${JSON.stringify(plugin)}`);
    /* eslint dot-notation: "off" */
    const dataClient = plugin['enityStore'];
    if (dataClient instanceof EntityStoreDataClient) {
      return dataClient;
    } else {
      throw new Error('security_solution plugin not started');
    }
  } else {
    throw new Error('security_solution plugin not started');
  }
}

