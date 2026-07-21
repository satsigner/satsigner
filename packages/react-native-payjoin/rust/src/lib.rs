mod error;
mod persist;
mod types;

pub use types::{
    ContributeResult, ExtractRequestResult, HttpResponse, PayjoinNativeRequest, ProcessResult,
    ReceiverInput, ReceiverSessionHandle, ReceiverSessionInit, SenderSessionHandle,
    SenderSessionInit
};

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use std::time::Duration;

use bitcoin::address::NetworkUnchecked;
use bitcoin::psbt::Psbt;
use bitcoin::{Address, Amount, FeeRate, OutPoint, Script, ScriptBuf, TxOut, Txid};
use once_cell::sync::Lazy;
use payjoin::persist::{NoopSessionPersister, OptionalTransitionOutcome, SessionPersister};
use payjoin::receive::v2::{
    Initialized, ProvisionalProposal, Receiver, ReceiverBuilder, SessionEvent,
    UncheckedOriginalPayload
};
use payjoin::receive::InputPair;
use payjoin::send::v1 as send_v1;
use payjoin::send::v2 as send_v2;
use payjoin::{OhttpKeys, PjParam, Uri, UriExt};
use tokio::runtime::Runtime;
use uuid::Uuid;

use crate::error::PayjoinError;
use crate::persist::MemoryPersister;

uniffi::setup_scaffolding!("satsigner_payjoin");

static RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    Runtime::new().expect("failed to create tokio runtime for payjoin")
});

type OhttpCtx = ohttp::ClientResponse;

enum ReceiverLive {
    Initialized(Receiver<Initialized>),
    Unchecked(Receiver<UncheckedOriginalPayload>),
    Provisional(Receiver<ProvisionalProposal>)
}

enum SenderLive {
    V1 {
        context: send_v1::V1Context
    },
    V2WithReply {
        sender: send_v2::Sender<send_v2::WithReplyKey>,
        ohttp_relay: String
    },
    V2Polling {
        sender: send_v2::Sender<send_v2::PollingForProposal>,
        ohttp_relay: String
    }
}

struct ReceiverEntry {
    live: ReceiverLive,
    ohttp_relay: String,
    pj_uri: String,
    receive_script: ScriptBuf,
    pending_ohttp: Option<OhttpCtx>
}

struct SenderEntry {
    live: SenderLive,
    pending_ohttp: Option<OhttpCtx>
}

static RECEIVERS: Lazy<Mutex<HashMap<String, ReceiverEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static SENDERS: Lazy<Mutex<HashMap<String, SenderEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn encode_state(role: &str, id: &str, protocol: &str) -> String {
    use base64::Engine;
    let payload = serde_json::json!({
        "id": id,
        "protocol": protocol,
        "role": role
    });
    base64::engine::general_purpose::STANDARD.encode(payload.to_string().as_bytes())
}

fn decode_state_id(state: &str) -> Result<(String, String), PayjoinError> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(state)
        .map_err(|e| PayjoinError::msg(format!("invalid state encoding: {e}")))?;
    let value: serde_json::Value = serde_json::from_slice(&bytes)?;
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| PayjoinError::msg("state missing id"))?
        .to_string();
    let protocol = value
        .get("protocol")
        .and_then(|v| v.as_str())
        .unwrap_or("v2")
        .to_string();
    Ok((id, protocol))
}

fn runtime_block_on<F: std::future::Future>(future: F) -> F::Output {
    RUNTIME.block_on(future)
}

fn noop_recv() -> NoopSessionPersister<SessionEvent> {
    NoopSessionPersister::default()
}

fn noop_send() -> NoopSessionPersister<send_v2::SessionEvent> {
    NoopSessionPersister::default()
}

fn original_psbt_from_events(events: &[SessionEvent]) -> Result<String, PayjoinError> {
    for event in events.iter().rev() {
        if let SessionEvent::RetrievedOriginalPayload { original, .. } = event {
            let value = serde_json::to_value(original)
                .map_err(|e| PayjoinError::msg(e.to_string()))?;
            if let Some(s) = value.as_str() {
                return Ok(s.to_string());
            }
            if let Some(psbt_val) = value.get("psbt") {
                if let Some(s) = psbt_val.as_str() {
                    return Ok(s.to_string());
                }
                let psbt: Psbt = serde_json::from_value(psbt_val.clone()).map_err(|e| {
                    PayjoinError::msg(format!("decode original psbt: {e}"))
                })?;
                return Ok(psbt.to_string());
            }
            // Some payloads serialize as the PSBT object at the root.
            if let Ok(psbt) = serde_json::from_value::<Psbt>(value) {
                return Ok(psbt.to_string());
            }
        }
    }
    Err(PayjoinError::msg("original psbt missing from session events"))
}

