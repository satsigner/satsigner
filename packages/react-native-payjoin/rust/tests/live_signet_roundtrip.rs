//! Live BIP77 roundtrip against payjo.in using the Sample (segwit) Signet seed.
//!
//! Asserts real OHTTP relay + directory HTTP responses (not the Jest mock).
//! Chain data (UTXOs / broadcast) uses a local Electrum server.
//!
//! Run from apps/mobile:
//!   pnpm test:int:payjoin:live
//!
//! Or:
//!   cd packages/react-native-payjoin/rust && \
//!     PAYJOIN_LIVE_TEST=1 cargo test --test live_signet_roundtrip -- --nocapture
//!
//! Override Electrum with:
//!   ELECTRUM_TCP=192.168.68.100:60001

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::str::FromStr;
use std::thread;
use std::time::Duration;

use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::consensus::encode::serialize_hex;
use bitcoin::hashes::{sha256, Hash};
use bitcoin::key::{CompressedPublicKey, Secp256k1};
use bitcoin::psbt::Psbt;
use bitcoin::secp256k1::All;
use bitcoin::{
    Address, Amount, Network, OutPoint, Script, ScriptBuf, Sequence, Transaction, TxIn, TxOut,
    Witness, absolute::LockTime
};
use bip39::Mnemonic;
use satsigner_payjoin::{
    create_receiver_session, create_sender_session, fetch_ohttp_keys, receiver_contribute_and_finalize,
    receiver_extract_request, receiver_process_response, sender_extract_request,
    sender_process_response, ProcessResult, ReceiverInput, ReceiverSessionInit, SenderSessionInit
};
use serde_json::{json, Value};

const SAMPLE_SIGNET_SEED: &str =
    "surprise winter sausage nation grape nerve cereal because price rally pride gym";
/// External receiver wallet for cross-wallet payjoin live tests.
const CLOWN_SIGNET_SEED: &str = "clown believe select betray misery shine bone coyote benefit evoke auction hybrid famous equip know embark will alter mushroom beauty creek online announce hidden";
const DIRECTORY: &str = "https://payjo.in";
const RELAY: &str = "https://pj.bobspacebkk.com";
const DEFAULT_ELECTRUM_TCP: &str = "192.168.68.100:60001";
const PAYMENT_SATS: u64 = 2_000;
const CONTRIBUTE_FUND_SATS: u64 = 2_500;

fn live_enabled() -> bool {
    matches!(
        std::env::var("PAYJOIN_LIVE_TEST").as_deref(),
        Ok("1") | Ok("true") | Ok("yes")
    )
}

