import type { Blueprint, GraphNode, GraphEdge } from './types';
import { VisualRuleMatrix, compileRuleMatrixToPython } from './VisualRuleBuilder';

export interface PostmanParsedEndpoint {
  id: string;
  name: string;
  description: string;
  category: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  authHeader?: string;
  authSecret?: string;
  requestBody?: string;
  savedResponse?: string;
  savedResponseStatus?: number;
  ruleMatrix: VisualRuleMatrix;
  compiledPython: string;
  inputContract: Record<string, unknown>;
  outputContract: Record<string, unknown>;
}

// Demo Postman Collection with 5 complete endpoints (including Request & Saved Response)
export const DEMO_POSTMAN_COLLECTION_JSON = JSON.stringify(
  {
    info: {
      name: 'GSA & Federal Verification Suite',
      description: 'End-to-end identity, address, vendor and tax validation APIs',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'GSA Address & ZIP Verification',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-GSA-API-Key', value: 'gsa_live_key_9921' },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                street: '1800 F St NW',
                city: 'Washington',
                state: 'DC',
                zip: '20405',
              },
              null,
              2
            ),
          },
          url: {
            raw: 'https://api.gsa.gov/v2/address/verify',
            protocol: 'https',
            host: ['api', 'gsa', 'gov'],
            path: ['v2', 'address', 'verify'],
          },
          description: 'Validates federal delivery point addresses against master postal records.',
        },
        response: [
          {
            name: '200 OK - Verified',
            code: 200,
            status: 'OK',
            body: JSON.stringify(
              {
                status: 'VERIFIED',
                match_score: 95,
                address_match: true,
                dpv_code: 'Y',
                normalized: {
                  street: '1800 F ST NW',
                  city: 'WASHINGTON',
                  state: 'DC',
                  zip5: '20405',
                  zip4: '0001',
                },
              },
              null,
              2
            ),
          },
        ],
      },
      {
        name: 'USPS Delivery Point Validation (DPV)',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer usps_token_sec_4410' },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                recipient: 'General Services Dept',
                address_line1: '400 7th St SW',
                zip5: '20024',
              },
              null,
              2
            ),
          },
          url: {
            raw: 'https://api.usps.com/addresses/v3/dpv-check',
            protocol: 'https',
            host: ['api', 'usps', 'com'],
            path: ['addresses', 'v3', 'dpv-check'],
          },
          description: 'CASS-certified delivery point verification and carrier route lookup.',
        },
        response: [
          {
            name: '200 OK - Deliverable',
            code: 200,
            status: 'OK',
            body: JSON.stringify(
              {
                dpv_confirmation: 'Y',
                carrier_route: 'C004',
                vacant: 'N',
                commercial: 'Y',
              },
              null,
              2
            ),
          },
        ],
      },
      {
        name: 'SAM.gov Vendor Exclusion & Status Check',
        request: {
          method: 'GET',
          header: [{ key: 'X-API-KEY', value: 'sam_gov_key_7781' }],
          url: {
            raw: 'https://api.sam.gov/entity-information/v3/entities?uei=N7M1QG8J4K12',
            protocol: 'https',
            host: ['api', 'sam', 'gov'],
            path: ['entity-information', 'v3', 'entities'],
            query: [{ key: 'uei', value: 'N7M1QG8J4K12' }],
          },
          description: 'Retrieves active registration status and exclusions from federal SAM.gov registry.',
        },
        response: [
          {
            name: '200 OK - Active Vendor',
            code: 200,
            status: 'OK',
            body: JSON.stringify(
              {
                uei: 'N7M1QG8J4K12',
                legal_business_name: 'Acme Federal Solutions LLC',
                active_status: 'ACTIVE',
                excluded: false,
                debt_subject_to_offset: false,
              },
              null,
              2
            ),
          },
        ],
      },
      {
        name: 'IRS TIN / EIN Tax Match Validation',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-IRS-CLIENT-ID', value: 'irs_client_sec_99182' },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                tin: '12-3456789',
                name_control: 'ACME',
              },
              null,
              2
            ),
          },
          url: {
            raw: 'https://api.treasury.gov/tax/v1/tin-match',
            protocol: 'https',
            host: ['api', 'treasury', 'gov'],
            path: ['tax', 'v1', 'tin-match'],
          },
          description: 'Validates Taxpayer Identification Numbers (TIN/EIN) against federal IRS databases.',
        },
        response: [
          {
            name: '200 OK - Match Exact',
            code: 200,
            status: 'OK',
            body: JSON.stringify(
              {
                match_code: '1',
                match_result: 'EXACT_MATCH',
                status: 'VERIFIED',
                confidence: 1.0,
              },
              null,
              2
            ),
          },
        ],
      },
      {
        name: 'Fintech Real-Time Fraud & KYC Screener',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-KYC-KEY', value: 'kyc_live_token_3321' },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                user_id: 'usr_98129',
                ip_address: '198.51.100.42',
                amount: 4500.0,
                country_code: 'US',
              },
              null,
              2
            ),
          },
          url: {
            raw: 'https://api.fintechglobal.com/v2/fraud/assess',
            protocol: 'https',
            host: ['api', 'fintechglobal', 'com'],
            path: ['v2', 'fraud', 'assess'],
          },
          description: 'Calculates transaction risk score and scans international sanctions/PEP watchlists.',
        },
        response: [
          {
            name: '200 OK - Low Risk',
            code: 200,
            status: 'OK',
            body: JSON.stringify(
              {
                risk_score: 14.5,
                risk_level: 'LOW',
                sanctions_hit: false,
                pep_hit: false,
                recommendation: 'APPROVE',
              },
              null,
              2
            ),
          },
        ],
      },
    ],
  },
  null,
  2
);

