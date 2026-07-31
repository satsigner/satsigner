mod error;
mod persist;
mod types;

pub use types::{
    ContributeResult, ExtractRequestResult, HttpResponse, ManualContributeResult,
    ManualFinalizeResult, PayjoinNativeRequest, ProcessResult, ReceiverInput,
    ReceiverSessionHandle, ReceiverSessionInit, SenderSessionHandle, SenderSessionInit
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
use payjoin::receive::v1;
use payjoin::receive::v2::{
    replay_event_log, Initialized, ProvisionalProposal, ReceiveSession, Receiver,
    ReceiverBuilder, SessionEvent, UncheckedOriginalPayload
};
use payjoin::receive::InputPair;
use payjoin::send::v1 as send_v1;
use payjoin::send::v2::{
    self as send_v2, replay_event_log as replay_send_event_log, SendSession,
    SessionEvent as SendSessionEvent
};
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
    pending_ohttp: Option<OhttpCtx>,
    /// PDK event log — serialized into `nativeState` so resume works after
    /// process death (the in-memory RECEIVERS map is empty then).
    events: Vec<SessionEvent>
}

struct SenderEntry {
    live: SenderLive,
    pending_ohttp: Option<OhttpCtx>,
    /// PDK sender event log — serialized into `nativeState` so resume works
    /// after process death (the in-memory SENDERS map is empty then).
    events: Vec<SendSessionEvent>,
    ohttp_relay: String
}

static RECEIVERS: Lazy<Mutex<HashMap<String, ReceiverEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static SENDERS: Lazy<Mutex<HashMap<String, SenderEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
/// Last relay passed to `fetch_ohttp_keys`. JS shuffles relays and calls that
/// before `create_sender_session`; without this, send always hardcoded
/// `DEFAULT_OHTTP_RELAY` and ignored the JS loop (hung posts / empty mailbox).
static NEXT_SENDER_OHTTP_RELAY: Lazy<Mutex<Option<String>>> =
    Lazy::new(|| Mutex::new(None));

fn encode_state(role: &str, id: &str, protocol: &str) -> String {
    use base64::Engine;
    let payload = serde_json::json!({
        "id": id,
        "protocol": protocol,
        "role": role
    });
    base64::engine::general_purpose::STANDARD.encode(payload.to_string().as_bytes())
}

fn encode_receiver_state(
    id: &str,
    ohttp_relay: &str,
    pj_uri: &str,
    receive_script_hex: &str,
    events: &[SessionEvent]
) -> Result<String, PayjoinError> {
    use base64::Engine;
    let events_json = serde_json::to_value(events)
        .map_err(|e| PayjoinError::msg(format!("encode receiver events: {e}")))?;
    let payload = serde_json::json!({
        "events": events_json,
        "id": id,
        "ohttp_relay": ohttp_relay,
        "pj_uri": pj_uri,
        "protocol": "v2",
        "receive_script_hex": receive_script_hex,
        "role": "receiver"
    });
    Ok(base64::engine::general_purpose::STANDARD.encode(payload.to_string().as_bytes()))
}

type DecodedReceiverState = (String, String, String, ScriptBuf, Vec<SessionEvent>);

fn decode_receiver_state(state: &str) -> Result<DecodedReceiverState, PayjoinError> {
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
    let ohttp_relay = value
        .get("ohttp_relay")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let pj_uri = value
        .get("pj_uri")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let receive_script = match value.get("receive_script_hex").and_then(|v| v.as_str()) {
        Some(hex) => ScriptBuf::from_hex(hex)
            .map_err(|e| PayjoinError::msg(format!("decode receive script: {e}")))?,
        None => ScriptBuf::new()
    };
    let events = match value.get("events") {
        Some(events_val) => serde_json::from_value(events_val.clone())
            .map_err(|e| PayjoinError::msg(format!("decode receiver events: {e}")))?,
        None => Vec::new()
    };
    Ok((id, ohttp_relay, pj_uri, receive_script, events))
}

fn entry_state(id: &str, entry: &ReceiverEntry) -> Result<String, PayjoinError> {
    encode_receiver_state(
        id,
        &entry.ohttp_relay,
        &entry.pj_uri,
        &hex::encode(entry.receive_script.as_bytes()),
        &entry.events
    )
}

