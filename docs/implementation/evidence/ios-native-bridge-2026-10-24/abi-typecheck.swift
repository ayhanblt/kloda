// Declaration compatibility only: no function invocation.
func checkAbiDeclarations() {
  let _: (UnsafePointer<UInt8>?, Int) -> UnsafeMutablePointer<CChar>? = kloda_ios_open
  let _: (UInt64, UnsafePointer<UInt8>?, Int) -> UnsafeMutablePointer<CChar>? = kloda_ios_request
  let _: (UInt64) -> UnsafeMutablePointer<CChar>? = kloda_ios_suspend
  let _: (UInt64, UnsafePointer<UInt8>?, Int, UnsafePointer<UInt8>?, Int, Int32) -> UnsafeMutablePointer<CChar>? = kloda_ios_transfer
  let _: (UnsafeMutablePointer<CChar>?) -> Void = kloda_ios_reply_free
}
