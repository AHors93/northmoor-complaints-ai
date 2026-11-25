import { AppError, NO_CASE, createLogger } from '@northmoor/shared';
import type { PreTokenGenerationV2TriggerEvent } from 'aws-lambda';
import { z } from 'zod';
import { buildTokenAdditions } from '../domain/token-claims';
import { config } from './config';

const eventSchema = z.object({
  request: z.object({
    userAttributes: z.object({ sub: z.string().min(1), 'custom:team': z.string().optional() }),
    groupConfiguration: z.object({ groupsToOverride: z.array(z.string()).nullish() }),
  }),
});

/** Adds role, team and scopes to the access token. Throwing stops the sign-in. */
export function handler(
  event: PreTokenGenerationV2TriggerEvent,
  context: { readonly awsRequestId: string },
): Promise<PreTokenGenerationV2TriggerEvent> {
  const logger = createLogger({
    service: 'api-pre-token',
    context: { caseId: NO_CASE, traceId: context.awsRequestId },
    level: config.LOG_LEVEL,
  });
  return Promise.resolve().then(() => {
    try {
      const parsed = eventSchema.safeParse(event);
      if (!parsed.success) {
        throw new AppError('Trigger event is not valid', {
          code: 'TRIGGER_EVENT_INVALID',
          retryable: false,
        });
      }
      const { userAttributes, groupConfiguration } = parsed.data.request;
      const { role, team, scopes } = buildTokenAdditions({
        groups: groupConfiguration.groupsToOverride ?? [],
        team: userAttributes['custom:team'],
      });
      event.response = {
        claimsAndScopeOverrideDetails: {
          accessTokenGeneration: {
            claimsToAddOrOverride: { role, team },
            scopesToAdd: [...scopes],
          },
        },
      };
      return event;
    } catch (error) {
      logger.error('Sign-in refused', {
        code: error instanceof AppError ? error.code : 'UNEXPECTED',
      });
      throw error;
    }
  });
}
