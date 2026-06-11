import React, { useId } from "react";
import Svg, {
  Rect,
  Circle,
  Line,
  Path,
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Polygon,
} from "react-native-svg";

const DESIGN_NAMES = [
  "retroWave",
  "tidalWave",
  "sunburst",
  "botanical",
  "cosmos",
  "geometric",
  "typographic",
] as const;
export type DesignName = (typeof DESIGN_NAMES)[number];

export function getDesignNameForIndex(i: number): DesignName {
  return DESIGN_NAMES[((i % DESIGN_NAMES.length) + DESIGN_NAMES.length) % DESIGN_NAMES.length];
}

export type CoverProps = { size: number; accentColor: string };

const RetroWave = React.memo(function RetroWave({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  const sun = `sun${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#15101e" />
          <Stop offset="0.5" stopColor={accentColor} stopOpacity="0.35" />
          <Stop offset="1" stopColor="#0a0612" />
        </SvgLinearGradient>
        <RadialGradient id={sun} cx="50" cy="48" rx="32" ry="32">
          <Stop offset="0" stopColor={accentColor} stopOpacity="0.9" />
          <Stop offset="0.55" stopColor={accentColor} stopOpacity="0.2" />
          <Stop offset="1" stopColor={accentColor} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      <Circle cx={50} cy={48} r={28} fill={`url(#${sun})`} />
      <Line x1={10} y1={56} x2={90} y2={56} stroke={accentColor} strokeOpacity={0.5} strokeWidth={0.5} />
      <Line x1={14} y1={62} x2={86} y2={62} stroke={accentColor} strokeOpacity={0.25} strokeWidth={0.4} />
      <Line x1={18} y1={68} x2={82} y2={68} stroke={accentColor} strokeOpacity={0.15} strokeWidth={0.3} />
    </Svg>
  );
});

const TidalWave = React.memo(function TidalWave({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a1220" />
          <Stop offset="1" stopColor="#04080f" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Path
          key={i}
          d={`M -5 ${48 + i * 8} Q 25 ${36 + i * 6} 50 ${48 + i * 8} T 105 ${48 + i * 8}`}
          stroke={accentColor}
          strokeOpacity={0.18 + i * 0.08}
          strokeWidth={0.7 + i * 0.15}
          fill="none"
        />
      ))}
      <Circle cx={78} cy={22} r={6} fill={accentColor} fillOpacity={0.18} stroke={accentColor} strokeOpacity={0.4} strokeWidth={0.4} />
    </Svg>
  );
});

const Sunburst = React.memo(function Sunburst({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={bg} cx="50" cy="50" rx="70" ry="70">
          <Stop offset="0" stopColor={accentColor} stopOpacity="0.55" />
          <Stop offset="0.55" stopColor="#1a1208" />
          <Stop offset="1" stopColor="#06030a" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      {[1, 2, 3, 4, 5].map((i) => (
        <Circle
          key={i}
          cx={50}
          cy={50}
          r={i * 9}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.04 + i * 0.025}
          strokeWidth={0.4}
        />
      ))}
      <Circle cx={50} cy={50} r={1.5} fill="#fff" fillOpacity={0.7} />
    </Svg>
  );
});

const Botanical = React.memo(function Botanical({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#06180c" />
          <Stop offset="1" stopColor="#02080a" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Path
          key={i}
          d={`M -5 ${20 + i * 12} C 30 ${5 + i * 14}, 70 ${50 + i * 8}, 105 ${25 + i * 14}`}
          stroke={accentColor}
          strokeOpacity={0.12 + i * 0.06}
          strokeWidth={0.6 + i * 0.18}
          fill="none"
        />
      ))}
      <Circle cx={82} cy={20} r={5} fill={accentColor} fillOpacity={0.22} />
    </Svg>
  );
});

const Cosmos = React.memo(function Cosmos({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glow = `glow${uid}`;
  // Deterministic stars (no Math.random in render)
  const stars = React.useMemo(
    () =>
      [...Array(28)].map((_, i) => {
        const a = (i * 49) % 100;
        const b = (i * 31 + 17) % 100;
        const r = ((i * 7) % 10) < 2 ? 0.55 : 0.3;
        const op = 0.25 + (((i * 13) % 60) / 100);
        return { x: a, y: b, r, op };
      }),
    [],
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={glow} cx="40" cy="42" rx="42" ry="42">
          <Stop offset="0" stopColor={accentColor} stopOpacity="0.35" />
          <Stop offset="0.6" stopColor={accentColor} stopOpacity="0.06" />
          <Stop offset="1" stopColor={accentColor} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="#050008" />
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${glow})`} />
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity={s.op} />
      ))}
      <Circle cx={50} cy={48} r={20} fill="none" stroke={accentColor} strokeOpacity={0.25} strokeWidth={0.5} />
    </Svg>
  );
});

const Geometric = React.memo(function Geometric({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#06182a" />
          <Stop offset="1" stopColor="#02060c" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      <Polygon points="50,18 80,72 20,72" fill="none" stroke={accentColor} strokeOpacity={0.45} strokeWidth={0.7} />
      <Polygon points="50,32 68,66 32,66" fill="none" stroke={accentColor} strokeOpacity={0.25} strokeWidth={0.5} />
      {[
        [50, 18],
        [80, 72],
        [20, 72],
      ].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.6} fill={accentColor} fillOpacity={0.85} />
      ))}
    </Svg>
  );
});

const Typographic = React.memo(function Typographic({ size, accentColor }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#100408" />
          <Stop offset="1" stopColor="#06010a" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${bg})`} />
      {/* abstract glyph: oversized circle + diagonal */}
      <Circle cx={42} cy={48} r={26} fill={accentColor} fillOpacity={0.12} />
      <Circle cx={42} cy={48} r={26} fill="none" stroke={accentColor} strokeOpacity={0.35} strokeWidth={0.6} />
      <Line x1={14} y1={78} x2={86} y2={78} stroke={accentColor} strokeOpacity={0.4} strokeWidth={0.5} />
      <Rect x={70} y={20} width={14} height={14} fill="none" stroke={accentColor} strokeOpacity={0.3} strokeWidth={0.5} />
    </Svg>
  );
});

const COMPONENTS: Record<DesignName, React.ComponentType<CoverProps>> = {
  retroWave: RetroWave,
  tidalWave: TidalWave,
  sunburst: Sunburst,
  botanical: Botanical,
  cosmos: Cosmos,
  geometric: Geometric,
  typographic: Typographic,
};

export function VinylCover({
  size,
  accentColor,
  designIndex,
}: {
  size: number;
  accentColor: string;
  designIndex: number;
}) {
  const Comp = COMPONENTS[getDesignNameForIndex(designIndex)];
  return <Comp size={size} accentColor={accentColor} />;
}
