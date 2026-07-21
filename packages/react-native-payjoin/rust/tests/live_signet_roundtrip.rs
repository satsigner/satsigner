//! Live BIP77 roundtrip against payjo.in using the Sample (segwit) Signet seed.
//!
//! Asserts real OHTTP relay + directory HTTP responses (not the Jest mock).
//! When the sample wallet has a funded UTXO, completes contribute → proposal →
//! broadcast on Signet.
//!
//! Run from apps/mobile:
//!   pnpm test:int:payjoin:live
//!
//! Or:
//!   cd packages/react-native-payjoin/rust && \
//!     PAYJOIN_LIVE_TEST=1 cargo test --test live_signet_roundtrip -- --nocapture

use std::str::FromStr;
use std::thread;
use std::time::Duration;

use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::consensus::encode::serialize_hex;
use bitcoin::key::{CompressedPublicKey, Secp256k1};
use bitcoin::psbt::Psbt;
use bitcoin::secp256k1::All;
use bitcoin::{
    Address, Amount, Network, OutPoint, ScriptBuf, Sequence, Transaction, TxIn, TxOut, Witness,
    absolute::LockTime
};
use bip39::Mnemonic;
use satsigner_payjoin::{
    create_receiver_session, create_sender_session, fetch_ohttp_keys, receiver_contribute_and_finalize,
    receiver_extract_request, receiver_process_response, sender_extract_request,
    sender_process_response, ProcessResult, ReceiverInput, ReceiverSessionInit, SenderSessionInit
};

const SAMPLE_SIGNET_SEED: &str =
    "surprise winter sausage nation grape nerve cereal because price rally pride gym";
const DIRECTORY: &str = "https://payjo.in";
const RELAY: &str = "https://pj.bobspacebkk.com";
const ESPLORA: &str = "https://mempool.space/signet/api";
const PAYMENT_SATS: u64 = 2_000;

fn live_enabled() -> bool {
    matches!(
        std::env::var("PAYJOIN_LIVE_TEST").as_deref(),
        Ok("1") | Ok("true") | Ok("yes")
    )
}

fn http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .expect("http client")
}

fn http_post(url: &str, content_type: &str, body: &[u8]) -> (u16, Vec<u8>) {
    let client = http_client();
    let mut last_err = String::new();
    for attempt in 1..=5 {
        match client
            .post(url)
            .header("Content-Type", content_type)
            .body(body.to_vec())
            .send()
        {
            Ok(response) => {
                let status = response.status().as_u16();
                let bytes = response.bytes().unwrap_or_else(|e| panic!("read body: {e}"));
                println!("POST {url} → HTTP {status} ({} bytes)", bytes.len());
                assert!(
                    (200..300).contains(&status),
                    "expected 2xx from directory/relay, got {status}"
                );
                return (status, bytes.to_vec());
            }
            Err(e) => {
                last_err = e.to_string();
                println!("POST {url} attempt {attempt} failed: {last_err}");
                thread::sleep(Duration::from_millis(500 * attempt));
            }
        }
    }
    panic!("HTTP POST {url} failed after retries: {last_err}");
}

fn esplora_get(path: &str) -> String {
    let url = format!("{ESPLORA}{path}");
    let client = http_client();
    let mut last_err = String::new();
    for attempt in 1..=5 {
        match client.get(&url).send() {
            Ok(response) => {
                let status = response.status().as_u16();
                let text = response.text().unwrap_or_default();
                if attempt > 1 || !(200..300).contains(&status) {
                    println!("GET {url} → HTTP {status}");
                }
                assert!(
                    (200..300).contains(&status),
                    "esplora GET failed: {status} {text}"
                );
                return text;
            }
            Err(e) => {
                last_err = e.to_string();
                println!("GET {url} attempt {attempt} failed: {last_err}");
                thread::sleep(Duration::from_millis(600 * attempt));
            }
        }
    }
    panic!("GET {url} failed after retries: {last_err}");
}

