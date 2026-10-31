package com.kloda.sync

// Only local MediaStore inputs; protocol receipts/operation IDs stay in their typed restore adapters.
internal interface PhotoMediaResource {
  val role: String
  val name: String
  val mimeType: String
  val sha256: String
  val size: Long
}
internal interface PhotoMediaManifest {
  val sourceDeviceId: String
  val albums: List<PhotoAlbum>
  val favorite: Boolean?
}
internal interface PhotoMediaIntent {
  val resource: PhotoMediaResource
  val manifest: PhotoMediaManifest
  val uri: String?
  val owned: Boolean
  val phase: String
  val folder: String
  val desiredFolder: String
  val name: String
}
