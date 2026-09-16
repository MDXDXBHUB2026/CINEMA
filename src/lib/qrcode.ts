import QRCode from "qrcode";

/**
 * Renders a ticket's QR payload as a data URL. The payload is just the
 * opaque ticket code — never the customer's name/email/booking total — so
 * scanning it at the door reveals nothing sensitive, per docs/SECURITY.md.
 */
export async function renderTicketQrCode(ticketCode: string): Promise<string> {
  return QRCode.toDataURL(ticketCode, { margin: 1, width: 240, color: { dark: "#0b0b0f", light: "#f4f3f7" } });
}