/// Soft variant for address scans — skip flaky esplora responses instead of aborting.
fn esplora_get_soft(path: &str) -> Option<String> {
    let url = format!("{ESPLORA}{path}");
    let client = http_client();
    for attempt in 1..=3 {
        match client.get(&url).send() {
            Ok(response) => {
                let status = response.status().as_u16();
                let text = response.text().unwrap_or_default();
                if !(200..300).contains(&status) {
                    println!("GET {url} → HTTP {status} (soft-skip)");
                    return None;
                }
                return Some(text);
            }
            Err(e) => {
                println!("GET {url} soft attempt {attempt} failed: {e}");
                thread::sleep(Duration::from_millis(350 * attempt));
            }
        }
    }
    None
}

fn esplora_broadcast(tx_hex: &str) -> String {
    let url = format!("{ESPLORA}/tx");
    let client = http_client();
    let mut last_err = String::new();
    for attempt in 1..=5 {
        match client
            .post(&url)
            .header("Content-Type", "text/plain")
            .body(tx_hex.to_string())
            .send()
        {
            Ok(response) => {
                let status = response.status().as_u16();
                let body = response.text().unwrap_or_default();
                println!("Broadcast → HTTP {status}: {body}");
                assert!(
                    (200..300).contains(&status),
                    "broadcast rejected: {status} {body}"
                );
                return body;
            }
            Err(e) => {
                last_err = e.to_string();
                println!("Broadcast attempt {attempt} failed: {last_err}");
                thread::sleep(Duration::from_millis(500 * attempt));
            }
        }
    }
    panic!("broadcast failed after retries: {last_err}");
}

struct DerivedWallet {
    secp: Secp256k1<All>,
    master: Xpriv,
    receive_address: Address,
    receive_script: ScriptBuf,
    change_address: Address,
    change_script: ScriptBuf,
    change_path: DerivationPath
}

fn derive_sample_wallet() -> DerivedWallet {
    let mnemonic = Mnemonic::parse(SAMPLE_SIGNET_SEED).expect("valid sample mnemonic");
    let seed = mnemonic.to_seed("");
    let secp = Secp256k1::new();
    let master = Xpriv::new_master(Network::Signet, &seed).expect("master");
    let recv_path: DerivationPath = "m/84'/1'/0'/0/0".parse().unwrap();
    let change_path: DerivationPath = "m/84'/1'/0'/1/0".parse().unwrap();
    let recv_xpriv = master.derive_priv(&secp, &recv_path).unwrap();
    let change_xpriv = master.derive_priv(&secp, &change_path).unwrap();
    let recv_pubkey = CompressedPublicKey::from_private_key(&secp, &recv_xpriv.to_priv())
        .expect("compressed recv");
    let change_pubkey = CompressedPublicKey::from_private_key(&secp, &change_xpriv.to_priv())
        .expect("compressed change");
    let receive_address = Address::p2wpkh(&recv_pubkey, Network::Signet);
    let change_address = Address::p2wpkh(&change_pubkey, Network::Signet);
    DerivedWallet {
        change_address: change_address.clone(),
        change_path,
        change_script: change_address.script_pubkey(),
        master,
        receive_address: receive_address.clone(),
        receive_script: receive_address.script_pubkey(),
        secp
    }
}

#[derive(Clone)]
struct FundedUtxo {
    path: DerivationPath,
    script: ScriptBuf,
    txid: bitcoin::Txid,
    value: u64,
    vout: u32
}

fn find_all_funded_utxos(wallet: &DerivedWallet) -> Vec<FundedUtxo> {
    find_funded_utxos(wallet, false)
}

