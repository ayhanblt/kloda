// Step19 Xcode project wiring for plugins/with-live-activity.cjs: the KlodaLiveActivity widget extension target,
// its embed phase, and the intents/strings it shares with the app target. Explicit objects; idempotent per prebuild.
module.exports = function liveActivityXcode(project, options) {
  const objects = project.hash.project.objects;
  const quote = (value) => `"${value}"`;
  function add(section, object, comment) {
    const id = project.generateUuid();
    objects[section] ??= {};
    objects[section][id] = object;
    objects[section][`${id}_comment`] = comment;
    return id;
  }
  if (Object.values(objects.PBXNativeTarget).some((t) => typeof t === 'object' && t.name?.replace(/"/g, '') === options.name)) return;

  const type = (file) => ({ '.swift': 'sourcecode.swift', '.plist': 'text.plist.xml', '.xcassets': 'folder.assetcatalog',
    '.ttf': 'file', '.strings': 'text.plist.strings' }[file.slice(file.lastIndexOf('.'))]);
  const fileRef = (file) => ({ id: add('PBXFileReference', { isa: 'PBXFileReference', lastKnownFileType: type(file), path: quote(file),
    sourceTree: quote('<group>') }, file), name: file });
  const build = (ref, phase) => ({ id: add('PBXBuildFile', { isa: 'PBXBuildFile', fileRef: ref.id, fileRef_comment: ref.name },
    `${ref.name} in ${phase}`), name: ref.name });
  const phase = (isa, comment, refs) => add(isa, { isa, buildActionMask: 2147483647,
    files: refs.map((ref) => { const file = build(ref, comment); return { value: file.id, comment: `${file.name} in ${comment}` }; }),
    runOnlyForDeploymentPostprocessing: 0 }, comment);
  function strings() {
    const children = options.languages.map((language) => ({ value: add('PBXFileReference', { isa: 'PBXFileReference',
      lastKnownFileType: 'text.plist.strings', name: language, path: quote(`${language}.lproj/KlodaLiveActivity.strings`),
      sourceTree: quote('<group>') }, language), comment: language }));
    return { id: add('PBXVariantGroup', { isa: 'PBXVariantGroup', children, name: 'KlodaLiveActivity.strings',
      sourceTree: quote('<group>') }, 'KlodaLiveActivity.strings'), name: 'KlodaLiveActivity.strings' };
  }
  function group(name, refs) {
    const id = add('PBXGroup', { isa: 'PBXGroup', children: refs.map((ref) => ({ value: ref.id, comment: ref.name })),
      path: name, sourceTree: quote('<group>') }, name);
    const root = objects.PBXGroup[project.getFirstProject().firstProject.mainGroup];
    root.children.push({ value: id, comment: name });
  }
  for (const language of options.languages) project.addKnownRegion(language);

  // App target: intents (LiveActivityIntent runs in the app process) and their localized titles.
  const app = project.getFirstTarget();
  const appRefs = options.appSources.map(fileRef);
  const appStrings = strings();
  group(options.appGroup, [...appRefs, appStrings]);
  const appPhase = (isa) => objects[isa][app.firstTarget.buildPhases.find((p) => objects[isa]?.[p.value])?.value];
  for (const ref of appRefs) appPhase('PBXSourcesBuildPhase').files.push({ value: build(ref, 'Sources').id, comment: `${ref.name} in Sources` });
  appPhase('PBXResourcesBuildPhase').files.push({ value: build(appStrings, 'Resources').id, comment: 'KlodaLiveActivity.strings in Resources' });

  // Widget extension target, embedded into the app by addTarget's Copy Files (PlugIns) phase.
  const target = project.addTarget(options.name, 'app_extension', options.name, options.bundleId);
  const sources = options.extensionSources.map(fileRef);
  const resources = ['Assets.xcassets', ...options.fonts].map(fileRef);
  const extensionStrings = strings();
  group(options.name, [...sources, ...resources, extensionStrings, fileRef('Info.plist')]);
  const native = objects.PBXNativeTarget[target.uuid];
  native.buildPhases.push(
    { value: phase('PBXSourcesBuildPhase', 'Sources', sources), comment: 'Sources' },
    { value: phase('PBXFrameworksBuildPhase', 'Frameworks', []), comment: 'Frameworks' },
    { value: phase('PBXResourcesBuildPhase', 'Resources', [...resources, extensionStrings]), comment: 'Resources' });
  const appSettings = Object.values(objects.XCBuildConfiguration).find((c) => typeof c === 'object'
    && c.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER?.replace(/"/g, '') === options.bundleId.replace(/\.LiveActivity$/, ''))?.buildSettings ?? {};
  const list = objects.XCConfigurationList[native.buildConfigurationList];
  for (const { value } of list.buildConfigurations) {
    Object.assign(objects.XCBuildConfiguration[value].buildSettings, {
      INFOPLIST_FILE: quote(`${options.name}/Info.plist`), PRODUCT_BUNDLE_IDENTIFIER: quote(options.bundleId),
      PRODUCT_NAME: quote(options.name), SWIFT_VERSION: '5.0', IPHONEOS_DEPLOYMENT_TARGET: options.deploymentTarget,
      TARGETED_DEVICE_FAMILY: quote('1,2'), SDKROOT: 'iphoneos', SKIP_INSTALL: 'YES', APPLICATION_EXTENSION_API_ONLY: 'YES',
      CODE_SIGN_STYLE: 'Automatic', MARKETING_VERSION: options.version, CURRENT_PROJECT_VERSION: options.build,
      GENERATE_INFOPLIST_FILE: 'NO', CLANG_ENABLE_MODULES: 'YES', SWIFT_EMIT_LOC_STRINGS: 'YES',
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: quote(''), ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: quote(''),
      LD_RUNPATH_SEARCH_PATHS: quote('$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'),
      ...(appSettings.DEVELOPMENT_TEAM ? { DEVELOPMENT_TEAM: appSettings.DEVELOPMENT_TEAM } : {}),
    });
  }
  const attributes = objects.PBXProject[project.getFirstProject().uuid].attributes;
  attributes.TargetAttributes ??= {};
  attributes.TargetAttributes[target.uuid] = { CreatedOnToolsVersion: '16.0' };
};
