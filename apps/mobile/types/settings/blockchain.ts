import { z } from 'zod'

export const BackendSchema = z.enum(['electrum', 'esplora'])

export const NetworkSchema = z.enum(['bitcoin', 'testnet', 'signet'])

export const ProxyConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.number()
})

export const ServerSchema = z.object({
  backend: BackendSchema,
  name: z.string(),
  network: NetworkSchema,
  proxy: ProxyConfigSchema.optional(),
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
export type Network = z.infer<typeof NetworkSchema>
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>
export type Server = z.infer<typeof ServerSchema>
export type Config = z.infer<typeof ConfigSchema>
