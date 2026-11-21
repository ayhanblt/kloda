# Stage the scratch-mirror Xcode project for the 2.5 capture fixture (D25-M).
# Usage: ruby ios_fixture.rb stage_project <mirror.xcodeproj> <bundle> <Info.plist> <xml> <der>
# Only the app target's build settings and its extension embed phase are changed, and only
# in the scratch copy; the product project is never opened for writing.
require 'json'
require 'xcodeproj'

APP_TARGET = 'KlodaSecurePhotosSync'.freeze
EXTENSION = 'KlodaLiveActivity.appex'.freeze

def sectcreate_flags(xml, der)
  [['__entitlements', xml], ['__ents_der', der]].flat_map do |section, path|
    ['-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', section, '-Xlinker', path]
  end
end

def configure(config, bundle, plist, flags)
  settings = config.build_settings
  inherited = Array(settings['OTHER_LDFLAGS'] || ['$(inherited)'])
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle
  settings['INFOPLIST_FILE'] = plist
  settings.delete('CODE_SIGN_ENTITLEMENTS')
  settings['OTHER_LDFLAGS'] = inherited + flags
  settings['ENABLE_DEBUG_DYLIB'] = 'NO'
  { 'config' => config.name, 'OTHER_LDFLAGS' => settings['OTHER_LDFLAGS'] }
end

def remove_extension_embed(target)
  removed = []
  target.copy_files_build_phases.each do |phase|
    phase.files.select { |file| file.display_name == EXTENSION }.each do |file|
      phase.remove_build_file(file)
      removed << file.display_name
    end
  end
  removed
end

def stage_project(project_path, bundle, plist, xml, der)
  raise "scratch project expected, got product path #{project_path}" unless project_path.include?('/mirror/')

  project = Xcodeproj::Project.open(project_path)
  target = project.targets.find { |candidate| candidate.name == APP_TARGET }
  raise "app target #{APP_TARGET} missing" unless target

  flags = sectcreate_flags(xml, der)
  debug = target.build_configurations.find { |config| config.name == 'Debug' }
  raise 'Debug configuration missing' unless debug

  changed = configure(debug, bundle, plist, flags)
  removed = remove_extension_embed(target)
  raise "extension embed not found: #{EXTENSION}" if removed.empty?

  project.save
  puts JSON.generate('target' => APP_TARGET, 'bundle' => bundle, 'debug' => changed,
                     'removedEmbed' => removed, 'xcodeproj' => Xcodeproj::VERSION)
end

command, *args = ARGV
raise 'usage: ios_fixture.rb stage_project <project> <bundle> <plist> <xml> <der>' unless command == 'stage_project' && args.size == 5

stage_project(*args)
