import { MapPin, RoadBand, RoutePath } from '../MapGround';

/** Splash's map content: a road running past the lockup card, drawn on mount. */
export function SplashIllustration() {
  return (
    <>
      <RoadBand left={96} width={16} top={0} bottom={0} />
      <RoadBand top={236} height={22} left={0} right={0} />
      <RoadBand bottom={198} height={14} left={0} right={0} />
      <RoutePath points={[{ x: 104, y: 700 }, { x: 104, y: 246 }, { x: 300, y: 246 }]} />
      <MapPin x={104} y={700} tone="navy" delayMs={150} />
      <MapPin x={300} y={246} tone="green" delayMs={1150} />
    </>
  );
}
