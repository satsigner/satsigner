import { Buffer } from "buffer";

import * as bitcoinjs from "bitcoinjs-lib";
import { type Href } from "expo-router";
import { type PsbtLike } from "react-native-bdk-sdk";
import { toast } from "sonner-native";

import { DUST_LIMIT, SATS_PER_BITCOIN } from "@/constants/btc";
import { t } from "@/locales";
import { type Account } from "@/types/models/Account";
import { type Utxo } from "@/types/models/Utxo";
import { getKeyFingerprint } from "@/utils/account";
import { parseBitcoinUri } from "@/utils/bip321";
import { type DetectedContent } from "@/utils/contentDetector";
import {
  combinePsbts,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findMatchingAccount,
  getCollectedSignerPubkeys,
} from "@/utils/psbt";
import { selectEfficientUtxos } from "@/utils/utxo";

export type BitcoinUriExceedsBalancePromptInfo = {
  address: string;
  availableBalanceSats: number;
  label: string;
  requestedAmountSats: number;
};

type ProcessorActions = {
  navigate: (path: Href) => void;
  clearTransaction?: () => void;
  setAccountId?: (accountId: string) => void;
  addOutput?: (output: { amount: number; label: string; to: string }) => void;
  addInput?: (input: Utxo) => void;
  setFeeRate?: (rate: number) => void;
  setRbf?: (enabled: boolean) => void;
  setSignedPsbts?: (psbts: Map<number, string>) => void;
  setPsbt?: (psbt: PsbtLike) => void;
  promptBitcoinUriExceedsBalance?: (
    info: BitcoinUriExceedsBalancePromptInfo
  ) => Promise<"cancel" | "without_amount">;
};

function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  actions: Pick<ProcessorActions, "addInput" | "setFeeRate">
) {
  if (!account || account.utxos.length === 0) {
    return;
  }

  const { addInput, setFeeRate } = actions;

  if (setFeeRate && typeof setFeeRate === "function") {
    setFeeRate(1);
  }

  if (targetAmount === 0 || targetAmount === 1) {
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    );
    addInput?.(highestUtxo);
    return;
  }

  const result = selectEfficientUtxos(account.utxos, targetAmount, 1, {
    changeOutputSize: 34,
    dustThreshold: 546,
    inputSize: 148,
  });

  if (result.error) {
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    );
    addInput?.(highestUtxo);
  } else {
    for (const utxo of result.inputs) {
      addInput?.(utxo);
    }
  }
}

function commitBitcoinUriToIoPreview(
  actions: ProcessorActions,
  accountId: string,
  account: Account | undefined,
  address: string,
  label: string,
  amountSats: number
) {
  actions.addOutput?.({ amount: amountSats, label, to: address });
  if (account) {
    autoSelectUtxos(account, amountSats, actions);
  }
  actions.navigate({
    params: { id: accountId },
    pathname: "/signer/bitcoin/account/[id]/signAndSend/ioPreview",
  });
}