#[uniffi::export]
pub fn is_native_available() -> bool {
    true
}

/// POST via reqwest (rustls, HTTP/1.1). Prefer this over RN `fetch` for OHTTP
/// relay traffic — Android OkHttp often breaks on HTTP/2 with these relays.
#[uniffi::export]
pub fn http_post(
    url: String,
    content_type: String,
    body: Vec<u8>,
    timeout_ms: u64
) -> Result<HttpResponse, PayjoinError> {
    let timeout = Duration::from_millis(timeout_ms.max(1_000));
    let client = reqwest::blocking::Client::builder()
        .timeout(timeout)
        .http1_only()
        .build()
        .map_err(|e| PayjoinError::msg(format!("http client: {e}")))?;

    let response = client
        .post(&url)
        .header("Content-Type", content_type)
        .body(body)
        .send()
        .map_err(|e| PayjoinError::msg(format!("fetch failed: {e}")))?;

    let status = response.status().as_u16();
    let body = response
        .bytes()
        .map_err(|e| PayjoinError::msg(format!("read body: {e}")))?
        .to_vec();
    Ok(HttpResponse { status, body })
}

#[uniffi::export]
pub fn fetch_ohttp_keys(relay_url: String, directory_url: String) -> Result<String, PayjoinError> {
    let keys: OhttpKeys =
        runtime_block_on(payjoin::io::fetch_ohttp_keys(&relay_url, &directory_url))?;
    Ok(keys.to_string())
}

#[uniffi::export]
pub fn create_receiver_session(
    init: ReceiverSessionInit
) -> Result<ReceiverSessionHandle, PayjoinError> {
    let ohttp_keys = runtime_block_on(payjoin::io::fetch_ohttp_keys(
        &init.ohttp_relay_url,
        &init.directory_url
    ))?;

    let address: Address<NetworkUnchecked> = Address::from_str(&init.address)?;
    let address = address.assume_checked();
    let receive_script = address.script_pubkey();

    let builder = ReceiverBuilder::new(address, &init.directory_url, ohttp_keys)
        .map_err(|e| PayjoinError::msg(e.to_string()))?
        .with_expiration(Duration::from_secs(init.expire_seconds.max(60)));

    let receiver = builder
        .build()
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let pj_uri = receiver.pj_uri().to_string();
    let id = Uuid::new_v4().to_string();
    let state = encode_state("receiver", &id, "v2");

    RECEIVERS.lock().expect("receivers lock").insert(
        id.clone(),
        ReceiverEntry {
            live: ReceiverLive::Initialized(receiver),
            ohttp_relay: init.ohttp_relay_url,
            pj_uri: pj_uri.clone(),
            receive_script,
            pending_ohttp: None
        }
    );

    Ok(ReceiverSessionHandle {
        id,
        pj_uri,
        state
    })
}

#[uniffi::export]
pub fn resume_receiver_session(state: String) -> Result<ReceiverSessionHandle, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let receivers = RECEIVERS.lock().expect("receivers lock");
    let entry = receivers
        .get(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found in memory; recreate it"))?;

    Ok(ReceiverSessionHandle {
        id,
        pj_uri: entry.pj_uri.clone(),
        state
    })
}

#[uniffi::export]
pub fn receiver_extract_request(state: String) -> Result<ExtractRequestResult, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let mut receivers = RECEIVERS.lock().expect("receivers lock");
    let entry = receivers
        .get_mut(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found"))?;

    let ReceiverLive::Initialized(receiver) = &entry.live else {
        return Err(PayjoinError::msg(
            "receiver already has a proposal; finalize instead of polling"
        ));
    };

    let (request, ohttp_ctx) = receiver
        .create_poll_request(&entry.ohttp_relay)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;
    entry.pending_ohttp = Some(ohttp_ctx);

    Ok(ExtractRequestResult {
        request: request.into(),
        state
    })
}

