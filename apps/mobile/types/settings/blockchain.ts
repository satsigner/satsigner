import { z } from 'zod'

export const BackendSchema = z.enum(['electrum', 'esplora', 'rpc'])

export const NetworkSchema = z.enum(['bitcoin', 'testnet', 'signet'])

export const ProxyConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.number()
})

/**
 * Bitcoin Core RPC credentials.
 *
 * SECURITY: These are currently persisted in plaintext via the blockchain
 * Zustand store (unencrypted MMKV in `storage/mmkv.ts`). Unlike seed material
 * (expo-secure-store), a compromised device backup or filesystem read can
 * expose node credentials — which grant full RPC control, including spend if
 * a hot wallet is loaded. Prefer a watch-only Core wallet and treat the
 * device as the security boundary until credentials move to SecureStore.
 */
export const RpcCredentialsSchema = z.object({
  password: z.string(),
  username: z.string()
})

export const ServerSchema = z.object({
  backend: BackendSchema,
  name: z.string(),
  network: NetworkSchema,
  proxy: ProxyConfigSchema.optional(),
  rpcCredentials: RpcCredentialsSchema.optional(),
  rpcScanFromHeight: z.number().int().nonnegative().optional(),
  rpcWalletName: z.string().optional(),
  url: z.string()
})

export const ConfigSchema = z.object({
  connectionMode: z.enum(['auto', 'manual']),
  connectionTestInterval: z.number(),
  retries: z.number(),
  stopGap: z.number(),
  timeDiffBeforeAutoSync: z.number(),
  timeout: z.number()
})

export type Backend = z.infer<typeof BackendSchema>
export type Config = z.infer<typeof ConfigSchema>
export type Network = z.infer<typeof NetworkSchema>
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>
export type RpcCredentials = z.infer<typeof RpcCredentialsSchema>
export type Server = z.infer<typeof ServerSchema>
