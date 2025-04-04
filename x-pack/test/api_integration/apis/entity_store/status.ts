/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import expect from '@kbn/expect';
import {
  ELASTIC_HTTP_VERSION_HEADER,
} from '@kbn/core-http-common';
import { FtrProviderContext } from '@kbn/ftr-common-functional-services';
import type { GetEntityStoreStatusResponse } from '../../../../solutions/security/plugins/security_solution/common/api/entity_analytics/entity_store/status.gen'

const HOST_TRANSFORM_ID: string = 'entities-v1-latest-security_host_default';
const TIMEOUT_MS: number = 300000; // 5 minutes
const DATASTREAM_NAME: string = 'logs-elastic_agent.cloudbeat-test';
const INDEX_NAME: string = '.entities.v1.latest.security_host_default';

export default function (providerContext: FtrProviderContext) {
  const supertest = providerContext.getService('supertest');
  const retry = providerContext.getService('retry');
  const es = providerContext.getService('es');

  describe('GET /api/entity_store/status', () => {

    describe('not_installed', () => {
      it("Should return 200 and status 'not_installed'", async () => {
        const { body } = await supertest
          .get('/api/entity_store/status')
          .expect(200);

        const response: GetEntityStoreStatusResponse = body as GetEntityStoreStatusResponse
        expect(response.status).to.eql('not_installed');
      });
    });

    describe('running', () => {
      // TODO: not needed anymore?
      // let index_name: string = '';

      before(async () => {
        // Initialize security solution by creating a prerequisite index pattern.
        // Helps avoid "Error initializing entity store: Data view not found 'security-solution-default'"
        let response = await supertest
          .post('/api/content_management/rpc/create')
          .set('kbn-xsrf', 'xxxx')
          .send({
            contentTypeId: 'index-pattern',
            data: {
              fieldAttrs: '{}',
              title: '.alerts-security.alerts-default,apm-*-transaction*,auditbeat-*,endgame-*,filebeat-*,logs-*,packetbeat-*,traces-apm*,winlogbeat-*,-*elastic-cloud-logs-*',
              timeFieldName: '@timestamp',
              sourceFilters: '[]',
              fields: '[]',
              fieldFormatMap: '{}',
              allowNoIndex: true,
              runtimeFieldMap: '{}',
              name: '.alerts-security.alerts-default,apm-*-transaction*,auditbeat-*,endgame-*,filebeat-*,logs-*,packetbeat-*,traces-apm*,winlogbeat-*,-*elastic-cloud-logs-*',
              allowHidden: false
            },
            options: {
              id: 'security-solution-default',
              overwrite: true
            },
            version: 1
          });
        expect(response.statusCode).to.eql(200);

        // Create a test index matching transform's pattern to store test documents
        await es.indices.createDataStream({name: DATASTREAM_NAME});
        /* TODO: not needed anymore?
        response = await es.indices.getDataStream({name: DATASTREAM_NAME});
        expect(response.data_streams.length).to.eql(1)
        expect(response.data_streams[0].indices.length).to.eql(1);
        index_name = response.data_streams[0].indices[0].index_name;
        expect(index_name.length).to.greaterThan(0);
        */

        // And now we can enable the Entity Store...
        response = await supertest
          .post('/api/entity_store/enable')
          .set('kbn-xsrf', 'xxxx')
          .send({});
        expect(response.statusCode).to.eql(200);
        expect(response.body.succeeded).to.eql(true);

        // and wait for it to start up
        await retry.waitForWithTimeout('Entity Store to initialize', TIMEOUT_MS, async () => {
            const { body } = await supertest
              .get('/api/entity_store/status')
              .query({include_components: true})
              .expect(200)
            expect(body.status).to.eql('running');
            return true;
        });
      });

      after(async () => {
        await es.indices.deleteDataStream({name: DATASTREAM_NAME});
      })

      it("Should return 200 and status 'running' for all engines", async () => {
        const { body } = await supertest
          .get('/api/entity_store/status')
          .query({include_components: true})
          .expect(200)

        const response: GetEntityStoreStatusResponse = body as GetEntityStoreStatusResponse
        expect(response.status).to.eql('running');
        for (const engine of response.engines) {
          expect(engine.status).to.eql('started');
          for (const component of engine.components) {
            expect(component.installed).to.be(true);
          }
        }
      });

      it('Should successfully trigger a host transform', async () => {
        let response = await es.transform.getTransformStats({
          transform_id: HOST_TRANSFORM_ID,
        });
        expect(response.count).to.eql(1);
        let transform = response.transforms[0];
        expect(transform.id).to.eql(HOST_TRANSFORM_ID);
        const triggerCount: number = transform.stats.trigger_count;
        const docsProcessed: number = transform.stats.documents_processed;

        // TODO: Insert the 2 documents
        const isoTimestamp: string = (new Date).toISOString().split('.')[0];

        const { _id: documentID, result } = await es.index({
          index: DATASTREAM_NAME,
          document: {
            '@timestamp': isoTimestamp, // TODO: make it automatically assign correct timestamp in the last 24h
            host: {
              name: 'kuba-test', // MANDATORY
              ip: '1.1.1.1',
            },
          },
        })
        expect(result).to.eql('created');

        // Document no 2.
        const { _id: documentID2, result: result2 } = await es.index({
          index: DATASTREAM_NAME,
          document: {
            // THE TIMESTAMP HAS TO BE VERY RECENT
            '@timestamp': isoTimestamp, // TODO: make it automatically assign correct timestamp in the last 24h
            host: {
              name: 'kuba-test', // MANDATORY
              ip: '2.2.2.2',
            },
          },
        })
        expect(result2).to.eql('created');

        // Trigger the transform manually
        const { acknowledged } = await es.transform.scheduleNowTransform({
          transform_id: HOST_TRANSFORM_ID,
        });
        expect(acknowledged).to.be(true);

        await retry.waitForWithTimeout('Transform to run again', TIMEOUT_MS, async () => {
          let response = await es.transform.getTransformStats({
            transform_id: HOST_TRANSFORM_ID,
          });
          let transform = response.transforms[0];
          expect(transform.stats.trigger_count).to.greaterThan(triggerCount);
          expect(transform.stats.documents_processed).to.greaterThan(docsProcessed);
          return true;
        });

        // TODO: Check if the document changed
        await retry.waitForWithTimeout('Document to be processed and transformed', TIMEOUT_MS, async () => {
          const result = await es.search({
            index: INDEX_NAME,
            query: {
              term: {
                "host.name": 'kuba-test',
              },
            },
          })
          expect(result.hits.total.value).to.eql(1);
          expect(result.hits.hits[0]._source.host.name).to.eql('kuba-test');
          expect(result.hits.hits[0]._source.host.ip).to.eql(['1.1.1.1', '2.2.2.2']);

          return true;
        })

      });
    });
  });

}

/*
type entityStoreStatusResponse = {
  status: string
  engines: {
      status: string
      type: string
      delay: string
      timeout: string
      frequency: string
      lookbackPeriod: string
      fieldHistoryLength: number
      indexPattern: string
      filter: string
      enrichPolicyExecutionInterval: string
      timestampField: string
      components: {
        id: string
        installed: boolean
      }[]
  }[]
}
*/