#[uniffi::export]
pub fn receiver_process_response(
    state: String,
    body: Vec<u8>
) -> Result<ProcessResult, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let mut receivers = RECEIVERS.lock().expect("receivers lock");
    let mut entry = receivers
        .remove(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found"))?;

    let ohttp_ctx = entry
        .pending_ohttp
        .take()
        .ok_or_else(|| PayjoinError::msg("missing ohttp context; call extract first"))?;

    let ReceiverLive::Initialized(receiver) = entry.live else {
        receivers.insert(id, entry);
        return Ok(ProcessResult::Error {
            message: "receiver already has unchecked proposal".into()
        });
    };

    let persister = MemoryPersister::<SessionEvent>::new();
    match receiver.process_response(&body, ohttp_ctx).save(&persister) {
        Ok(OptionalTransitionOutcome::Progress(next)) => {
            let events: Vec<SessionEvent> = persister
                .load()
                .map_err(|e| PayjoinError::msg(e.to_string()))?
                .collect();
            match original_psbt_from_events(&events) {
                Ok(psbt_base64) => {
                    entry.live = ReceiverLive::Unchecked(next);
                    receivers.insert(id, entry);
                    Ok(ProcessResult::Proposal {
                        psbt_base64,
                        state
                    })
                }
                Err(error) => {
                    // Keep the session alive — dropping it forced the app into a
                    // recreate loop and invalidated the QR the sender already has.
                    entry.live = ReceiverLive::Unchecked(next);
                    receivers.insert(id, entry);
                    Ok(ProcessResult::Error {
                        message: error.to_string()
                    })
                }
            }
        }
        Ok(OptionalTransitionOutcome::Stasis(same)) => {
            entry.live = ReceiverLive::Initialized(same);
            receivers.insert(id, entry);
            Ok(ProcessResult::Pending {
                next_request: None,
                state
            })
        }
        Err(error) => Ok(ProcessResult::Error {
            message: error.to_string()
        })
    }
}

#[uniffi::export]
pub fn receiver_contribute_and_finalize(
    state: String,
    input: ReceiverInput,
    signed_psbt_base64: String
) -> Result<ContributeResult, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let mut receivers = RECEIVERS.lock().expect("receivers lock");
    let mut entry = receivers
        .remove(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found"))?;
    let ohttp_relay = entry.ohttp_relay.clone();
    let receive_script = entry.receive_script.clone();

    // Second call: finalize + build directory POST from a provisional proposal.
    if !signed_psbt_base64.is_empty() {
        let ReceiverLive::Provisional(provisional) = entry.live else {
            return Err(PayjoinError::msg(
                "expected provisional proposal; call contribute with empty signed first"
            ));
        };
        let signed_psbt = Psbt::from_str(&signed_psbt_base64)?;
        let proposal = provisional
            .finalize_proposal(|cleared| {
                // Start from cleared (sender finals removed). Apply finals only for
                // inputs the wallet finalized that still lack finals on `cleared`.
                let mut merged = cleared.clone();
                for i in 0..merged.inputs.len() {
                    if merged.inputs[i].final_script_witness.is_some()
                        || merged.inputs[i].final_script_sig.is_some()
                        || merged.inputs[i].tap_key_sig.is_some()
                    {
                        continue;
                    }
                    let Some(signed_in) = signed_psbt.inputs.get(i) else {
                        continue;
                    };
                    if signed_in.final_script_witness.is_none()
                        && signed_in.final_script_sig.is_none()
                        && signed_in.tap_key_sig.is_none()
                    {
                        continue;
                    }
                    merged.inputs[i].final_script_witness =
                        signed_in.final_script_witness.clone();
                    merged.inputs[i].final_script_sig = signed_in.final_script_sig.clone();
                    merged.inputs[i].tap_key_sig = signed_in.tap_key_sig.clone();
                }
                Ok(merged)
            })
            .save(&noop_recv())
            .map_err(|e| PayjoinError::msg(e.to_string()))?;
        let psbt_base64 = proposal.psbt().to_string();
        let (request, _ohttp_ctx) = proposal
            .create_post_request(&ohttp_relay)
            .map_err(|e| PayjoinError::msg(e.to_string()))?;
        return Ok(ContributeResult {
            request: request.into(),
            state,
            psbt_base64
        });
    }

    let ReceiverLive::Unchecked(unchecked) = entry.live else {
        return Err(PayjoinError::msg(
            "no original proposal to contribute to; poll first"
        ));
    };

    let maybe_owned = unchecked
        .assume_interactive_receiver()
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let mut is_owned = |_script: &Script| Ok(false);
    let maybe_seen = maybe_owned
        .check_inputs_not_owned(&mut is_owned)
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let mut is_known = |_outpoint: &OutPoint| Ok(false);
    let outputs_unknown = maybe_seen
        .check_no_inputs_seen_before(&mut is_known)
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let mut is_receiver_output =
        |script: &Script| Ok(script == receive_script.as_script());
    let wants_outputs = outputs_unknown
        .identify_receiver_outputs(&mut is_receiver_output)
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let wants_inputs = wants_outputs
        .commit_outputs()
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let txid = Txid::from_str(&input.txid).map_err(|e| PayjoinError::msg(e.to_string()))?;
    let script = ScriptBuf::from_hex(&input.script_hex)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;
    let txout = TxOut {
        value: Amount::from_sat(input.value),
        script_pubkey: script
    };
    let outpoint = OutPoint {
        txid,
        vout: input.vout
    };
    let input_pair = input_pair_from_txout(txout, outpoint)?;

    let wants_inputs = wants_inputs
        .contribute_inputs(vec![input_pair])
        .map_err(|e| PayjoinError::msg(e.to_string()))?;
    let wants_fee_range = wants_inputs
        .commit_inputs()
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let provisional = wants_fee_range
        .apply_fee_range(None, None)
        .save(&noop_recv())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let psbt_base64 = provisional.psbt_to_sign().to_string();
    entry.live = ReceiverLive::Provisional(provisional);
    receivers.insert(id, entry);

    Ok(ContributeResult {
        request: PayjoinNativeRequest {
            url: String::new(),
            body: Vec::new(),
            content_type: "application/octet-stream".into()
        },
        state,
        psbt_base64
    })
}

