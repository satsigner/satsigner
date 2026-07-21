#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum PayjoinError {
    #[error("{0}")]
    Message(String)
}

impl PayjoinError {
    pub fn msg(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }
}

impl From<payjoin::io::Error> for PayjoinError {
    fn from(value: payjoin::io::Error) -> Self {
        Self::msg(value.to_string())
    }
}

impl From<bitcoin::psbt::PsbtParseError> for PayjoinError {
    fn from(value: bitcoin::psbt::PsbtParseError) -> Self {
        Self::msg(value.to_string())
    }
}

impl From<bitcoin::address::ParseError> for PayjoinError {
    fn from(value: bitcoin::address::ParseError) -> Self {
        Self::msg(value.to_string())
    }
}

impl From<serde_json::Error> for PayjoinError {
    fn from(value: serde_json::Error) -> Self {
        Self::msg(value.to_string())
    }
}