export function parsePostmanCollection(jsonString: string): PostmanParsedEndpoint[] {
  let parsed: any;
  try {
    parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch {
    throw new Error('Invalid JSON format. Please provide a valid Postman Collection JSON.');
  }

  const items: any[] = [];

  function collectItems(node: any) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(collectItems);
    } else if (node.item && Array.isArray(node.item)) {
      node.item.forEach(collectItems);
    } else if (node.request) {
      items.push(node);
    }
  }

  if (parsed.item) {
    collectItems(parsed.item);
  } else if (Array.isArray(parsed)) {
    collectItems(parsed);
  } else if (parsed.request) {
    items.push(parsed);
  }

  if (items.length === 0) {
    throw new Error('No valid requests found in the Postman collection.');
  }

  return items.map((item, idx) => {
    const req = item.request || {};
    const name = item.name || `Endpoint ${idx + 1}`;
    const method = (req.method || 'GET').toUpperCase() as PostmanParsedEndpoint['method'];

    // Resolve URL string
    let urlStr = '';
    if (typeof req.url === 'string') {
      urlStr = req.url;
    } else if (req.url && typeof req.url === 'object') {
      urlStr = req.url.raw || '';
      if (!urlStr && req.url.host) {
        const protocol = req.url.protocol ? `${req.url.protocol}://` : 'https://';
        const host = Array.isArray(req.url.host) ? req.url.host.join('.') : req.url.host;
        const path = Array.isArray(req.url.path) ? req.url.path.join('/') : req.url.path || '';
        urlStr = `${protocol}${host}/${path}`;
      }
    }
    if (!urlStr) urlStr = 'https://api.tenant.gov/v1/resource';

    // Headers
    const headersMap: Record<string, string> = {};
    if (Array.isArray(req.header)) {
      req.header.forEach((h: any) => {
        if (h.key && !h.disabled) {
          headersMap[h.key] = h.value || '';
        }
      });
    }

    // Request Body
    let reqBodyStr = '';
    if (req.body) {
      if (req.body.raw) {
        reqBodyStr = req.body.raw;
      } else if (req.body.urlencoded) {
        reqBodyStr = JSON.stringify(
          req.body.urlencoded.reduce((acc: any, curr: any) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
          }, {}),
          null,
          2
        );
      }
    }

    // Saved Response
    let savedRespStr = '';
    let savedRespStatus = 200;
    if (Array.isArray(item.response) && item.response.length > 0) {
      const firstResp = item.response[0];
      savedRespStatus = firstResp.code || 200;
      savedRespStr = firstResp.body || '';
    }

    // Infer Input & Output Contracts
    let inputContract: Record<string, unknown> = { type: 'object', properties: {} };
    let outputContract: Record<string, unknown> = { type: 'object', properties: {} };

    try {
      if (reqBodyStr) {
        const parsedReq = JSON.parse(reqBodyStr);
        const props: Record<string, any> = {};
        Object.keys(parsedReq).forEach((k) => {
          props[k] = { type: typeof parsedReq[k] };
        });
        inputContract = { type: 'object', properties: props };
      }
    } catch {}

    let parsedRespJson: any = null;
    try {
      if (savedRespStr) {
        parsedRespJson = JSON.parse(savedRespStr);
        const props: Record<string, any> = {};
        Object.keys(parsedRespJson).forEach((k) => {
          props[k] = { type: typeof parsedRespJson[k] };
        });
        outputContract = { type: 'object', properties: props };
      }
    } catch {}

    // Auto-generate smart Visual Business Rule Matrix
    const ruleMatrix: VisualRuleMatrix = {
      branches: [],
      defaultOutcome: 'REJECT',
    };

    if (parsedRespJson) {
      // Find candidate condition fields
      if (parsedRespJson.status !== undefined) {
        ruleMatrix.branches.push({
          id: `branch-1`,
          name: 'Verified Status Approval',
          combinator: 'AND',
          conditions: [
            {
              id: 'c-1',
              field: 'status',
              operator: '==',
              value: String(parsedRespJson.status),
              valueType: 'string',
            },
          ],
          outcome: 'APPROVE',
          color: 'emerald',
        });
      } else if (parsedRespJson.dpv_confirmation !== undefined) {
        ruleMatrix.branches.push({
          id: `branch-1`,
          name: 'Delivery Confirmed',
          combinator: 'AND',
          conditions: [
            {
              id: 'c-1',
              field: 'dpv_confirmation',
              operator: '==',
              value: String(parsedRespJson.dpv_confirmation),
              valueType: 'string',
            },
          ],
          outcome: 'DELIVERABLE',
          color: 'emerald',
        });
      } else if (parsedRespJson.risk_score !== undefined) {
        ruleMatrix.branches.push({
          id: `branch-1`,
          name: 'Low Risk Criteria',
          combinator: 'AND',
          conditions: [
            {
              id: 'c-1',
              field: 'risk_score',
              operator: '<=',
              value: '30',
              valueType: 'number',
            },
          ],
          outcome: 'LOW_RISK_APPROVE',
          color: 'emerald',
        });
      } else if (parsedRespJson.active_status !== undefined) {
        ruleMatrix.branches.push({
          id: `branch-1`,
          name: 'Active Entity Approval',
          combinator: 'AND',
          conditions: [
            {
              id: 'c-1',
              field: 'active_status',
              operator: '==',
              value: 'ACTIVE',
              valueType: 'string',
            },
          ],
          outcome: 'ELIGIBLE',
          color: 'emerald',
        });
      } else {
        // Generic fallback rule branch
        ruleMatrix.branches.push({
          id: `branch-1`,
          name: 'Successful Response Evaluation',
          combinator: 'AND',
          conditions: [
            {
              id: 'c-1',
              field: Object.keys(parsedRespJson)[0] || 'success',
              operator: '!=',
              value: 'false',
              valueType: 'string',
            },
          ],
          outcome: 'APPROVE',
          color: 'emerald',
        });
      }
    } else {
      ruleMatrix.branches.push({
        id: `branch-1`,
        name: 'Default Approval Criteria',
        combinator: 'AND',
        conditions: [
          {
            id: 'c-1',
            field: 'status',
            operator: '==',
            value: 'VERIFIED',
            valueType: 'string',
          },
        ],
        outcome: 'APPROVE',
        color: 'emerald',
      });
    }

    const compiledPython = compileRuleMatrixToPython(ruleMatrix);

    return {
      id: `postman-ep-${Date.now()}-${idx}`,
      name,
      description: req.description || `Automated node blueprint created from Postman request for ${name}.`,
      category: 'Postman Integration',
      method,
      url: urlStr,
      headers: headersMap,
      requestBody: reqBodyStr,
      savedResponse: savedRespStr,
      savedResponseStatus: savedRespStatus,
      ruleMatrix,
      compiledPython,
      inputContract,
      outputContract,
    };
  });
}

