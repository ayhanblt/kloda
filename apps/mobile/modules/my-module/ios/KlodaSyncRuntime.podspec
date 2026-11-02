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
  s.frameworks = 'Security', 'Network', 'SystemConfiguration'
  s.vendored_frameworks = 'NativePairing/KlodaPairingNative.xcframework'

  # Swift/Objective-C compatibility
  target_config = {
    'DEFINES_MODULE' => 'YES',
  }

  frameworks = ['NativePairing/KlodaPairingNative.xcframework']
  conditions = []
  if ENV['KLODA_SMB_NATIVE'] == '1'
    frameworks << 'NativeStorage/KlodaStorageNative.xcframework'
    conditions << 'KLODA_SMB_NATIVE'
  end
  if ENV['KLODA_SFTP_NATIVE'] == '1'
    frameworks << 'NativeSftp/KlodaSftpNative.xcframework'
    conditions << 'KLODA_SFTP_NATIVE'
  end
  s.vendored_frameworks = frameworks
  target_config['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) ' + conditions.join(' ') unless conditions.empty?

  s.pod_target_xcconfig = target_config

  s.source_files = ['*.swift', 'NativePairing/*.swift', 'NativePairing/KlodaPairingNative.h']
  s.public_header_files = 'NativePairing/KlodaPairingNative.h'
end
