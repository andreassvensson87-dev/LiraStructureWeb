const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
/** Deterministic 128-bit IFC GlobalId, independent of mark, geometry and export order. */
export async function ifcGuid(key) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
  );
  let value = 0n;
  for (const byte of bytes.slice(0, 16)) value = (value << 8n) | BigInt(byte);
  let result = '';
  for (let i = 0; i < 22; i++) {
    result = alphabet[Number(value & 63n)] + result;
    value >>= 6n;
  }
  return result;
}
