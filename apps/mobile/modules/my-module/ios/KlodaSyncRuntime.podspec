Pod::Spec.new do |s|
  s.name           = 'KlodaSyncRuntime'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.libraries = 'sqlite3'
  s.frameworks = 'Security', 'Network'
  s.vendored_frameworks = 'NativePairing/KlodaPairingNative.xcframework'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = ['*.swift', 'NativePairing/*.swift', 'NativePairing/KlodaPairingNative.h']
  s.public_header_files = 'NativePairing/KlodaPairingNative.h'
end