async function processBitcoinContent(
  content: DetectedContent,
  actions: ProcessorActions,
  accountId: string,
  account?: Account
) {
  const { navigate, clearTransaction, addOutput } = actions;

  if (clearTransaction) {
    clearTransaction();
  }

  actions.setAccountId?.(accountId);

  switch (content.type) {
    case "psbt": {
      let psbtBase64 = content.cleaned;
      if (/^[0-9a-fA-F]+$/.test(content.cleaned.trim())) {
        psbtBase64 = Buffer.from(content.cleaned, "hex").toString("base64");
      }

      navigate({
        params: { id: accountId, psbt: psbtBase64 },
        pathname: "/signer/bitcoin/account/[id]/signAndSend/previewTransaction",
      });

      if (account) {
        const accountMatch = await findMatchingAccount(psbtBase64, [account]);

        if (accountMatch) {
          const originalPsbt = extractOriginalPsbt(psbtBase64);

          const extractedData = extractTransactionDataFromPSBTEnhanced(
            originalPsbt,
            account
          );

          if (extractedData) {
            const inputs = extractedData?.inputs || [];
            const outputs = extractedData?.outputs || [];
            const fee = extractedData?.fee || 0;

            actions.setRbf?.(true);

            const finalSignedPsbtsMap = new Map<number, string>();

            if (accountMatch.account.policyType === "multisig") {
              const combinedPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64);

              const keyFingerprintToCosignerIndex = new Map<string, number>();
              await Promise.all(
                accountMatch.account.keys.map(async (key, index) => {
                  const fp = await getKeyFingerprint(key);
                  if (fp) {
                    keyFingerprintToCosignerIndex.set(fp, index);
                  }
                })
              );

              const pubkeyToCosignerIndex = new Map<string, number>();
              for (const input of combinedPsbt.data.inputs) {
                if (input.bip32Derivation) {
                  for (const derivation of input.bip32Derivation) {
                    const fingerprint =
                      derivation.masterFingerprint.toString("hex");
                    const pubkey = derivation.pubkey.toString("hex");
                    const cosignerIndex =
                      keyFingerprintToCosignerIndex.get(fingerprint);

                    if (cosignerIndex !== undefined) {
                      pubkeyToCosignerIndex.set(pubkey, cosignerIndex);
                    }
                  }
                }
                if (input.partialSig) {
                  for (const sig of input.partialSig) {
                    bitcoinjs.crypto
                      .hash160(sig.pubkey)
                      .slice(0, 4)
                      .toString("hex");
                  }
                }
              }

              const individualSignedPsbts = extractIndividualSignedPsbts(
                psbtBase64,
                originalPsbt
              );

              const psbtsByCosigner = new Map<number, string[]>();

              for (const psbtStr of Object.values(individualSignedPsbts)) {
                const pubkeys = getCollectedSignerPubkeys(psbtStr);
                if (pubkeys.size > 0) {
                  const pubkey = pubkeys.values().next().value;
                  if (pubkey) {
                    const cosignerIndex = pubkeyToCosignerIndex.get(pubkey);
                    if (cosignerIndex !== undefined) {
                      if (!psbtsByCosigner.has(cosignerIndex)) {
                        psbtsByCosigner.set(cosignerIndex, []);
                      }
                      psbtsByCosigner.get(cosignerIndex)!.push(psbtStr);
                    }
                  }
                }
              }

              for (const [cosignerIndex, psbts] of psbtsByCosigner.entries()) {
                if (psbts.length > 1) {
                  const combined = combinePsbts(psbts);
                  finalSignedPsbtsMap.set(cosignerIndex, combined);
                } else {
                  finalSignedPsbtsMap.set(cosignerIndex, psbts[0]);
                }
              }
            } else {
              const individualSignedPsbts = extractIndividualSignedPsbts(
                psbtBase64,
                originalPsbt
              );
              for (const [key, value] of Object.entries(
                individualSignedPsbts
              )) {
                finalSignedPsbtsMap.set(parseInt(key, 10), value as string);
              }
            }
            actions.setSignedPsbts?.(finalSignedPsbtsMap);

            const extractedTxid = extractTransactionIdFromPSBT(originalPsbt);
            if (!extractedTxid) {
              return;
            }

            const _sent = outputs.reduce(
              (acc: number, output) => acc + output.value,
              0
            );
            const _received = inputs.reduce(
              (acc: number, input) => acc + (input.value || 0),
              0
            );

            const mockPsbt = {
              extractTxHex: () => "",
              feeAmount: () => fee,
              toBase64: () => originalPsbt,
              txid: () => extractedTxid,
            } as unknown as PsbtLike;
            actions.setPsbt?.(mockPsbt);
          }
        }
      }

      break;
    }

    case "bitcoin_descriptor":
      actions.navigate({
        params: { descriptor: content.cleaned },
        pathname: "/signer/bitcoin/account/add/watchOnly",
      });
      break;

    case "extended_public_key":
      actions.navigate({
        params: { extendedPublicKey: content.cleaned },
        pathname: "/signer/bitcoin/account/add/watchOnly",
      });
      break;

    case "bitcoin_transaction":
      navigate({
        params: { id: accountId, signedPsbt: content.cleaned },
        pathname: "/signer/bitcoin/account/[id]/signAndSend/previewTransaction",
      });
      break;

    case "bitcoin_uri": {
      async function commitOrPromptBitcoinUri(
        address: string,
        label: string,
        amountSats: number
      ): Promise<"cancel" | "dust" | "ok"> {
        if (amountSats > 1 && amountSats < DUST_LIMIT) {
          return "dust";
        }

        if (account?.summary && amountSats > account.summary.balance) {
          if (actions.promptBitcoinUriExceedsBalance) {
            const choice = await actions.promptBitcoinUriExceedsBalance({
              address,
              availableBalanceSats: account.summary.balance,
              label,
              requestedAmountSats: amountSats,
            });
            if (choice === "cancel") {
              return "cancel";
            }
            commitBitcoinUriToIoPreview(
              actions,
              accountId,
              account,
              address,
              label,
              1
            );
            return "ok";
          }
          return "cancel";
        }

        commitBitcoinUriToIoPreview(
          actions,
          accountId,
          account,
          address,
          label,
          amountSats
        );
        return "ok";
      }

      try {
        let uriToDecode = content.cleaned;
        if (!uriToDecode.toLowerCase().startsWith("bitcoin:")) {
          uriToDecode = `bitcoin:${uriToDecode}`;
        }

        const parsed = parseBitcoinUri(uriToDecode);
        if (parsed.isValid && parsed.address) {
          const amountSats =
            Math.round((parsed.amount || 0) * SATS_PER_BITCOIN) || 1;
          const outcome = await commitOrPromptBitcoinUri(
            parsed.address,
            parsed.label || "",
            amountSats
          );
          if (outcome === "dust") {
            toast.error(t("transaction.error.dustOutputBelowLimit"));
          }
        } else {
          const addressMatch = content.cleaned.match(
            /^([a-zA-Z0-9]{26,62})(\?.*)?$/
          );
          if (addressMatch) {
            const [, address, matchedQuery] = addressMatch;
            const queryString = matchedQuery || "";

            let amountSats = 1;
            let label = "";

            if (queryString) {
              const params = new URLSearchParams(queryString.substring(1));
              const amountParam = params.get("amount");
              const labelParam = params.get("label");

              if (amountParam) {
                amountSats =
                  Math.round(parseFloat(amountParam) * SATS_PER_BITCOIN) || 1;
              }
              if (labelParam) {
                label = decodeURIComponent(labelParam);
              }
            }

            const outcome = await commitOrPromptBitcoinUri(
              address,
              label,
              amountSats
            );
            if (outcome === "dust") {
              toast.error(t("transaction.error.dustOutputBelowLimit"));
            }
          }
        }
      } catch {
        if (addOutput) {
          addOutput({
            amount: 1,
            label: "",
            to: content.cleaned,
          });
        }

        if (account) {
          autoSelectUtxos(account, 1, actions);
        }

        navigate({
          params: { id: accountId },
          pathname: "/signer/bitcoin/account/[id]/signAndSend/ioPreview",
        });
      }
      break;
    }

    case "bitcoin_address":
      if (addOutput) {
        addOutput({
          amount: 1,
          label: "",
          to: content.cleaned,
        });
      }

      if (account) {
        autoSelectUtxos(account, 1, actions);
      }

      navigate({
        params: { id: accountId },
        pathname: "/signer/bitcoin/account/[id]/signAndSend/ioPreview",
      });
      break;
    default:
      break;
  }
}