fn input_pair_from_txout(txout: TxOut, outpoint: OutPoint) -> Result<InputPair, PayjoinError> {
    if txout.script_pubkey.is_p2wpkh() {
        return InputPair::new_p2wpkh(txout, outpoint).map_err(|e| PayjoinError::msg(e.to_string()));
    }
    if txout.script_pubkey.is_p2tr() {
        return InputPair::new_p2tr_keyspend(txout, outpoint)
            .map_err(|e| PayjoinError::msg(e.to_string()));
    }
    Err(PayjoinError::msg(
        "unsupported script type for payjoin contribution; need p2wpkh or p2tr"
    ))
}

#[uniffi::export]
pub fn create_sender_session(
    init: SenderSessionInit
) -> Result<SenderSessionHandle, PayjoinError> {
    let psbt = Psbt::from_str(&init.original_psbt_base64)?;
    let uri = Uri::try_from(init.pj_uri.as_str())
        .map_err(|e| PayjoinError::msg(e.to_string()))?
        .assume_checked()
        .check_pj_supported()
        .map_err(|_| PayjoinError::msg("URI does not support payjoin"))?;

    let is_v2 = matches!(uri.extras.pj_param(), PjParam::V2(_));
    let id = Uuid::new_v4().to_string();
    let ohttp_relay = DEFAULT_OHTTP_RELAY.to_string();

    if is_v2 {
        let mut builder = send_v2::SenderBuilder::new(psbt, uri);
        if init.disable_output_substitution {
            builder = builder.always_disable_output_substitution();
        }
        let sender = builder
            .build_recommended(FeeRate::BROADCAST_MIN)
            .map_err(|e| PayjoinError::msg(e.to_string()))?
            .save(&noop_send())
            .map_err(|e| PayjoinError::msg(e.to_string()))?;

        let state = encode_state("sender", &id, "v2");
        let (request, ohttp_ctx) = sender
            .create_v2_post_request(&ohttp_relay)
            .map_err(|e| PayjoinError::msg(e.to_string()))?;

        SENDERS.lock().expect("senders lock").insert(
            id.clone(),
            SenderEntry {
                live: SenderLive::V2WithReply {
                    sender,
                    ohttp_relay
                },
                pending_ohttp: Some(ohttp_ctx)
            }
        );

        return Ok(SenderSessionHandle {
            id,
            protocol: "v2".into(),
            state,
            request: Some(request.into())
        });
    }

    let mut builder = send_v1::SenderBuilder::new(psbt, uri);
    if init.disable_output_substitution {
        builder = builder.always_disable_output_substitution();
    }
    let sender = builder
        .build_recommended(FeeRate::BROADCAST_MIN)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;
    let (request, context) = sender.create_v1_post_request();
    let state = encode_state("sender", &id, "v1");

    SENDERS.lock().expect("senders lock").insert(
        id.clone(),
        SenderEntry {
            live: SenderLive::V1 { context },
            pending_ohttp: None
        }
    );

    Ok(SenderSessionHandle {
        id,
        protocol: "v1".into(),
        state,
        request: Some(request.into())
    })
}

