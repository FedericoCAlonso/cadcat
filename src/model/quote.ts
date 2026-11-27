import { z } from 'zod';

export const workshopCostingModeSchema = z.enum(['outsourced', 'in-house']).default('outsourced');
export type WorkshopCostingMode = z.infer<typeof workshopCostingModeSchema>;

export const quoteCurrencySchema = z.enum(['ARS', 'USD']).default('ARS');
export type QuoteCurrency = z.infer<typeof quoteCurrencySchema>;

/**
 * Commercial budgeting and workshop costing configuration (Zero Hardcoding — persisted in ProjectConfig).
 */
export const commercialQuoteConfigSchema = z.object({
  workshopMode: workshopCostingModeSchema,
  /** Extra linear percentage for edgeband lead-in / tail waste (typical 10-20%). */
  edgeBandWastePercent: z.number().min(0).max(100).default(15),
  /** External placacentro edge-banding application service price per linear meter. */
  edgeBandingServicePerMeter: z.number().min(0).default(0),
  /** Percentage of unused offcut area credited back in 'in-house' mode (0-50%). */
  usableOffcutCreditPercent: z.number().min(0).max(50).default(0),
  /** Standard workshop labor hours per base module carcass. */
  laborHoursPerModule: z.number().min(0).default(4),
  /** Additional labor hours per drawer assembly. */
  laborHoursPerDrawer: z.number().min(0).default(1.2),
  /** Additional labor hours per hinged/bifold door. */
  laborHoursPerDoor: z.number().min(0).default(0.8),
  /** Additional labor hours per shelf. */
  laborHoursPerShelf: z.number().min(0).default(0.25),
  /** Workshop hourly labor rate (in base ARS currency). */
  hourlyLaborRate: z.number().min(0).default(0),
  /** Consumables percentage (screws, glue, caps, packaging) over direct materials + hardware. */
  consumablesPercent: z.number().min(0).max(100).default(5),
  /** Logistics / freight cost in base currency. */
  deliveryCost: z.number().min(0).default(0),
  /** On-site installation / mounting cost in base currency. */
  installationCost: z.number().min(0).default(0),
  /** Fixed workshop overhead percentage over direct workshop costs. */
  overheadPercent: z.number().min(0).max(200).default(10),
  /** Target commercial markup percentage over total internal cost. */
  profitMarginPercent: z.number().min(0).max(500).default(35),
  /** Commercial client discount percentage applied to net price before VAT. */
  discountPercent: z.number().min(0).max(100).default(0),
  /** VAT / IVA percentage (e.g. 21% in Argentina, 0% for informal/exempt quotes). */
  vatPercent: z.number().min(0).max(100).default(21),
  /** Primary display currency for commercial client quote. */
  currency: quoteCurrencySchema,
  /** Exchange rate (ARS per 1 USD) for multi-currency equivalence. */
  exchangeRateArsPerUsd: z.number().positive().default(1200),
  /** Quote validity window in calendar days. */
  validityDays: z.number().int().min(1).max(365).default(15),
  /** Estimated workshop lead time in business days. */
  leadTimeDays: z.number().int().min(1).max(365).default(20),
  /** Commercial payment terms printed on client quote PDF. */
  paymentTerms: z
    .string()
    .min(1)
    .default('50% de seña al confirmar el pedido · 50% contra entrega.'),
  /** Optional commercial notes printed on client quote PDF. */
  clientNotes: z
    .string()
    .default('No incluye trabajos de albañilería, plomería ni instalaciones eléctricas.'),
});

export type CommercialQuoteConfig = z.infer<typeof commercialQuoteConfigSchema>;

export const DEFAULT_COMMERCIAL_QUOTE_CONFIG: CommercialQuoteConfig =
  commercialQuoteConfigSchema.parse({});