function processLightningContent(
  content: DetectedContent,
  actions: ProcessorActions
) {
  const { navigate } = actions;

  switch (content.type) {
    case "lightning_invoice":
    case "lnurl":
      navigate({
        params: {
          invoice: content.cleaned,
          type: content.type,
        },
        pathname: "/signer/lightning/pay",
      });
      break;
    default:
      break;
  }
}

function processEcashContent(
  content: DetectedContent,
  actions: ProcessorActions
) {
  const { navigate } = actions;

  switch (content.type) {
    case "ecash_token":
      navigate({
        params: { token: content.cleaned },
        pathname: "/signer/ecash/receive",
      });
      break;

    case "lightning_invoice":
    case "lnurl":
      navigate({
        params: {
          invoice: content.cleaned,
          type: content.type,
        },
        pathname: "/signer/ecash/send",
      });
      break;
    default:
      break;
  }
}

export async function processContentByContext(
  content: DetectedContent,
  context: "bitcoin" | "lightning" | "ecash",
  actions: ProcessorActions,
  accountId?: string,
  account?: Account
): Promise<void> {
  if (!content.isValid) {
    throw new Error(t("error.invalidContentCannotBeProcessed"));
  }

  switch (context) {
    case "bitcoin":
      if (!accountId) {
        throw new Error(t("error.accountIdRequired"));
      }
      await processBitcoinContent(content, actions, accountId, account);
      break;

    case "lightning":
      processLightningContent(content, actions);
      break;

    case "ecash":
      processEcashContent(content, actions);
      break;

    default:
      throw new Error(t("error.unsupportedContext", { context }));
  }
}

export function processContentForOutput(
  content: DetectedContent,
  actions: {
    setOutputTo: (address: string) => void;
    setOutputAmount: (amount: number) => void;
    setOutputLabel: (label: string) => void;
    onError: (message: string) => void;
    onWarning: (message: string) => void;
    remainingSats?: number;
  }
) {
  if (!content.isValid) {
    actions.onError(t("error.invalidContent"));
    return false;
  }

  if (content.type === "psbt") {
    actions.onError(t("error.psbtCannotBeUsedForOutputs"));
    return false;
  }

  if (content.type === "bitcoin_address") {
    actions.setOutputTo(content.cleaned);
    actions.setOutputAmount(1);
    actions.setOutputLabel("");
    return true;
  }

  if (content.type === "bitcoin_uri") {
    try {
      let uriToDecode = content.cleaned;
      if (!uriToDecode.toLowerCase().startsWith("bitcoin:")) {
        uriToDecode = `bitcoin:${uriToDecode}`;
      }

      const parsed = parseBitcoinUri(uriToDecode);
      if (parsed.isValid && parsed.address) {
        actions.setOutputTo(parsed.address);

        if (parsed.amount !== undefined) {
          const amountInBTC = Number(parsed.amount);
          if (!isNaN(amountInBTC) && amountInBTC > 0) {
            const amountInSats = Math.round(amountInBTC * SATS_PER_BITCOIN);
            if (amountInSats > 0 && amountInSats < DUST_LIMIT) {
              actions.onError(t("transaction.error.dustOutputBelowLimit"));
              return false;
            }
            if (actions.remainingSats && amountInSats > actions.remainingSats) {
              actions.onWarning(t("error.insufficientFundsForAmount"));
            } else {
              actions.setOutputAmount(amountInSats);
            }
          } else {
            actions.setOutputAmount(1);
          }
        } else {
          actions.setOutputAmount(1);
        }

        actions.setOutputLabel(parsed.label || "");
        return true;
      }
    } catch {
      actions.onError(t("error.failedToDecodeBitcoinUri"));
      return false;
    }
  }

  actions.onError(t("error.noValidAddressFound"));
  return false;
}