fn live_from_receive_session(session: ReceiveSession) -> Result<ReceiverLive, PayjoinError> {
    match session {
        ReceiveSession::Initialized(receiver) => Ok(ReceiverLive::Initialized(receiver)),
        ReceiveSession::UncheckedOriginalPayload(receiver) => {
            Ok(ReceiverLive::Unchecked(receiver))
        }
        ReceiveSession::ProvisionalProposal(receiver) => Ok(ReceiverLive::Provisional(receiver)),
        _ => Err(PayjoinError::msg(
            "unsupported receiver resume state after replay"
        ))
    }
}

fn rehydrate_receiver_entry(
    ohttp_relay: String,
    pj_uri: String,
    receive_script: ScriptBuf,
    events: Vec<SessionEvent>
) -> Result<ReceiverEntry, PayjoinError> {
    if events.is_empty() {
        return Err(PayjoinError::msg(
            "receiver session not found in memory; recreate it"
        ));
    }
    let persister = MemoryPersister::from_events(events.clone());
    let (session, _history) = replay_event_log(&persister)
        .map_err(|e| PayjoinError::msg(format!("receiver replay failed: {e}")))?;
    Ok(ReceiverEntry {
        events,
        live: live_from_receive_session(session)?,
        ohttp_relay,
        pending_ohttp: None,
        pj_uri,
        receive_script
    })
}

fn runtime_block_on<F: std::future::Future>(future: F) -> F::Output {
    RUNTIME.block_on(future)
}

fn noop_recv() -> NoopSessionPersister<SessionEvent> {
    NoopSessionPersister::default()
}

fn encode_sender_state(
    id: &str,
    protocol: &str,
    ohttp_relay: &str,
    events: &[SendSessionEvent]
) -> Result<String, PayjoinError> {
    use base64::Engine;
    // Persist events as a JSON *string* so the parent object never goes through
    // serde_json::Value round-trips that break empty-tuple SessionEvents.
    let events_str = serde_json::to_string(events)
        .map_err(|e| PayjoinError::msg(format!("encode sender events: {e}")))?;
    let payload = serde_json::json!({
        "events_json": events_str,
        "id": id,
        "ohttp_relay": ohttp_relay,
        "protocol": protocol,
        "role": "sender"
    });
    Ok(base64::engine::general_purpose::STANDARD.encode(payload.to_string().as_bytes()))
}

type DecodedSenderState = (String, String, String, Vec<SendSessionEvent>);

/// `SessionEvent::PostedOriginalPsbt()` is an empty tuple variant. Some
/// serde_json paths emit `null` instead of `[]`; normalize before decode.
fn normalize_send_events_json(events_val: &mut serde_json::Value) {
    let Some(arr) = events_val.as_array_mut() else {
        return;
    };
    for event in arr {
        let Some(obj) = event.as_object_mut() else {
            continue;
        };
        if let Some(payload) = obj.get_mut("PostedOriginalPsbt") {
            if payload.is_null() {
                *payload = serde_json::json!([]);
            }
        }
    }
}

fn deserialize_send_events(
    mut events_val: serde_json::Value
) -> Result<Vec<SendSessionEvent>, PayjoinError> {
    normalize_send_events_json(&mut events_val);
    // `from_value` mishandles empty-tuple variants (`PostedOriginalPsbt()`).
    serde_json::from_str(&events_val.to_string())
        .map_err(|e| PayjoinError::msg(format!("decode sender events: {e}")))
}

