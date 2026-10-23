//! Preserve the binding registration for the entire SQLite connection lifetime.
use rusqlite::Connection;
use std::ops::{Deref, DerefMut};

pub(crate) enum WindowsConnection {
    #[cfg(test)]
    Legacy(Connection),
    Generation(crate::store_windows_vfs::BoundConnection),
}
impl WindowsConnection {
    pub(crate) fn healthy(&self) -> crate::error::Result<()> {
        match self {
            #[cfg(test)]
            Self::Legacy(_) => Ok(()),
            Self::Generation(connection) => connection.healthy(),
        }
    }
}
impl Deref for WindowsConnection {
    type Target = Connection;
    fn deref(&self) -> &Connection {
        match self {
            #[cfg(test)]
            Self::Legacy(connection) => connection,
            Self::Generation(connection) => connection,
        }
    }
}
impl DerefMut for WindowsConnection {
    fn deref_mut(&mut self) -> &mut Connection {
        match self {
            #[cfg(test)]
            Self::Legacy(connection) => connection,
            Self::Generation(connection) => connection,
        }
    }
}
