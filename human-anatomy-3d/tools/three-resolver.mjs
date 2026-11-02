export async function resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../lib/three.module.js', import.meta.url).href, context);
  return next(specifier, context);
}