const DEFAULT_OHTTP_RELAY: &str = "https://pj.bobspacebkk.com";

#[uniffi::export]
pub fn resume_sender_session(state: String) -> Result<SenderSessionHandle, PayjoinError> {
    let (id, protocol) = decode_state_id(&state)?;
    let senders = SENDERS.lock().expect("senders lock");
    if !senders.contains_key(&id) {
        return Err(PayjoinError::msg("sender session not found in memory"));
    }
    Ok(SenderSessionHandle {
        id,
        protocol,
        state,
        request: None
    })
}

#[uniffi::export]
pub fn sender_extract_request(state: String) -> Result<ExtractRequestResult, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let mut senders = SENDERS.lock().expect("senders lock");
    let entry = senders
        .get_mut(&id)
        .ok_or_else(|| PayjoinError::msg("sender session not found"))?;

    match &entry.live {
        SenderLive::V2Polling { sender, ohttp_relay } => {
            let (request, ohttp_ctx) = sender
                .create_poll_request(ohttp_relay)
                .map_err(|e| PayjoinError::msg(e.to_string()))?;
            entry.pending_ohttp = Some(ohttp_ctx);
            Ok(ExtractRequestResult {
                request: request.into(),
                state
            })
        }
        SenderLive::V2WithReply { sender, ohttp_relay } => {
            let (request, ohttp_ctx) = sender
                .create_v2_post_request(ohttp_relay)
                .map_err(|e| PayjoinError::msg(e.to_string()))?;
            entry.pending_ohttp = Some(ohttp_ctx);
            Ok(ExtractRequestResult {
                request: request.into(),
                state
            })
        }
        SenderLive::V1 { .. } => Err(PayjoinError::msg(
            "BIP78 sender has no poll request; use the initial request"
        ))
    }
}

#[uniffi::export]
pub fn sender_process_response(
    state: String,
    body: Vec<u8>
) -> Result<ProcessResult, PayjoinError> {
    let (id, _) = decode_state_id(&state)?;
    let mut senders = SENDERS.lock().expect("senders lock");
    let entry = senders
        .remove(&id)
        .ok_or_else(|| PayjoinError::msg("sender session not found"))?;

    match entry.live {
        SenderLive::V1 { context } => match context.process_response(&body) {
            Ok(psbt) => Ok(ProcessResult::Proposal {
                psbt_base64: psbt.to_string(),
                state
            }),
            Err(error) => Ok(ProcessResult::Error {
                message: error.to_string()
            })
        },
        SenderLive::V2WithReply {
            sender,
            ohttp_relay
        } => {
            let ohttp_ctx = entry
                .pending_ohttp
                .ok_or_else(|| PayjoinError::msg("missing ohttp context"))?;
            match sender.process_response(&body, ohttp_ctx).save(&noop_send()) {
                Ok(next) => {
                    senders.insert(
                        id,
                        SenderEntry {
                            live: SenderLive::V2Polling {
                                sender: next,
                                ohttp_relay
                            },
                            pending_ohttp: None
                        }
                    );
                    Ok(ProcessResult::Pending {
                        next_request: None,
                        state
                    })
                }
                Err(error) => Ok(ProcessResult::Error {
                    message: error.to_string()
                })
            }
        }
        SenderLive::V2Polling {
            sender,
            ohttp_relay
        } => {
            let ohttp_ctx = entry
                .pending_ohttp
                .ok_or_else(|| PayjoinError::msg("missing ohttp context"))?;
            match sender.process_response(&body, ohttp_ctx).save(&noop_send()) {
                Ok(OptionalTransitionOutcome::Progress(psbt)) => Ok(ProcessResult::Proposal {
                    psbt_base64: psbt.to_string(),
                    state
                }),
                Ok(OptionalTransitionOutcome::Stasis(same)) => {
                    senders.insert(
                        id,
                        SenderEntry {
                            live: SenderLive::V2Polling {
                                sender: same,
                                ohttp_relay
                            },
                            pending_ohttp: None
                        }
                    );
                    Ok(ProcessResult::Pending {
                        next_request: None,
                        state
                    })
                }
                Err(error) => Ok(ProcessResult::Error {
                    message: error.to_string()
                })
            }
        }
    }
}
