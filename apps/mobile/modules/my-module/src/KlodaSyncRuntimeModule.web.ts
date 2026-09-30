import { registerWebModule, NativeModule } from 'expo';

// KlodaSyncRuntimeModule is not available on the web platform.
class KlodaSyncRuntimeModule extends NativeModule<{}> {}

export default registerWebModule(KlodaSyncRuntimeModule, 'KlodaSyncRuntimeModule');