fn electrum_addr() -> String {
    std::env::var("ELECTRUM_TCP").unwrap_or_else(|_| DEFAULT_ELECTRUM_TCP.to_string())
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

/// Minimal Electrum JSON-RPC over plain TCP (electrs).
struct Electrum {
    next_id: std::cell::Cell<u64>,
    stream: TcpStream
}

impl Electrum {
    fn connect() -> Self {
        let addr = electrum_addr();
        let stream = TcpStream::connect_timeout(
            &addr.parse().expect("ELECTRUM_TCP host:port"),
            Duration::from_secs(10)
        )
        .unwrap_or_else(|e| panic!("connect Electrum {addr}: {e}"));
        stream
            .set_read_timeout(Some(Duration::from_secs(30)))
            .expect("read timeout");
        stream
            .set_write_timeout(Some(Duration::from_secs(30)))
            .expect("write timeout");
        let client = Self {
            next_id: std::cell::Cell::new(1),
            stream
        };
        let version = client.call("server.version", json!(["satsigner-payjoin-live", "1.4"]));
        println!("Electrum {addr} → {version}");
        client
    }

    fn call(&self, method: &str, params: Value) -> Value {
        let id = self.next_id.get();
        self.next_id.set(id + 1);
        let req = json!({
            "id": id,
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        let line = format!("{req}\n");
        let mut writer = self
            .stream
            .try_clone()
            .expect("clone electrum stream for write");
        writer
            .write_all(line.as_bytes())
            .unwrap_or_else(|e| panic!("electrum write {method}: {e}"));
        writer.flush().ok();

        let mut reader = BufReader::new(
            self.stream
                .try_clone()
                .expect("clone electrum stream for read")
        );
        let mut response_line = String::new();
        reader
            .read_line(&mut response_line)
            .unwrap_or_else(|e| panic!("electrum read {method}: {e}"));
        let parsed: Value = serde_json::from_str(response_line.trim())
            .unwrap_or_else(|e| panic!("electrum JSON {method}: {e} / {response_line}"));
        if let Some(err) = parsed.get("error") {
            if !err.is_null() {
                panic!("electrum {method} error: {err}");
            }
        }
        parsed
            .get("result")
            .cloned()
            .unwrap_or_else(|| panic!("electrum {method} missing result: {parsed}"))
    }

    fn list_unspent(&self, script: &Script) -> Vec<(bitcoin::Txid, u32, u64)> {
        let scripthash = electrum_scripthash(script);
        let result = self.call("blockchain.scripthash.listunspent", json!([scripthash]));
        let Some(arr) = result.as_array() else {
            return Vec::new();
        };
        arr.iter()
            .filter_map(|u| {
                let txid = bitcoin::Txid::from_str(u.get("tx_hash")?.as_str()?).ok()?;
                let vout = u.get("tx_pos")?.as_u64()? as u32;
                let value = u.get("value")?.as_u64()?;
                Some((txid, vout, value))
            })
            .collect()
    }

    fn broadcast(&self, tx_hex: &str) -> String {
        let result = self.call("blockchain.transaction.broadcast", json!([tx_hex]));
        result
            .as_str()
            .unwrap_or_else(|| panic!("broadcast result not string: {result}"))
            .to_string()
    }

    fn get_tx(&self, txid: &bitcoin::Txid) -> String {
        let result = self.call(
            "blockchain.transaction.get",
            json!([txid.to_string(), false])
        );
        result
            .as_str()
            .unwrap_or_else(|| panic!("get_tx result not string: {result}"))
            .to_string()
    }
}

fn electrum_scripthash(script: &Script) -> String {
    let hash = sha256::Hash::hash(script.as_bytes());
    let mut bytes = hash.to_byte_array();
    bytes.reverse();
    hex::encode(bytes)
}

struct DerivedWallet {
    secp: Secp256k1<All>,
    master: Xpriv,
    receive_address: Address,
    receive_script: ScriptBuf,
    change_address: Address,
    change_script: ScriptBuf
}

fn derive_sample_wallet() -> DerivedWallet {
    derive_wallet(SAMPLE_SIGNET_SEED)
}

fn derive_clown_wallet() -> DerivedWallet {
    derive_wallet(CLOWN_SIGNET_SEED)
}

fn derive_wallet(mnemonic_words: &str) -> DerivedWallet {
    let mnemonic = Mnemonic::parse(mnemonic_words).expect("valid mnemonic");
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

fn find_all_funded_utxos(electrum: &Electrum, wallet: &DerivedWallet) -> Vec<FundedUtxo> {
    find_funded_utxos(electrum, wallet, false)
}

/// Scan external + change. When `stop_when_ready`, return as soon as we have one
/// coin large enough to fund a payment and a second coin for contribute.
fn find_funded_utxos(
    electrum: &Electrum,
    wallet: &DerivedWallet,
    stop_when_ready: bool
) -> Vec<FundedUtxo> {
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
        let script = address.script_pubkey();
        for (txid, vout, value) in electrum.list_unspent(script.as_script()) {
            if value <= 1_000 {
                continue;
            }
            println!("Funded UTXO {txid}:{vout} = {value} sats at {path}");
            found.push(FundedUtxo {
                path: path.clone(),
                script: script.clone(),
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
    }
    found.sort_by(|a, b| b.value.cmp(&a.value));
    found
}

/// Ensure two distinct UTXOs exist (sender funding + receiver contribute).
/// If only one large coin is available, split it on-chain first.
fn select_funding_and_contribute(
    electrum: &Electrum,
    wallet: &DerivedWallet
) -> (FundedUtxo, FundedUtxo) {
    let mut utxos = find_funded_utxos(electrum, wallet, true);
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
    let split_txid = broadcast_signed_psbt(electrum, wallet, &psbt.to_string());

    // Wait for electrum to index the split outputs.
    let mut funding = None;
    let mut contribute = None;
    for attempt in 1..=30 {
        thread::sleep(Duration::from_secs(1));
        utxos = find_all_funded_utxos(electrum, wallet);
        println!("Post-split UTXO scan attempt {attempt}: {} coins", utxos.len());
        contribute = utxos
            .iter()
            .find(|u| u.txid == split_txid && u.value == contribute_sats)
            .cloned();
        funding = utxos
            .iter()
            .find(|u| u.txid == split_txid && u.value == change_sats)
            .cloned();
        if funding.is_some() && contribute.is_some() {
            break;
        }
    }
    (
        funding.expect("split funding UTXO not visible on electrum"),
        contribute.expect("split contribute UTXO not visible on electrum")
    )
}

fn broadcast_signed_psbt(
    electrum: &Electrum,
    wallet: &DerivedWallet,
    psbt_b64: &str
) -> bitcoin::Txid {
    broadcast_signed_psbt_multi(electrum, &[wallet], psbt_b64)
}

fn build_and_sign_original(
    sender: &DerivedWallet,
    funding: &FundedUtxo,
    payment_script: ScriptBuf,
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
                script_pubkey: payment_script
            },
            TxOut {
                value: Amount::from_sat(change_sats),
                script_pubkey: sender.change_script.clone()
            },
        ]
    };

    let mut psbt = Psbt::from_unsigned_tx(tx).expect("psbt");
    psbt.inputs[0].witness_utxo = Some(TxOut {
        value: Amount::from_sat(funding.value),
        script_pubkey: funding.script.clone()
    });

    let xpriv = sender.master.derive_priv(&sender.secp, &funding.path).unwrap();
    psbt.sign(&xpriv, &sender.secp).expect("sign original");
    psbt
}

fn sign_payjoin_psbt(
    wallet: &DerivedWallet,
    psbt_b64: &str,
    contribute: &FundedUtxo
) -> String {
    let mut psbt = Psbt::from_str(psbt_b64).expect("parse proposal");
    let target = OutPoint {
        txid: contribute.txid,
        vout: contribute.vout
    };
    let mut signed_contribute = false;
    for i in 0..psbt.inputs.len() {
        // Never leave sender inputs finalized — BIP78 rejects that.
        if psbt.unsigned_tx.input[i].previous_output != target {
            psbt.inputs[i].final_script_witness = None;
            psbt.inputs[i].final_script_sig = None;
            psbt.inputs[i].tap_key_sig = None;
            continue;
        }
        let utxo = psbt.inputs[i]
            .witness_utxo
            .clone()
            .expect("contribute input missing witness_utxo");
        let xpriv = find_xpriv_for_script(wallet, &utxo.script_pubkey)
            .expect("no key for contribute script");
        sign_and_finalize_p2wpkh(&mut psbt, i, &xpriv, &wallet.secp, &utxo);
        signed_contribute = true;
    }
    assert!(signed_contribute, "contribute outpoint not found in proposal PSBT");
    psbt.to_string()
}

/// Sign every input owned by any of the wallets (final broadcast).
fn sign_all_owned_inputs_multi(wallets: &[&DerivedWallet], psbt_b64: &str) -> String {
    let mut psbt = Psbt::from_str(psbt_b64).expect("parse proposal");
    for i in 0..psbt.inputs.len() {
        if psbt.inputs[i].final_script_witness.is_some()
            || psbt.inputs[i].final_script_sig.is_some()
        {
            continue;
        }
        let Some(utxo) = psbt.inputs[i].witness_utxo.clone() else {
            continue;
        };
        let mut signed = false;
        for wallet in wallets {
            if let Some(xpriv) = find_xpriv_for_script(wallet, &utxo.script_pubkey) {
                sign_and_finalize_p2wpkh(&mut psbt, i, &xpriv, &wallet.secp, &utxo);
                signed = true;
                break;
            }
        }
        assert!(
            signed,
            "no wallet key for input {i} script {}",
            hex::encode(utxo.script_pubkey.as_bytes())
        );
    }
    psbt.to_string()
}

fn broadcast_signed_psbt_multi(
    electrum: &Electrum,
    wallets: &[&DerivedWallet],
    psbt_b64: &str
) -> bitcoin::Txid {
    let signed = sign_all_owned_inputs_multi(wallets, psbt_b64);
    let final_psbt = Psbt::from_str(&signed).expect("final psbt");
    let tx = final_psbt
        .extract_tx()
        .expect("extract tx — all inputs should be signed");
    let txid = tx.compute_txid();
    let tx_hex = serialize_hex(&tx);
    println!("Broadcasting txid={txid}");
    let broadcast_body = electrum.broadcast(&tx_hex);
    assert!(
        broadcast_body.eq_ignore_ascii_case(&txid.to_string()),
        "unexpected broadcast response: {broadcast_body} (expected {txid})"
    );
    println!("Broadcast ok: {txid}");
    txid
}

/// Ensure the receiver wallet has a contribute UTXO; fund from sender if needed.
fn ensure_receiver_contribute(
    electrum: &Electrum,
    sender: &DerivedWallet,
    receiver: &DerivedWallet
) -> FundedUtxo {
    let existing = find_funded_utxos(electrum, receiver, false)
        .into_iter()
        .find(|u| u.value > 1_000);
    if let Some(utxo) = existing {
        println!(
            "Receiver already funded for contribute {}:{} ({} sats)",
            utxo.txid, utxo.vout, utxo.value
        );
        return utxo;
    }

    println!(
        "Receiver has no contribute UTXO — funding {CONTRIBUTE_FUND_SATS} sats from sample → clown receive/1"
    );
    let path_recv1: DerivationPath = "m/84'/1'/0'/0/1".parse().unwrap();
    let xpriv_recv1 = receiver
        .master
        .derive_priv(&receiver.secp, &path_recv1)
        .unwrap();
    let pk_recv1 =
        CompressedPublicKey::from_private_key(&receiver.secp, &xpriv_recv1.to_priv())
            .expect("compressed");
    let addr_recv1 = Address::p2wpkh(&pk_recv1, Network::Signet);

    let fund_from = find_funded_utxos(electrum, sender, false)
        .into_iter()
        .find(|u| u.value > CONTRIBUTE_FUND_SATS + PAYMENT_SATS + 4_000)
        .expect("sample wallet needs a large UTXO to fund clown contribute + later payjoin");

    let fee = 500u64;
    let change_sats = fund_from
        .value
        .saturating_sub(CONTRIBUTE_FUND_SATS + fee);
    assert!(change_sats > PAYMENT_SATS + 3_000, "fund-contribute leaves sender too small");

    let tx = Transaction {
        version: bitcoin::transaction::Version::TWO,
        lock_time: LockTime::ZERO,
        input: vec![TxIn {
            previous_output: OutPoint {
                txid: fund_from.txid,
                vout: fund_from.vout
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new()
        }],
        output: vec![
            TxOut {
                value: Amount::from_sat(CONTRIBUTE_FUND_SATS),
                script_pubkey: addr_recv1.script_pubkey()
            },
            TxOut {
                value: Amount::from_sat(change_sats),
                script_pubkey: sender.change_script.clone()
            },
        ]
    };
    let mut psbt = Psbt::from_unsigned_tx(tx).expect("fund contribute psbt");
    psbt.inputs[0].witness_utxo = Some(TxOut {
        value: Amount::from_sat(fund_from.value),
        script_pubkey: fund_from.script.clone()
    });
    let fund_xpriv = sender
        .master
        .derive_priv(&sender.secp, &fund_from.path)
        .unwrap();
    psbt.sign(&fund_xpriv, &sender.secp)
        .expect("sign fund contribute");
    let fund_txid = broadcast_signed_psbt(electrum, sender, &psbt.to_string());

    for attempt in 1..=30 {
        thread::sleep(Duration::from_secs(1));
        let utxos = find_funded_utxos(electrum, receiver, false);
        println!(
            "Receiver contribute fund scan attempt {attempt}: {} coins",
            utxos.len()
        );
        if let Some(utxo) = utxos
            .into_iter()
            .find(|u| u.txid == fund_txid && u.value == CONTRIBUTE_FUND_SATS)
        {
            return utxo;
        }
    }
    panic!("funded contribute UTXO not visible on electrum for clown wallet");
}

fn pick_sender_funding(electrum: &Electrum, sender: &DerivedWallet) -> FundedUtxo {
    find_funded_utxos(electrum, sender, true)
        .into_iter()
        .find(|u| u.value > PAYMENT_SATS + 3_000)
        .expect(
            "Sample (segwit) Signet wallet has no funded UTXO large enough. \
             Fund the wallet on Signet, then re-run."
        )
}

fn find_xpriv_for_script(
    wallet: &DerivedWallet,
    script: &Script
) -> Option<Xpriv> {
    for chain in [0u32, 1] {
        for index in 0u32..40 {
            let path: DerivationPath = format!("m/84'/1'/0'/{chain}/{index}")
                .parse()
                .unwrap();
            let xpriv = wallet.master.derive_priv(&wallet.secp, &path).unwrap();
            let pubkey = CompressedPublicKey::from_private_key(&wallet.secp, &xpriv.to_priv())
                .expect("compressed");
            let address = Address::p2wpkh(&pubkey, Network::Signet);
            if address.script_pubkey() == *script {
                return Some(xpriv);
            }
        }
    }
    None
}

fn sign_and_finalize_p2wpkh(
    psbt: &mut Psbt,
    input_index: usize,
    xpriv: &Xpriv,
    secp: &Secp256k1<All>,
    utxo: &TxOut
) {
    use bitcoin::ecdsa;
    use bitcoin::sighash::{EcdsaSighashType, SighashCache};
    use bitcoin::secp256k1::Message;

    let privkey = xpriv.to_priv();
    let pubkey = privkey.public_key(secp);
    let sighash_type = EcdsaSighashType::All;
    let mut cache = SighashCache::new(&psbt.unsigned_tx);
    let sighash = cache
        .p2wpkh_signature_hash(
            input_index,
            &utxo.script_pubkey,
            utxo.value,
            sighash_type
        )
        .expect("p2wpkh sighash");
    let msg = Message::from_digest(sighash.to_byte_array());
    let sig = secp.sign_ecdsa(&msg, &privkey.inner);
    let signature = ecdsa::Signature {
        signature: sig,
        sighash_type
    };

    let mut witness = Witness::new();
    witness.push_ecdsa_signature(&signature);
    witness.push(pubkey.to_bytes());
    psbt.inputs[input_index].final_script_witness = Some(witness);
    psbt.inputs[input_index].partial_sigs.clear();
    psbt.inputs[input_index].sighash_type = None;
    psbt.inputs[input_index].redeem_script = None;
    psbt.inputs[input_index].witness_script = None;
    psbt.inputs[input_index].bip32_derivation.clear();
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

    let electrum = Electrum::connect();
    let (funding, contribute_utxo) = select_funding_and_contribute(&electrum, &wallet);
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
    let original = build_and_sign_original(
        &wallet,
        &funding,
        wallet.receive_script.clone(),
        PAYMENT_SATS
    );
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
    let signed = sign_payjoin_psbt(&wallet, &provisional.psbt_base64, &contribute_utxo);
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

    let txid = broadcast_signed_psbt(&electrum, &wallet, &payjoin_psbt);
    // Confirm electrum knows the tx (server-side acceptance).
    let tx_hex = electrum.get_tx(&txid);
    assert!(
        !tx_hex.is_empty() && tx_hex.len() > 64,
        "electrum does not know broadcast tx: {tx_hex}"
    );
    println!("Payjoin transaction confirmed visible on electrum: {txid}");
}

#[test]
fn live_directory_payjoin_sample_to_clown_wallet() {
    if !live_enabled() {
        eprintln!("skip: set PAYJOIN_LIVE_TEST=1");
        return;
    }

    let sender = derive_sample_wallet();
    let receiver = derive_clown_wallet();
    println!("Sender (sample) change: {}", sender.change_address);
    println!("Receiver (clown) address: {}", receiver.receive_address);

    let electrum = Electrum::connect();
    let contribute_utxo = ensure_receiver_contribute(&electrum, &sender, &receiver);
    // Pick sender funding after any prep fund so we don't reuse a spent coin.
    let funding = pick_sender_funding(&electrum, &sender);
    assert!(
        !(funding.txid == contribute_utxo.txid && funding.vout == contribute_utxo.vout),
        "funding and contribute must be distinct outpoints"
    );
    println!(
        "Sender funding {}:{} ({} sats); clown contribute {}:{} ({} sats)",
        funding.txid,
        funding.vout,
        funding.value,
        contribute_utxo.txid,
        contribute_utxo.vout,
        contribute_utxo.value
    );

    let receiver_session = create_receiver_session(ReceiverSessionInit {
        address: receiver.receive_address.to_string(),
        directory_url: DIRECTORY.to_string(),
        expire_seconds: 600,
        ohttp_relay_url: RELAY.to_string()
    })
    .expect("create_receiver_session");
    let pj_uri_lower = receiver_session.pj_uri.to_ascii_lowercase();
    assert!(
        pj_uri_lower.contains("pj=") && pj_uri_lower.contains("payjo.in"),
        "pj URI missing directory: {}",
        receiver_session.pj_uri
    );
    println!("Payjoin URI (clown): {}", receiver_session.pj_uri);

    let mut recv_state = receiver_session.state;
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

    let original = build_and_sign_original(
        &sender,
        &funding,
        receiver.receive_script.clone(),
        PAYMENT_SATS
    );
    let sender_session = create_sender_session(SenderSessionInit {
        disable_output_substitution: true,
        original_psbt_base64: original.to_string(),
        pj_uri: receiver_session.pj_uri.clone()
    })
    .expect("create_sender_session");
    assert_eq!(sender_session.protocol, "v2");
    let mut send_state = sender_session.state;
    let first_req = sender_session.request.expect("sender initial request");
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
    assert!(!original_psbt.is_empty());

    let input = ReceiverInput {
        script_hex: hex::encode(contribute_utxo.script.as_bytes()),
        txid: contribute_utxo.txid.to_string(),
        value: contribute_utxo.value,
        vout: contribute_utxo.vout
    };
    let provisional =
        receiver_contribute_and_finalize(recv_state.clone(), input.clone(), String::new())
            .expect("contribute provisional");
    let signed = sign_payjoin_psbt(&receiver, &provisional.psbt_base64, &contribute_utxo);
    let finalized = receiver_contribute_and_finalize(provisional.state, input, signed)
        .expect("contribute finalize");
    assert!(!finalized.request.url.is_empty());
    let (status, body) = http_post(
        &finalized.request.url,
        &finalized.request.content_type,
        &finalized.request.body
    );
    assert_eq!(status, 200);
    assert!(!body.is_empty());
    let _ = receiver_process_response(finalized.state, body);

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

    let txid = broadcast_signed_psbt_multi(&electrum, &[&sender, &receiver], &payjoin_psbt);
    let tx_hex = electrum.get_tx(&txid);
    assert!(
        !tx_hex.is_empty() && tx_hex.len() > 64,
        "electrum does not know broadcast tx: {tx_hex}"
    );
    println!(
        "Sample → clown payjoin broadcast ok: {txid} (payment to {})",
        receiver.receive_address
    );
}
