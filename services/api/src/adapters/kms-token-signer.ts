import { SignCommand, type KMSClient } from '@aws-sdk/client-kms';
import { AppError } from '@northmoor/shared';
import { derToJose } from '../domain/ecdsa-signature';
import type { TokenSigner } from '../domain/mint-tool-token';

const TIMEOUT_MS = 3000;
const NOT_RETRYABLE = new Set([
  'AccessDeniedException',
  'DisabledException',
  'InvalidKeyUsageException',
  'KMSInvalidStateException',
  'NotFoundException',
]);

/** Signs with a P-256 KMS key, so the private key never leaves KMS. */
export class KmsTokenSigner implements TokenSigner {
  readonly keyId: string;
  readonly #client: KMSClient;

  constructor(client: KMSClient, keyId: string) {
    this.#client = client;
    this.keyId = keyId;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    let signature: Uint8Array | undefined;
    try {
      ({ Signature: signature } = await this.#client.send(
        new SignCommand({
          KeyId: this.keyId,
          Message: message,
          MessageType: 'RAW',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }),
        { abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
      ));
    } catch (cause) {
      throw new AppError('Tool token could not be signed', {
        code: 'TOOL_TOKEN_SIGN_FAILED',
        retryable: !(cause instanceof Error && NOT_RETRYABLE.has(cause.name)),
        cause,
      });
    }
    return derToJose(signature ?? new Uint8Array());
  }
}
