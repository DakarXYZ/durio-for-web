// Attachment size caps (dur.io): the server's `file_upload_size_limits.attachments` from
// `GET /` (100 MB on our servers), and a ceiling of our own for encrypted files.

/**
 * Encrypted files never go through the server's processing: the sender holds the
 * plaintext and the ciphertext in memory while encrypting, every reader holds the
 * download and the plaintext while decrypting, and decrypted files stay in memory (the
 * cache of `files.ts` keeps up to 200 MB). 100 MB keeps that at a few hundred MB per
 * file — fine on a desktop — whatever a server allows.
 */
export const MAX_ENCRYPTED_FILE_BYTES = 100_000_000;

/** Upstream's default, for a server that does not say */
const FALLBACK_LIMIT_BYTES = 20_000_000;

/**
 * Largest attachment the composer accepts
 * @param serverLimit `file_upload_size_limits.attachments` of the user's limits
 * @param encrypted Whether the channel is end-to-end encrypted
 */
export function attachmentLimit(
  serverLimit: number | undefined,
  encrypted: boolean,
): number {
  const limit =
    typeof serverLimit === "number" && serverLimit > 0
      ? serverLimit
      : FALLBACK_LIMIT_BYTES;
  return encrypted ? Math.min(limit, MAX_ENCRYPTED_FILE_BYTES) : limit;
}