/// Scan external + change. When `stop_when_ready`, return as soon as we have one
/// coin large enough to fund a payment and a second coin for contribute.
fn find_funded_utxos(wallet: &DerivedWallet, stop_when_ready: bool) -> Vec<FundedUtxo> {
    let mut found = Vec::new();
    // Probe recently-funded indices first (Sample wallet history), then full scan.
    let preferred: [(u32, u32); 6] = [(0, 27), (0, 9), (0, 26), (1, 0), (0, 0), (0, 1)];
    let mut seen = std::collections::HashSet::new();
    let mut order: Vec<(u32, u32)> = preferred.to_vec();
    for chain in [0u32, 1] {
        for index in 0u32..40 {
            if !preferred.contains(&(chain, index)) {
                order.push((chain, index));
            }
        }
    }

    for (chain, index) in order {
        if !seen.insert((chain, index)) {
            continue;
        }
        let path: DerivationPath = format!("m/84'/1'/0'/{chain}/{index}")
            .parse()
            .unwrap();
        let xpriv = wallet.master.derive_priv(&wallet.secp, &path).unwrap();
        let pubkey = CompressedPublicKey::from_private_key(&wallet.secp, &xpriv.to_priv())
            .expect("compressed");
        let address = Address::p2wpkh(&pubkey, Network::Signet);
        let Some(utxos_json) = esplora_get_soft(&format!("/address/{address}/utxo")) else {
            continue;
        };
        let utxos: Vec<serde_json::Value> =
            serde_json::from_str(&utxos_json).unwrap_or_default();
        for utxo in utxos {
            let value = utxo["value"].as_u64().unwrap_or(0);
            // Sender needs payment+fee+change dust; receiver contribute needs > dust.
            if value <= 1_000 {
                continue;
            }
            let txid = bitcoin::Txid::from_str(utxo["txid"].as_str().unwrap()).unwrap();
            let vout = utxo["vout"].as_u64().unwrap() as u32;
            println!("Funded UTXO {txid}:{vout} = {value} sats at {path}");
            found.push(FundedUtxo {
                path: path.clone(),
                script: address.script_pubkey(),
                txid,
                value,
                vout
            });
        }
        if stop_when_ready {
            let has_large = found.iter().any(|u| u.value > PAYMENT_SATS + 3_000);
            if has_large && found.len() >= 2 {
                found.sort_by(|a, b| b.value.cmp(&a.value));
                return found;
            }
        }
        // Gentle pacing for mempool.space rate limits.
        thread::sleep(Duration::from_millis(80));
    }
    found.sort_by(|a, b| b.value.cmp(&a.value));
    found
}

