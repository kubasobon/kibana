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
// ???
import type { GetEntityStoreStatusResponse } from '../../../../solutions/security/plugins/security_solution/common/api/entity_analytics/entity_store/status.gen'

export default function (providerContext: FtrProviderContext) {
  // const logger = getService('log');
  const supertest = providerContext.getService('supertest');
  const retry = providerContext.getService('retry');

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
      before(async () => {
        // Initialize security solution by visiting a single view.
        // Helps avoid "Error initializing entity store: Data view not found 'security-solution-default'"
        let response = await supertest
          .post('/api/content_management/rpc/create')
          .set('kbn-xsrf', 'xxxx')
          .send({
            contentTypeId: "index-pattern",
            data: {
              fieldAttrs: "{}",
              title: ".alerts-security.alerts-default,apm-*-transaction*,auditbeat-*,endgame-*,filebeat-*,logs-*,packetbeat-*,traces-apm*,winlogbeat-*,-*elastic-cloud-logs-*",
              timeFieldName: "@timestamp",
              sourceFilters: "[]",
              fields: "[]",
              fieldFormatMap: "{}",
              allowNoIndex: true,
              runtimeFieldMap: "{}",
              name: ".alerts-security.alerts-default,apm-*-transaction*,auditbeat-*,endgame-*,filebeat-*,logs-*,packetbeat-*,traces-apm*,winlogbeat-*,-*elastic-cloud-logs-*",
              allowHidden: false
            },
            options: {
              id: "security-solution-default",
              overwrite: true
            },
            version: 1
          });
        expect(response.statusCode).to.eql(200);


        // And now we can enable the Entity Store
        response = await supertest
          .post('/api/entity_store/enable')
          .set('kbn-xsrf', 'xxxx')
          .send({});
        expect(response.statusCode).to.eql(200);
        expect(response.body.succeeded).to.eql(true);
      });

      it("Should return 200 and status 'running' for all engines", async () => {
        await retry.waitForWithTimeout('Entity Store to initialize', 5 * 60 * 1000, async () => {
            const { body } = await supertest
              .get('/api/entity_store/status')
              .query({include_components: true})
              .expect(200)
            expect(body.status).to.eql('running', `KUBA GOT THIS ${JSON.stringify(body)}`);
            return true;
        });

        const response = await supertest
          .get('/api/entity_store/status')
          .expect(200)
        // const response: GetEntityStoreStatusResponse = body as GetEntityStoreStatusResponse
        // THIS SHOULD HAPPEN, BUT LET ME DEBUG
        expect(response.body.status).to.eql('running');
        // Additional tests for all engines...
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
  }[]
}
*/
