//! Metadata-only Simulator probe using production route modules; never connects/authenticates.
mod error {
    #[derive(Debug)]
    pub enum PairingError { LanUnavailable }
    pub type Result<T> = std::result::Result<T, PairingError>;
}
mod route {
    #[path = "__ADDRESS_PATH__"]
    pub(super) mod address;
    #[cfg(any(target_os = "ios", test))]
    #[path = "__IOS_PATH__"]
    mod ios;
    #[cfg(target_os = "ios")]
    pub(super) fn inspect(peer: std::net::IpAddr) -> (bool, Option<std::net::IpAddr>) {
        match ios::Route::open(Some(peer)) {
            Ok(route) => (route.check(peer).is_ok(), Some(route.local_ip())),
            Err(_) => (false, None),
        }
    }
    pub(super) fn supported(peer: std::net::IpAddr) -> bool { address::supported(peer) }
#[cfg(test)]
mod tests {
    use super::address::Prefix;
    #[test]
    fn production_prefix_excludes_loopback_self_and_other_subnets() {
        let prefix = Prefix { local: "192.168.7.2".parse().unwrap(), bits: 24 };
        assert!(prefix.validate().is_ok());
        assert!(prefix.accepts("192.168.7.3".parse().unwrap()));
        for ip in ["127.0.0.1", "192.168.7.2", "192.168.8.3", "192.168.7.0", "192.168.7.255"] {
            assert!(!prefix.accepts(ip.parse().unwrap()));
        }
    }
}

}
fn main() {
    #[cfg(not(target_os = "ios"))]
    panic!("Only execute inside the owned iOS Simulator");
    #[cfg(target_os = "ios")]
    {
        assert!(std::env::var("SIMULATOR_UDID").is_ok());
        let peer: std::net::IpAddr = std::env::args().nth(1).expect("numeric peer required").parse().expect("invalid numeric peer");
        let supported = route::supported(peer);
        let (opened, source) = route::inspect(peer);
        let source = source.map_or("null".to_owned(), |ip| format!("\"{ip}\""));
        println!("{{\"addressSupported\":{supported},\"routeOpened\":{opened},\"source\":{source},\"socketOpened\":false,\"credentialsReleased\":false}}");
    }
}
