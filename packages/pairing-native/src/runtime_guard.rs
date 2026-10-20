use super::*;
impl Actor {
    pub(super) fn now(&mut self) -> Result<u64> {
        let result = crate::route::elapsed_ms().and_then(|now| {
            if now < self.last_now {
                Err(PairingError::NativeUnsupported)
            } else {
                Ok(now)
            }
        });
        match result {
            Ok(now) => {
                self.last_now = now;
                Ok(now)
            }
            Err(error) => {
                self.fail_all(error);
                Err(error)
            }
        }
    }

    pub(super) fn guard(&mut self) -> Result<u64> {
        if let Some(error) = self.fatal {
            return Err(error);
        }
        if let Err(error) = self.installation.check() {
            self.fail_all(error);
            return Err(error);
        }
        self.now()
    }
}
