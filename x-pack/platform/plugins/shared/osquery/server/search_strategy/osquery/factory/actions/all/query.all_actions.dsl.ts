/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';

import type { ISearchRequestParams } from '@kbn/search-types';
import { AGENT_ACTIONS_INDEX } from '@kbn/fleet-plugin/common';
import type { AgentsRequestOptions } from '../../../../../../common/search_strategy/osquery/agents';
import { getQueryFilter } from '../../../../../utils/build_query';
import { ACTIONS_INDEX } from '../../../../../../common/constants';

export const buildActionsQuery = ({
  kuery = '',
  sort,
  pagination: { cursorStart, querySize },
  componentTemplateExists,
}: AgentsRequestOptions): ISearchRequestParams => {
  const {
    bool: { filter },
  } = getQueryFilter({ filter: kuery });

  return {
    allow_no_indices: true,
    index: componentTemplateExists ? `${ACTIONS_INDEX}*` : AGENT_ACTIONS_INDEX,
    ignore_unavailable: true,
    query: {
      bool: {
        filter,
        must: [
          {
            term: {
              type: {
                value: 'INPUT_ACTION',
              },
            },
          },
          {
            term: {
              input_type: {
                value: 'osquery',
              },
            },
          },
        ] as estypes.QueryDslQueryContainer[],
      },
    },
    from: cursorStart,
    size: querySize,
    track_total_hits: true,
    fields: ['*'],
    sort: [
      {
        [sort.field]: {
          order: sort.direction,
        },
      },
    ],
  };
};
