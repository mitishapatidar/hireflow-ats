# OAuth Token Security & Secret Storage

## 1. Zero Plain-Text Storage Guarantee
- No OAuth access token, refresh token, or third-party secret is stored in plain text in the database.
- Every credential is encrypted before write using **AES-256-GCM** authenticated symmetric encryption.

## 2. Cryptographic Protocol
- **Algorithm:** AES-256-GCM (`aes-256-gcm`).
- **Initialization Vector (IV):** Fresh cryptographically secure random 12-byte IV per encryption operation (`crypto.randomBytes(12)`).
- **Authentication Tag:** 16-byte GCM authentication tag verifying ciphertext authenticity and protecting against tampering.
- **Payload Format:** `ivHex:authTagHex:ciphertextHex`.
- **Key Management:** Master 256-bit encryption key sourced from `OAUTH_TOKEN_ENCRYPTION_KEY` environment variable.