/// Ensure two distinct UTXOs exist (sender funding + receiver contribute).
/// If only one large coin is available, split it on-chain first.
fn select_funding_and_contribute(wallet: &DerivedWallet) -> (FundedUtxo, FundedUtxo) {
    // Stop early once we have funding + contribute coins (keeps esplora traffic down).
    let mut utxos = find_funded_utxos(wallet, true);
    let large = utxos
        .iter()
        .find(|u| u.value > PAYMENT_SATS + 3_000)
        .cloned()
        .expect(
            "Sample (segwit) Signet wallet has no funded UTXO large enough. \
             Fund the wallet on Signet, then re-run."
        );

    let second = utxos
        .iter()
        .find(|u| !(u.txid == large.txid && u.vout == large.vout) && u.value > 1_000)
        .cloned();

    if let Some(contribute) = second {
        // Prefer largest as funding when it can cover payment+fee+change.
        if large.value > PAYMENT_SATS + 1_000 {
            return (large, contribute);
        }
        return (contribute, large);
    }

    println!(
        "Only one UTXO — broadcasting a prep split so payjoin can contribute a second input"
    );
    let fee = 500u64;
    let contribute_sats = 2_000u64;
    let change_sats = large
        .value
        .saturating_sub(contribute_sats + fee);
    assert!(change_sats > PAYMENT_SATS + 1_000, "split leaves funding too small");

    // Send a small output to receive/1; keep the rest on change/0 for sender funding.
    let path_recv1: DerivationPath = "m/84'/1'/0'/0/1".parse().unwrap();
    let xpriv_recv1 = wallet.master.derive_priv(&wallet.secp, &path_recv1).unwrap();
    let pk_recv1 = CompressedPublicKey::from_private_key(&wallet.secp, &xpriv_recv1.to_priv())
        .expect("compressed");
    let addr_recv1 = Address::p2wpkh(&pk_recv1, Network::Signet);

    let tx = Transaction {
        version: bitcoin::transaction::Version::TWO,
        lock_time: LockTime::ZERO,
        input: vec![TxIn {
            previous_output: OutPoint {
                txid: large.txid,
                vout: large.vout
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new()
        }],
        output: vec![
            TxOut {
                value: Amount::from_sat(contribute_sats),
                script_pubkey: addr_recv1.script_pubkey()
            },
            TxOut {
                value: Amount::from_sat(change_sats),
                script_pubkey: wallet.change_script.clone()
            },
        ]
    };
    let mut psbt = Psbt::from_unsigned_tx(tx).expect("split psbt");
    psbt.inputs[0].witness_utxo = Some(TxOut {
        value: Amount::from_sat(large.value),
        script_pubkey: large.script.clone()
    });
    let fund_xpriv = wallet.master.derive_priv(&wallet.secp, &large.path).unwrap();
    psbt.sign(&fund_xpriv, &wallet.secp).expect("sign split");
    let split_txid = broadcast_signed_psbt(wallet, &psbt.to_string());

    // Wait for esplora to index the split outputs.
    let mut funding = None;
    let mut contribute = None;
    for attempt in 1..=30 {
        thread::sleep(Duration::from_secs(2));
        utxos = find_all_funded_utxos(wallet);
        println!("Post-split UTXO scan attempt {attempt}: {} coins", utxos.len());
        contribute = utxos.iter().find(|u| {
            u.txid == split_txid && u.value == contribute_sats
        }).cloned();
        funding = utxos.iter().find(|u| {
            u.txid == split_txid && u.value == change_sats
        }).cloned();
        if funding.is_some() && contribute.is_some() {
            break;
        }
    }
    (
        funding.expect("split funding UTXO not visible on esplora"),
        contribute.expect("split contribute UTXO not visible on esplora")
    )
}

fn broadcast_signed_psbt(wallet: &DerivedWallet, psbt_b64: &str) -> bitcoin::Txid {
    let signed = sign_payjoin_psbt(wallet, psbt_b64);
    let final_psbt = Psbt::from_str(&signed).expect("final psbt");
    let tx = final_psbt
        .extract_tx()
        .expect("extract tx — all inputs should be signed");
    let txid = tx.compute_txid();
    let tx_hex = serialize_hex(&tx);
    println!("Broadcasting txid={txid}");
    let broadcast_body = esplora_broadcast(&tx_hex);
    assert!(
        broadcast_body.contains(&txid.to_string()) || broadcast_body.len() == 64,
        "unexpected broadcast response: {broadcast_body}"
    );
    println!("Broadcast ok: {txid}");
    txid
}

fn build_and_sign_original(
    wallet: &DerivedWallet,
    funding: &FundedUtxo,
    payment_sats: u64
) -> Psbt {
    let fee = 800u64;
    let change_sats = funding.value.saturating_sub(payment_sats + fee);
    assert!(change_sats > 546, "change below dust");

    let tx = Transaction {
        version: bitcoin::transaction::Version::TWO,
        lock_time: LockTime::ZERO,
        input: vec![TxIn {
            previous_output: OutPoint {
                txid: funding.txid,
                vout: funding.vout
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new()
        }],
        output: vec![
            TxOut {
                value: Amount::from_sat(payment_sats),
                script_pubkey: wallet.receive_script.clone()
            },
            TxOut {
                value: Amount::from_sat(change_sats),
                script_pubkey: wallet.change_script.clone()
            },
        ]
    };

    let mut psbt = Psbt::from_unsigned_tx(tx).expect("psbt");
    psbt.inputs[0].witness_utxo = Some(TxOut {
        value: Amount::from_sat(funding.value),
        script_pubkey: funding.script.clone()
    });

    let xpriv = wallet.master.derive_priv(&wallet.secp, &funding.path).unwrap();
    psbt.sign(&xpriv, &wallet.secp).expect("sign original");
    psbt
}

fn sign_payjoin_psbt(wallet: &DerivedWallet, psbt_b64: &str) -> String {
    let mut psbt = Psbt::from_str(psbt_b64).expect("parse proposal");
    // Sign with account keys we know about (funding + change + receive branches).
    for chain in [0u32, 1] {
        for index in 0u32..40 {
            let path: DerivationPath = format!("m/84'/1'/0'/{chain}/{index}")
                .parse()
                .unwrap();
            let xpriv = wallet.master.derive_priv(&wallet.secp, &path).unwrap();
            let _ = psbt.sign(&xpriv, &wallet.secp);
        }
    }
    let change_xpriv = wallet
        .master
        .derive_priv(&wallet.secp, &wallet.change_path)
        .unwrap();
    let _ = psbt.sign(&change_xpriv, &wallet.secp);
    psbt.to_string()
}

#[test]
fn fetch_ohttp_keys_from_live_relay() {
    if !live_enabled() {
        eprintln!("skip: set PAYJOIN_LIVE_TEST=1");
        return;
    }
    let keys = fetch_ohttp_keys(RELAY.to_string(), DIRECTORY.to_string())
        .expect("fetch_ohttp_keys from live relay/directory");
    assert!(!keys.is_empty(), "OHTTP keys should be non-empty");
    println!("OHTTP keys ok ({} chars)", keys.len());
}

#[test]
fn live_directory_payjoin_roundtrip_and_broadcast() {
    if !live_enabled() {
        eprintln!("skip: set PAYJOIN_LIVE_TEST=1");
        return;
    }

    let wallet = derive_sample_wallet();
    println!("Receive address: {}", wallet.receive_address);
    println!("Change address:  {}", wallet.change_address);

    let (funding, contribute_utxo) = select_funding_and_contribute(&wallet);
    println!(
        "Sender funding {}:{} ({} sats); receiver contribute {}:{} ({} sats)",
        funding.txid,
        funding.vout,
        funding.value,
        contribute_utxo.txid,
        contribute_utxo.vout,
        contribute_utxo.value
    );

    // --- Receiver session (hits directory via OHTTP on create) ---
    let receiver = create_receiver_session(ReceiverSessionInit {
        address: wallet.receive_address.to_string(),
        directory_url: DIRECTORY.to_string(),
        expire_seconds: 600,
        ohttp_relay_url: RELAY.to_string()
    })
    .expect("create_receiver_session");
    let pj_uri_lower = receiver.pj_uri.to_ascii_lowercase();
    assert!(
        pj_uri_lower.contains("pj=") && pj_uri_lower.contains("payjo.in"),
        "pj URI missing directory: {}",
        receiver.pj_uri
    );
    println!("Payjoin URI: {}", receiver.pj_uri);

    // Register / poll once so mailbox exists on the directory.
    let mut recv_state = receiver.state;
    {
        let extracted = receiver_extract_request(recv_state.clone()).expect("recv extract");
        let (status, body) = http_post(
            &extracted.request.url,
            &extracted.request.content_type,
            &extracted.request.body
        );
        assert_eq!(status, 200);
        match receiver_process_response(extracted.state, body).expect("recv process") {
            ProcessResult::Pending { state, .. } => recv_state = state,
            other => panic!("expected pending after empty mailbox poll, got {other:?}")
        }
    }

    // --- Sender posts original PSBT to directory ---
    let original = build_and_sign_original(&wallet, &funding, PAYMENT_SATS);
    let sender = create_sender_session(SenderSessionInit {
        disable_output_substitution: true,
        original_psbt_base64: original.to_string(),
        pj_uri: receiver.pj_uri.clone()
    })
    .expect("create_sender_session");
    assert_eq!(sender.protocol, "v2");
    let mut send_state = sender.state;
    let first_req = sender.request.expect("sender initial request");
    let (status, body) = http_post(&first_req.url, &first_req.content_type, &first_req.body);
    assert_eq!(status, 200);
    assert!(!body.is_empty(), "directory/relay should return OHTTP response bytes");
    match sender_process_response(send_state.clone(), body).expect("sender process first") {
        ProcessResult::Pending { state, .. } => send_state = state,
        ProcessResult::Proposal { psbt_base64, .. } => {
            panic!("unexpected immediate proposal: {} chars", psbt_base64.len());
        }
        ProcessResult::Error { message } => panic!("sender first response error: {message}"),
        ProcessResult::Completed { .. } => panic!("unexpected completed")
    }

    // --- Receiver polls until original arrives, then contributes + posts proposal ---
    let mut original_psbt = None;
    for attempt in 1..=20 {
        println!("Receiver poll attempt {attempt}");
        let extracted = receiver_extract_request(recv_state.clone()).expect("recv extract");
        let (status, body) = http_post(
            &extracted.request.url,
            &extracted.request.content_type,
            &extracted.request.body
        );
        assert_eq!(status, 200);
        match receiver_process_response(extracted.state, body).expect("recv process") {
            ProcessResult::Pending { state, .. } => {
                recv_state = state;
                thread::sleep(Duration::from_millis(750));
            }
            ProcessResult::Proposal {
                psbt_base64,
                state
            } => {
                println!(
                    "Receiver got original/proposal payload ({} chars)",
                    psbt_base64.len()
                );
                assert!(!psbt_base64.is_empty());
                original_psbt = Some(psbt_base64);
                recv_state = state;
                break;
            }
            ProcessResult::Error { message } => panic!("receiver poll error: {message}"),
            ProcessResult::Completed { .. } => break
        }
    }
    let original_psbt = original_psbt.expect("receiver never saw sender original from directory");
    assert!(
        !original_psbt.is_empty(),
        "directory delivered empty original"
    );

    // Contribute second UTXO, finalize, POST proposal to directory (assert HTTP 2xx).
    let input = ReceiverInput {
        script_hex: hex::encode(contribute_utxo.script.as_bytes()),
        txid: contribute_utxo.txid.to_string(),
        value: contribute_utxo.value,
        vout: contribute_utxo.vout
    };
    let provisional =
        receiver_contribute_and_finalize(recv_state.clone(), input.clone(), String::new())
            .expect("contribute provisional");
    assert!(
        !provisional.psbt_base64.is_empty(),
        "provisional payjoin PSBT empty"
    );
    let signed = sign_payjoin_psbt(&wallet, &provisional.psbt_base64);
    let finalized = receiver_contribute_and_finalize(provisional.state, input, signed)
        .expect("contribute finalize");
    assert!(
        !finalized.request.url.is_empty(),
        "finalize must produce directory POST"
    );
    assert!(
        !finalized.psbt_base64.is_empty(),
        "finalized proposal PSBT empty"
    );
    let (status, body) = http_post(
        &finalized.request.url,
        &finalized.request.content_type,
        &finalized.request.body
    );
    assert_eq!(status, 200);
    assert!(!body.is_empty(), "proposal POST should return OHTTP response");
    let _ = receiver_process_response(finalized.state, body);

    // --- Sender polls until payjoin proposal returns ---
    let mut payjoin_psbt = None;
    for attempt in 1..=20 {
        println!("Sender poll attempt {attempt}");
        let extracted = sender_extract_request(send_state.clone()).expect("sender extract");
        let (status, body) = http_post(
            &extracted.request.url,
            &extracted.request.content_type,
            &extracted.request.body
        );
        assert_eq!(status, 200);
        match sender_process_response(extracted.state, body).expect("sender process") {
            ProcessResult::Pending { state, .. } => {
                send_state = state;
                thread::sleep(Duration::from_millis(750));
            }
            ProcessResult::Proposal { psbt_base64, .. } => {
                println!("Sender got payjoin proposal ({} chars)", psbt_base64.len());
                assert!(!psbt_base64.is_empty());
                payjoin_psbt = Some(psbt_base64);
                break;
            }
            ProcessResult::Error { message } => panic!("sender poll error: {message}"),
            ProcessResult::Completed { .. } => break
        }
    }
    let payjoin_psbt = payjoin_psbt.expect("sender never received proposal from directory");

    let txid = broadcast_signed_psbt(&wallet, &payjoin_psbt);
    // Confirm mempool/esplora knows the tx (server-side acceptance).
    let tx_json = esplora_get(&format!("/tx/{txid}"));
    assert!(
        tx_json.contains(&txid.to_string()),
        "esplora does not know broadcast tx: {tx_json}"
    );
    println!("Payjoin transaction confirmed visible on esplora: {txid}");
}
