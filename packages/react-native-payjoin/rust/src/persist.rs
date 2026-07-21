use std::convert::Infallible;
use std::sync::Mutex;

use payjoin::persist::SessionPersister;

/// Append-only in-memory session event log used to advance PDK typestates.
pub struct MemoryPersister<E> {
    events: Mutex<Vec<E>>
}

impl<E> MemoryPersister<E> {
    pub fn new() -> Self {
        Self {
            events: Mutex::new(Vec::new())
        }
    }
}

impl<E> Default for MemoryPersister<E> {
    fn default() -> Self {
        Self::new()
    }
}

impl<E: Clone + 'static> SessionPersister for MemoryPersister<E> {
    type InternalStorageError = Infallible;
    type SessionEvent = E;

    fn save_event(&self, event: Self::SessionEvent) -> Result<(), Self::InternalStorageError> {
        self.events
            .lock()
            .expect("persister lock")
            .push(event);
        Ok(())
    }

    fn load(
        &self
    ) -> Result<Box<dyn Iterator<Item = Self::SessionEvent>>, Self::InternalStorageError> {
        let events = self.events.lock().expect("persister lock").clone();
        Ok(Box::new(events.into_iter()))
    }

    fn close(&self) -> Result<(), Self::InternalStorageError> {
        Ok(())
    }
}
