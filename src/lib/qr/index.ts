import "server-only";
import QRCode from "qrcode";

/**
 * Renders an opaque QR payload to a standalone, scalable SVG string.
 *
 * Black-on-white at error-correction level M — the highest-contrast, most
 * forgiving combination for both cheap thermal-printed ID cards and phone-camera
 * scanning. The SVG carries no fixed pixel size, so callers size it with CSS.
 */
export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
