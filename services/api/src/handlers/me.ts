import { AppError, NO_CASE, createLogger } from '@northmoor/shared';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { parseIdentity } from '../domain/identity';
import { config } from './config';

const json = (statusCode: number, body: object): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const { requestId, authorizer } = event.requestContext;
  const logger = createLogger({
    service: 'api-me',
    context: { caseId: NO_CASE, traceId: requestId },
    level: config.LOG_LEVEL,
  });
  try {
    const identity = parseIdentity(authorizer.jwt.claims);
    logger.info('Identity returned', { userId: identity.userId, role: identity.role });
    return Promise.resolve(json(200, identity));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    logger.warn('Identity rejected', { code: error.code });
    return Promise.resolve(json(403, { code: error.code }));
  }
}
