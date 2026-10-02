import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(4);
Config.setEntryPoint('src/index.ts');
// WebGL (Three.js) in headless Chromium without a GPU: SwiftShader via ANGLE.
Config.setChromiumOpenGlRenderer('swangle');
// Use the preinstalled headless shell when present (sandboxed CI/cloud boxes).
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
