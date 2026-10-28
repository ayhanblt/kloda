import Foundation
import Photos
import AVFoundation
import CoreVideo

extension IosPhotosLibraryChecks {
  static func runVideo() throws {
    let journal = try IosSyncJournal(), snapshots = try IosFilesSnapshot()
    let baseline = PHAsset.fetchAssets(with: nil).count
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: 64, AVVideoHeightKey: 64])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
      sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
        kCVPixelBufferWidthKey as String: 64, kCVPixelBufferHeightKey as String: 64])
    try require(writer.canAdd(input), "video input"); writer.add(input)
    try require(writer.startWriting(), "video writer start"); writer.startSession(atSourceTime: .zero)
    var pixel: CVPixelBuffer?
    try require(CVPixelBufferCreate(kCFAllocatorDefault, 64, 64, kCVPixelFormatType_32ARGB, nil, &pixel) == kCVReturnSuccess, "pixel buffer")
    CVPixelBufferLockBaseAddress(pixel!, [])
    memset(CVPixelBufferGetBaseAddress(pixel!)!, 80, CVPixelBufferGetDataSize(pixel!))
    CVPixelBufferUnlockBaseAddress(pixel!, [])
    let deadline = Date(timeIntervalSinceNow: 10)
    while !input.isReadyForMoreMediaData && Date() < deadline { Thread.sleep(forTimeInterval: 0.01) }
    try require(input.isReadyForMoreMediaData && adaptor.append(pixel!, withPresentationTime: .zero), "video frame")
    input.markAsFinished()
    let finished = DispatchSemaphore(value: 0)
    writer.finishWriting { finished.signal() }
    try require(finished.wait(timeout: .now() + 20) == .success && writer.status == .completed, "video completed")
    var source = ""
    try PHPhotoLibrary.shared().performChangesAndWait {
      let request = PHAssetCreationRequest.forAsset()
      let options = PHAssetResourceCreationOptions(); options.originalFilename = "fixture.mp4"; options.uniformTypeIdentifier = "public.mpeg-4"
      request.addResource(with: .video, fileURL: url, options: options)
      source = request.placeholderForCreatedAsset!.localIdentifier
    }
    try FileManager.default.removeItem(at: url)
    let asset = PHAsset.fetchAssets(withLocalIdentifiers: [source], options: nil).firstObject!
    let exported = try IosPhotosSource.export(asset: asset, check: {}, snapshots: snapshots)
    defer { for resource in exported { try? snapshots.discard(resource.snapshot) } }
    try require(exported.count == 1 && exported[0].role == "resource-2", "video original role")
    let value = exported[0], operation = IosFilesTransfer.identifier()
    let resource = IosPhotoResource(operationId: operation, role: "original", name: value.name,
      mimeType: value.mimeType, sha256: value.sha256, size: value.size)
    let manifest = IosPhotoManifest(sourceDeviceId: "android-contract-video", assetId: IosFilesTransfer.identifier(), revision: 1,
      resources: [resource], albums: [], favorite: false)
    let stage = try snapshots.verifiedURL(value.snapshot, sha256: value.sha256, size: value.size, check: {})
    try IosPhotosImport.importManifest(manifest: manifest, stages: [operation: stage], journal: journal, check: {})
    try IosPhotosImport.importManifest(manifest: manifest, stages: [:], journal: journal, check: {})
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 2, "video repeat duplicate")
    let unsupported = IosPhotoResource(operationId: operation, role: "unknown-platform", name: value.name,
      mimeType: value.mimeType, sha256: value.sha256, size: value.size)
    let invalid = IosPhotoManifest(sourceDeviceId: "android-contract-video", assetId: IosFilesTransfer.identifier(), revision: 1,
      resources: [unsupported], albums: [], favorite: nil)
    do { try IosPhotosImport.importManifest(manifest: invalid, stages: [operation: stage], journal: journal, check: {})
      throw NSError(domain: "PhotoChecks", code: 4)
    } catch IosPairingFailure.native(let code) { try require(code == "review_required", "unsupported role review") }
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 2, "unsupported import created media")
    let key = try IosSyncJournal.photoKey([invalid.sourceDeviceId, invalid.assetId])
    let unsupportedIntent = try journal.photoImport(key)!
    try require(unsupportedIntent.state == "prepared" && unsupportedIntent.errorCode == "review_required", "unsupported durable review")
    let retry = IosPhotoManifest(sourceDeviceId: "retry-video", assetId: IosFilesTransfer.identifier(), revision: 1,
      resources: [resource], albums: [], favorite: nil)
    do { try IosPhotosImport.importManifest(manifest: retry, stages: [:], journal: journal, check: {})
      throw NSError(domain: "PhotoChecks", code: 7)
    } catch IosPairingFailure.native(let code) { try require(code == "review_required", "known preflight failure") }
    let retryKey = try IosSyncJournal.photoKey([retry.sourceDeviceId, retry.assetId])
    try require(try journal.photoImport(retryKey)?.state == "prepared", "preflight poisoned retry")
    try IosPhotosImport.importManifest(manifest: retry, stages: [operation: stage], journal: journal, check: {})
    try require(try journal.photoImport(retryKey)?.state == "completed", "preflight retry not completed")
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 3, "preflight retry duplicated video")
  }
}
