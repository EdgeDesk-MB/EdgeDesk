import { ImageResponse } from "next/og";

export const CREST_LOCKUP_SIZE = { width: 192, height: 192 };
export const CREST_LOCKUP_CONTENT_TYPE = "image/png";

const INK = "#111111";
const RING = "#f5f5f0";
const OUTER = 124;
const INNER = 112;
const HOME = { left: 8, top: 8 };
const AWAY = { left: 60, top: 60 };

function CrestDisc({
  src,
  left,
  top,
}: {
  src: string;
  left: number;
  top: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: OUTER,
        height: OUTER,
        borderRadius: 999,
        background: RING,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: INNER,
          height: INNER,
          borderRadius: 999,
          background: INK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={INNER}
          height={INNER}
          style={{ objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

/** Square lock-up for the Android shade large-icon slot. */
export function renderCrestLockupImage(input: {
  homeLogo?: string | null;
  awayLogo?: string | null;
}): ImageResponse | null {
  const home = input.homeLogo?.trim() || null;
  const away = input.awayLogo?.trim() || null;
  if (!home && !away) return null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: INK,
        }}
      >
        {home ? <CrestDisc src={home} left={HOME.left} top={HOME.top} /> : null}
        {away ? <CrestDisc src={away} left={AWAY.left} top={AWAY.top} /> : null}
      </div>
    ),
    { ...CREST_LOCKUP_SIZE }
  );
}