fn decode_sender_id_protocol(state: &str) -> Result<(String, String), PayjoinError> {
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

fn decode_sender_state(state: &str) -> Result<DecodedSenderState, PayjoinError> {
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
    let ohttp_relay = value
        .get("ohttp_relay")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let events = if let Some(events_str) = value.get("events_json").and_then(|v| v.as_str()) {
        let mut parsed: serde_json::Value = serde_json::from_str(events_str)
            .map_err(|e| PayjoinError::msg(format!("decode sender events_json: {e}")))?;
        normalize_send_events_json(&mut parsed);
        serde_json::from_str(&parsed.to_string())
            .map_err(|e| PayjoinError::msg(format!("decode sender events: {e}")))?
    } else if let Some(events_val) = value.get("events") {
        // Legacy nested-array form from the first durable-sender build.
        deserialize_send_events(events_val.clone())?
    } else {
        Vec::new()
    };
    Ok((id, protocol, ohttp_relay, events))
}

fn sender_entry_state(id: &str, protocol: &str, entry: &SenderEntry) -> Result<String, PayjoinError> {
    encode_sender_state(id, protocol, &entry.ohttp_relay, &entry.events)
}

fn live_from_send_session(
    session: SendSession,
    ohttp_relay: String
) -> Result<SenderLive, PayjoinError> {
    match session {
        SendSession::WithReplyKey(sender) => Ok(SenderLive::V2WithReply {
            sender,
            ohttp_relay
        }),
        SendSession::PollingForProposal(sender) => Ok(SenderLive::V2Polling {
            sender,
            ohttp_relay
        }),
        _ => Err(PayjoinError::msg(
            "unsupported sender resume state after replay"
        ))
    }
}

fn rehydrate_sender_entry(
    ohttp_relay: String,
    events: Vec<SendSessionEvent>
) -> Result<SenderEntry, PayjoinError> {
    if events.is_empty() {
        return Err(PayjoinError::msg(
            "sender session not found in memory; recreate it"
        ));
    }
    let persister = MemoryPersister::from_events(events.clone());
    let (session, _history) = replay_send_event_log(&persister)
        .map_err(|e| PayjoinError::msg(format!("sender replay failed: {e}")))?;
    Ok(SenderEntry {
        events,
        live: live_from_send_session(session, ohttp_relay.clone())?,
        ohttp_relay,
        pending_ohttp: None
    })
}

fn ensure_sender_in_memory(state: &str) -> Result<(String, String), PayjoinError> {
    // Prefer id-only lookup so an in-memory session survives even if the
    // persisted event JSON still has the PostedOriginalPsbt null quirk.
    let (id, protocol) = decode_sender_id_protocol(state)?;
    {
        let senders = SENDERS.lock().expect("senders lock");
        if senders.contains_key(&id) {
            return Ok((id, protocol));
        }
    }
    if protocol != "v2" {
        return Err(PayjoinError::msg("sender session not found in memory"));
    }
    let (_, _, ohttp_relay, events) = decode_sender_state(state)?;
    let entry = rehydrate_sender_entry(ohttp_relay, events)?;
    SENDERS
        .lock()
        .expect("senders lock")
        .insert(id.clone(), entry);
    Ok((id, protocol))
}

fn append_send_events(
    entry: &mut SenderEntry,
    persister: &MemoryPersister<SendSessionEvent>
) -> Result<(), PayjoinError> {
    let new_events: Vec<SendSessionEvent> = persister
        .load()
        .map_err(|e| PayjoinError::msg(e.to_string()))?
        .collect();
    entry.events.extend(new_events);
    Ok(())
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
///
/// Async so UniFFI does not block the JS thread for the whole round trip
/// (sync `reqwest::blocking` froze receive-screen buttons while scroll still worked).
#[uniffi::export]
pub async fn http_post(
    url: String,
    content_type: String,
    body: Vec<u8>,
    timeout_ms: u64
) -> Result<HttpResponse, PayjoinError> {
    let timeout = Duration::from_millis(timeout_ms.max(1_000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .http1_only()
        .build()
        .map_err(|e| PayjoinError::msg(format!("http client: {e}")))?;

    let response = client
        .post(&url)
        .header("Content-Type", content_type)
        .body(body)
        .send()
        .await
        .map_err(|e| PayjoinError::msg(format!("fetch failed: {e}")))?;

    let status = response.status().as_u16();
    let body = response
        .bytes()
        .await
        .map_err(|e| PayjoinError::msg(format!("read body: {e}")))?
        .to_vec();
    Ok(HttpResponse { status, body })
}

#[uniffi::export]
pub fn fetch_ohttp_keys(relay_url: String, directory_url: String) -> Result<String, PayjoinError> {
    *NEXT_SENDER_OHTTP_RELAY
        .lock()
        .expect("sender relay lock") = Some(relay_url.clone());
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

    let persister = MemoryPersister::<SessionEvent>::new();
    let receiver = builder
        .build()
        .save(&persister)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let events: Vec<SessionEvent> = persister
        .load()
        .map_err(|e| PayjoinError::msg(e.to_string()))?
        .collect();
    let pj_uri = receiver.pj_uri().to_string();
    let id = Uuid::new_v4().to_string();
    let state = encode_receiver_state(
        &id,
        &init.ohttp_relay_url,
        &pj_uri,
        &hex::encode(receive_script.as_bytes()),
        &events
    )?;

    RECEIVERS.lock().expect("receivers lock").insert(
        id.clone(),
        ReceiverEntry {
            events,
            live: ReceiverLive::Initialized(receiver),
            ohttp_relay: init.ohttp_relay_url,
            pending_ohttp: None,
            pj_uri: pj_uri.clone(),
            receive_script
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
    let (id, ohttp_relay, pj_uri, receive_script, events) = decode_receiver_state(&state)?;
    {
        let receivers = RECEIVERS.lock().expect("receivers lock");
        if let Some(entry) = receivers.get(&id) {
            let next_state = entry_state(&id, entry).unwrap_or_else(|_| state.clone());
            return Ok(ReceiverSessionHandle {
                id,
                pj_uri: entry.pj_uri.clone(),
                state: next_state
            });
        }
    }

    let entry = rehydrate_receiver_entry(ohttp_relay, pj_uri, receive_script, events)?;
    let handle = ReceiverSessionHandle {
        id: id.clone(),
        pj_uri: entry.pj_uri.clone(),
        state: entry_state(&id, &entry)?
    };
    RECEIVERS
        .lock()
        .expect("receivers lock")
        .insert(id, entry);
    Ok(handle)
}

fn ensure_receiver_in_memory(state: &str) -> Result<String, PayjoinError> {
    let (id, ohttp_relay, pj_uri, receive_script, events) = decode_receiver_state(state)?;
    {
        let receivers = RECEIVERS.lock().expect("receivers lock");
        if receivers.contains_key(&id) {
            return Ok(id);
        }
    }
    let entry = rehydrate_receiver_entry(ohttp_relay, pj_uri, receive_script, events)?;
    RECEIVERS
        .lock()
        .expect("receivers lock")
        .insert(id.clone(), entry);
    Ok(id)
}

#[uniffi::export]
pub fn receiver_extract_request(state: String) -> Result<ExtractRequestResult, PayjoinError> {
    let id = ensure_receiver_in_memory(&state)?;
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
    let next_state = entry_state(&id, entry)?;

    Ok(ExtractRequestResult {
        request: request.into(),
        state: next_state
    })
}

#[uniffi::export]
pub fn receiver_process_response(
    state: String,
    body: Vec<u8>
) -> Result<ProcessResult, PayjoinError> {
    let id = ensure_receiver_in_memory(&state)?;
    let mut receivers = RECEIVERS.lock().expect("receivers lock");
    let mut entry = receivers
        .remove(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found"))?;

    let Some(ohttp_ctx) = entry.pending_ohttp.take() else {
        receivers.insert(id, entry);
        return Err(PayjoinError::msg("missing ohttp context; call extract first"));
    };

    let ReceiverLive::Initialized(receiver) = entry.live else {
        receivers.insert(id, entry);
        return Ok(ProcessResult::Error {
            message: "receiver already has unchecked proposal".into()
        });
    };

    // PDK's process_response consumes `self`. Transient/fatal directory errors
    // (e.g. OHTTP AEAD) do not return the Initialized receiver — without this
    // clone the mailbox handle is dropped and the next poll is "session not
    // found", which used to mint a new QR and orphan the sender.
    let receiver_backup = receiver.clone();
    let persister = MemoryPersister::<SessionEvent>::new();
    match receiver.process_response(&body, ohttp_ctx).save(&persister) {
        Ok(OptionalTransitionOutcome::Progress(next)) => {
            let new_events: Vec<SessionEvent> = persister
                .load()
                .map_err(|e| PayjoinError::msg(e.to_string()))?
                .collect();
            entry.events.extend(new_events);
            let events_snapshot = entry.events.clone();
            match original_psbt_from_events(&events_snapshot) {
                Ok(psbt_base64) => {
                    entry.live = ReceiverLive::Unchecked(next);
                    let next_state = entry_state(&id, &entry)?;
                    receivers.insert(id, entry);
                    Ok(ProcessResult::Proposal {
                        psbt_base64,
                        state: next_state
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
            let new_events: Vec<SessionEvent> = persister
                .load()
                .map_err(|e| PayjoinError::msg(e.to_string()))?
                .collect();
            entry.events.extend(new_events);
            entry.live = ReceiverLive::Initialized(same);
            let next_state = entry_state(&id, &entry)?;
            receivers.insert(id, entry);
            Ok(ProcessResult::Pending {
                next_request: None,
                state: next_state
            })
        }
        Err(error) => {
            entry.live = ReceiverLive::Initialized(receiver_backup);
            entry.pending_ohttp = None;
            receivers.insert(id, entry);
            Ok(ProcessResult::Error {
                message: error.to_string()
            })
        }
    }
}

#[uniffi::export]
pub fn receiver_contribute_and_finalize(
    state: String,
    input: ReceiverInput,
    signed_psbt_base64: String
) -> Result<ContributeResult, PayjoinError> {
    let id = ensure_receiver_in_memory(&state)?;
    let mut receivers = RECEIVERS.lock().expect("receivers lock");
    let mut entry = receivers
        .remove(&id)
        .ok_or_else(|| PayjoinError::msg("receiver session not found"))?;
    let ohttp_relay = entry.ohttp_relay.clone();
    let receive_script = entry.receive_script.clone();

    // Second call: finalize + build directory POST from a provisional proposal.
    if !signed_psbt_base64.is_empty() {
        let next_state = entry_state(&id, &entry).unwrap_or_else(|_| state.clone());
        let ReceiverLive::Provisional(provisional) = entry.live else {
            receivers.insert(id, entry);
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
        // Proposal consumed into the directory POST — do not re-insert. JS must
        // deliver `request` successfully before treating the receive as done.
        return Ok(ContributeResult {
            request: request.into(),
            state: next_state,
            psbt_base64
        });
    }

    let ReceiverLive::Unchecked(unchecked) = entry.live else {
        receivers.insert(id, entry);
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
    let next_state = entry_state(&id, &entry)?;
    receivers.insert(id, entry);

    Ok(ContributeResult {
        request: PayjoinNativeRequest {
            url: String::new(),
            body: Vec::new(),
            content_type: "application/octet-stream".into()
        },
        state: next_state,
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

/// Minimal BIP78 request headers for the manual (offline) receiver. The original
/// PSBT arrives out of band, so we synthesize the headers PDK expects.
struct ManualHeaders {
    content_length: String
}

impl v1::Headers for ManualHeaders {
    fn get_header(&self, key: &str) -> Option<&str> {
        match key {
            "content-length" => Some(self.content_length.as_str()),
            "content-type" => Some("text/plain"),
            _ => None
        }
    }
}

fn encode_provisional_state(
    provisional: &v1::ProvisionalProposal
) -> Result<String, PayjoinError> {
    use base64::Engine;
    let json = serde_json::to_string(provisional)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(json.as_bytes()))
}

fn decode_provisional_state(state: &str) -> Result<v1::ProvisionalProposal, PayjoinError> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(state.as_bytes())
        .map_err(|e| PayjoinError::msg(e.to_string()))?;
    let provisional = serde_json::from_slice::<v1::ProvisionalProposal>(&bytes)?;
    Ok(provisional)
}

/// Manual (offline) receiver step 1: ingest the sender's original PSBT, run the
/// BIP78 receiver checks with real ownership/seen-input guards, contribute one
/// input, and return the provisional proposal PSBT for the receiver to sign.
/// No directory request is created.
#[uniffi::export]
pub fn receiver_manual_contribute(
    original_psbt_base64: String,
    receive_address: String,
    disable_output_substitution: bool,
    input: ReceiverInput,
    owned_scripts_hex: Vec<String>,
    seen_outpoints: Vec<String>
) -> Result<ManualContributeResult, PayjoinError> {
    let body_string = original_psbt_base64.trim().to_string();
    let body = body_string.as_bytes();
    let headers = ManualHeaders {
        content_length: body.len().to_string()
    };
    let query = if disable_output_substitution {
        "v=1&disableoutputsubstitution=true"
    } else {
        "v=1"
    };

    let unchecked = v1::UncheckedOriginalPayload::from_request(body, query, headers)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    // Interactive receiver: the receiver manually imports the original, so the
    // anti-probing broadcast-suitability check is unnecessary.
    let maybe_owned = unchecked.assume_interactive_receiver();

    let owned_set: std::collections::HashSet<ScriptBuf> = owned_scripts_hex
        .iter()
        .filter_map(|hex| ScriptBuf::from_hex(hex).ok())
        .collect();
    let mut is_owned = |script: &Script| Ok(owned_set.contains(script));
    let maybe_seen = maybe_owned
        .check_inputs_not_owned(&mut is_owned)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let seen_set: std::collections::HashSet<OutPoint> = seen_outpoints
        .iter()
        .filter_map(|outpoint| OutPoint::from_str(outpoint).ok())
        .collect();
    let mut is_known = |outpoint: &OutPoint| Ok(seen_set.contains(outpoint));
    let outputs_unknown = maybe_seen
        .check_no_inputs_seen_before(&mut is_known)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let address = Address::from_str(&receive_address)?.assume_checked();
    let receive_script = address.script_pubkey();
    let mut is_receiver_output = |script: &Script| Ok(script == receive_script.as_script());
    let wants_outputs = outputs_unknown
        .identify_receiver_outputs(&mut is_receiver_output)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let wants_inputs = wants_outputs.commit_outputs();

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
    let wants_fee_range = wants_inputs.commit_inputs();

    let provisional = wants_fee_range
        .apply_fee_range(None, None)
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let provisional_psbt_base64 = provisional.psbt_to_sign().to_string();
    let provisional_state = encode_provisional_state(&provisional)?;

    Ok(ManualContributeResult {
        provisional_psbt_base64,
        provisional_state
    })
}

/// Manual (offline) receiver step 2: given the provisional state from
/// [`receiver_manual_contribute`] and the receiver-signed provisional PSBT,
/// finalize the Payjoin proposal PSBT to hand back to the sender out of band.
#[uniffi::export]
pub fn receiver_manual_finalize(
    provisional_state: String,
    signed_psbt_base64: String
) -> Result<ManualFinalizeResult, PayjoinError> {
    let provisional = decode_provisional_state(&provisional_state)?;
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
                merged.inputs[i].final_script_witness = signed_in.final_script_witness.clone();
                merged.inputs[i].final_script_sig = signed_in.final_script_sig.clone();
                merged.inputs[i].tap_key_sig = signed_in.tap_key_sig.clone();
            }
            Ok(merged)
        })
        .map_err(|e| PayjoinError::msg(e.to_string()))?;

    let proposal_psbt_base64 = proposal.psbt().to_string();
    Ok(ManualFinalizeResult {
        proposal_psbt_base64
    })
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
    let ohttp_relay = NEXT_SENDER_OHTTP_RELAY
        .lock()
        .expect("sender relay lock")
        .clone()
        .unwrap_or_else(|| DEFAULT_OHTTP_RELAY.to_string());

    if is_v2 {
        let mut builder = send_v2::SenderBuilder::new(psbt, uri);
        if init.disable_output_substitution {
            builder = builder.always_disable_output_substitution();
        }
        let persister = MemoryPersister::<SendSessionEvent>::new();
        let sender = builder
            .build_recommended(FeeRate::BROADCAST_MIN)
            .map_err(|e| PayjoinError::msg(e.to_string()))?
            .save(&persister)
            .map_err(|e| PayjoinError::msg(e.to_string()))?;
        let events: Vec<SendSessionEvent> = persister
            .load()
            .map_err(|e| PayjoinError::msg(e.to_string()))?
            .collect();

        let state = encode_sender_state(&id, "v2", &ohttp_relay, &events)?;
        let (request, ohttp_ctx) = sender
            .create_v2_post_request(&ohttp_relay)
            .map_err(|e| PayjoinError::msg(e.to_string()))?;

        SENDERS.lock().expect("senders lock").insert(
            id.clone(),
            SenderEntry {
                events,
                live: SenderLive::V2WithReply {
                    sender,
                    ohttp_relay: ohttp_relay.clone()
                },
                ohttp_relay,
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
            events: Vec::new(),
            live: SenderLive::V1 { context },
            ohttp_relay: String::new(),
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
    let (id, protocol) = decode_sender_id_protocol(&state)?;
    {
        let senders = SENDERS.lock().expect("senders lock");
        if let Some(entry) = senders.get(&id) {
            let next_state =
                sender_entry_state(&id, &protocol, entry).unwrap_or_else(|_| state.clone());
            return Ok(SenderSessionHandle {
                id,
                protocol,
                state: next_state,
                request: None
            });
        }
    }

    if protocol != "v2" {
        return Err(PayjoinError::msg("sender session not found in memory"));
    }

    let (_, _, ohttp_relay, events) = decode_sender_state(&state)?;
    let entry = rehydrate_sender_entry(ohttp_relay, events)?;
    let handle = SenderSessionHandle {
        id: id.clone(),
        protocol: protocol.clone(),
        state: sender_entry_state(&id, &protocol, &entry)?,
        request: None
    };
    SENDERS
        .lock()
        .expect("senders lock")
        .insert(id, entry);
    Ok(handle)
}

#[uniffi::export]
pub fn sender_extract_request(state: String) -> Result<ExtractRequestResult, PayjoinError> {
    let (id, protocol) = ensure_sender_in_memory(&state)?;
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
            let next_state = sender_entry_state(&id, &protocol, entry)?;
            Ok(ExtractRequestResult {
                request: request.into(),
                state: next_state
            })
        }
        SenderLive::V2WithReply { sender, ohttp_relay } => {
            let (request, ohttp_ctx) = sender
                .create_v2_post_request(ohttp_relay)
                .map_err(|e| PayjoinError::msg(e.to_string()))?;
            entry.pending_ohttp = Some(ohttp_ctx);
            let next_state = sender_entry_state(&id, &protocol, entry)?;
            Ok(ExtractRequestResult {
                request: request.into(),
                state: next_state
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
    let (id, protocol) = ensure_sender_in_memory(&state)?;
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
            let persister = MemoryPersister::<SendSessionEvent>::new();
            match sender.process_response(&body, ohttp_ctx).save(&persister) {
                Ok(next) => {
                    let mut next_entry = SenderEntry {
                        events: entry.events,
                        live: SenderLive::V2Polling {
                            sender: next,
                            ohttp_relay: ohttp_relay.clone()
                        },
                        ohttp_relay,
                        pending_ohttp: None
                    };
                    append_send_events(&mut next_entry, &persister)?;
                    let next_state = sender_entry_state(&id, &protocol, &next_entry)?;
                    senders.insert(id, next_entry);
                    Ok(ProcessResult::Pending {
                        next_request: None,
                        state: next_state
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
            let persister = MemoryPersister::<SendSessionEvent>::new();
            match sender.process_response(&body, ohttp_ctx).save(&persister) {
                Ok(OptionalTransitionOutcome::Progress(psbt)) => {
                    let mut events = entry.events;
                    let new_events: Vec<SendSessionEvent> = persister
                        .load()
                        .map_err(|e| PayjoinError::msg(e.to_string()))?
                        .collect();
                    events.extend(new_events);
                    let next_state =
                        encode_sender_state(&id, &protocol, &ohttp_relay, &events)
                            .unwrap_or(state);
                    Ok(ProcessResult::Proposal {
                        psbt_base64: psbt.to_string(),
                        state: next_state
                    })
                }
                Ok(OptionalTransitionOutcome::Stasis(same)) => {
                    let mut next_entry = SenderEntry {
                        events: entry.events,
                        live: SenderLive::V2Polling {
                            sender: same,
                            ohttp_relay: ohttp_relay.clone()
                        },
                        ohttp_relay,
                        pending_ohttp: None
                    };
                    append_send_events(&mut next_entry, &persister)?;
                    let next_state = sender_entry_state(&id, &protocol, &next_entry)?;
                    senders.insert(id, next_entry);
                    Ok(ProcessResult::Pending {
                        next_request: None,
                        state: next_state
                    })
                }
                Err(error) => Ok(ProcessResult::Error {
                    message: error.to_string()
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn posted_original_psbt_roundtrips_through_sender_state() {
        let event = SendSessionEvent::PostedOriginalPsbt();
        let state = encode_sender_state(
            "id",
            "v2",
            "https://ohttp.example",
            &[
                // Created is heavy; PostedOriginal alone exercises the quirk.
                event.clone()
            ]
        )
        .expect("encode state");
        let (_, _, relay, events) = decode_sender_state(&state).expect("decode state");
        assert_eq!(relay, "https://ohttp.example");
        assert_eq!(events, vec![event.clone()]);

        // Legacy nested `events` array (first durable build) still loads.
        use base64::Engine;
        let legacy_payload = serde_json::json!({
            "events": [{ "PostedOriginalPsbt": null }],
            "id": "id",
            "ohttp_relay": "https://ohttp.example",
            "protocol": "v2",
            "role": "sender"
        });
        let legacy = base64::engine::general_purpose::STANDARD
            .encode(legacy_payload.to_string().as_bytes());
        let (_, _, _, legacy_events) = decode_sender_state(&legacy).expect("decode legacy");
        assert_eq!(legacy_events, vec![SendSessionEvent::PostedOriginalPsbt()]);
    }
}
