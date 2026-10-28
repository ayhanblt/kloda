import Network
// SDK availability only: never invoked, no connection started and no route evidence claimed.
func checkLegacyParameters(_ interface: NWInterface) -> NWParameters {
  let parameters = NWParameters.tcp
  parameters.requiredInterface = interface
  parameters.requiredInterfaceType = interface.type
  return parameters
}
func checkPerConnectionPath(_ connection: NWConnection) -> NWPath? { connection.currentPath }
func checkInterfaceClass(_ path: NWPath) -> Bool {
  path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet)
}