export function convertEndpointToBlueprint(
  ep: PostmanParsedEndpoint,
  tenantId: string,
  userEmail: string
): Blueprint {
  const serviceNodeId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const decisionNodeId = `decision_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    blueprint_id: `bp-pm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    tenant_id: tenantId,
    name: ep.name,
    description: ep.description,
    status: 'PUBLISHED',
    version: 1,
    source_type: 'graph',
    created_by: userEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input_contract: ep.inputContract,
    output_contract: ep.outputContract,
    graph_definition: {
      nodes: [
        {
          id: serviceNodeId,
          type: 'serviceNode',
          data: {
            label: `${ep.name} (Service)`,
            url: ep.url,
            method: ep.method,
            headers: ep.headers,
            timeout: 5000,
            retries: 2,
            requestBody: ep.requestBody,
            savedResponseExample: ep.savedResponse,
            savedResponseStatus: ep.savedResponseStatus,
          },
          position: { x: 100, y: 150 },
        },
        {
          id: decisionNodeId,
          type: 'decisionNode',
          data: {
            label: `${ep.name} (Rule Decision)`,
            script: ep.compiledPython,
            ruleMatrix: ep.ruleMatrix,
            branches: ep.ruleMatrix.branches.map((b) => b.outcome),
          },
          position: { x: 480, y: 150 },
        },
      ],
      edges: [
        {
          id: `edge_${serviceNodeId}_${decisionNodeId}`,
          source: serviceNodeId,
          target: decisionNodeId,
          condition: '',
        },
      ],
      inputs: {
        message: {},
      },
    },
  };
}
