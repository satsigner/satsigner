#[derive(Debug, Clone, uniffi::Record)]
pub struct ReceiverSessionInit {
    pub address: String,
    pub directory_url: String,
    pub ohttp_relay_url: String,
    pub expire_seconds: u64
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct ReceiverSessionHandle {
    pub id: String,
    pub pj_uri: String,
    pub state: String
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SenderSessionInit {
    pub pj_uri: String,
    pub original_psbt_base64: String,
    pub disable_output_substitution: bool
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SenderSessionHandle {
    pub id: String,
    pub protocol: String,
    pub state: String,
    pub request: Option<PayjoinNativeRequest>
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct PayjoinNativeRequest {
    pub url: String,
    pub body: Vec<u8>,
    pub content_type: String
}

/// Raw HTTP response for OHTTP/directory posts.
/// Used instead of RN `fetch` on Android, where OkHttp HTTP/2 often fails with
/// "Required SETTINGS preface not received" against Payjoin relays.
#[derive(Debug, Clone, uniffi::Record)]
pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct ReceiverInput {
    pub txid: String,
    pub vout: u32,
    pub value: u64,
    pub script_hex: String
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct ExtractRequestResult {
    pub request: PayjoinNativeRequest,
    pub state: String
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct ContributeResult {
    pub request: PayjoinNativeRequest,
    pub state: String,
    pub psbt_base64: String
}

#[derive(Debug, Clone, uniffi::Enum)]
pub enum ProcessResult {
    Pending {
        next_request: Option<PayjoinNativeRequest>,
        state: String
    },
    Proposal {
        psbt_base64: String,
        state: String
    },
    Completed {
        state: String
    },
    Error {
        message: String
    }
}

impl From<payjoin::Request> for PayjoinNativeRequest {
    fn from(value: payjoin::Request) -> Self {
        Self {
            url: value.url,
            body: value.body,
            content_type: value.content_type.to_string()
        }
    }
}
