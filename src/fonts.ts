import {continueRender, delayRender, staticFile} from 'remotion';

const faces: [string, string][] = [
  ['Inter Tight Black', 'fonts/InterTight-Black.ttf'],
  ['Inter Tight Light', 'fonts/InterTight-Light.ttf'],
  ['JetBrains Mono', 'fonts/JetBrainsMono-Medium.ttf'],
];

let loaded = false;

export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Loading fonts');
  Promise.all(
    faces.map(([family, file]) =>
      new FontFace(family, `url(${staticFile(file)})`).load().then((f) => (document.fonts as unknown as Set<FontFace>).add(f)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
