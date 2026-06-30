const add32 = (a: number, b: number): number => {
  return (a + b) & 0xffffffff;
};

const rotateLeft = (value: number, shift: number): number => {
  return (value << shift) | (value >>> (32 - shift));
};

const cmn = (
  q: number,
  a: number,
  b: number,
  x: number,
  s: number,
  t: number
): number => {
  return add32(rotateLeft(add32(add32(a, q), add32(x, t)), s), b);
};

const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number =>
  cmn((b & c) | (~b & d), a, b, x, s, t);

const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number =>
  cmn((b & d) | (c & ~d), a, b, x, s, t);

const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number =>
  cmn(b ^ c ^ d, a, b, x, s, t);

const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number =>
  cmn(c ^ (b | ~d), a, b, x, s, t);

const md5Cycle = (state: [number, number, number, number], block: number[]): void => {
  let [a, b, c, d] = state;

  a = ff(a, b, c, d, block[0] ?? 0, 7, -680876936);
  d = ff(d, a, b, c, block[1] ?? 0, 12, -389564586);
  c = ff(c, d, a, b, block[2] ?? 0, 17, 606105819);
  b = ff(b, c, d, a, block[3] ?? 0, 22, -1044525330);
  a = ff(a, b, c, d, block[4] ?? 0, 7, -176418897);
  d = ff(d, a, b, c, block[5] ?? 0, 12, 1200080426);
  c = ff(c, d, a, b, block[6] ?? 0, 17, -1473231341);
  b = ff(b, c, d, a, block[7] ?? 0, 22, -45705983);
  a = ff(a, b, c, d, block[8] ?? 0, 7, 1770035416);
  d = ff(d, a, b, c, block[9] ?? 0, 12, -1958414417);
  c = ff(c, d, a, b, block[10] ?? 0, 17, -42063);
  b = ff(b, c, d, a, block[11] ?? 0, 22, -1990404162);
  a = ff(a, b, c, d, block[12] ?? 0, 7, 1804603682);
  d = ff(d, a, b, c, block[13] ?? 0, 12, -40341101);
  c = ff(c, d, a, b, block[14] ?? 0, 17, -1502002290);
  b = ff(b, c, d, a, block[15] ?? 0, 22, 1236535329);

  a = gg(a, b, c, d, block[1] ?? 0, 5, -165796510);
  d = gg(d, a, b, c, block[6] ?? 0, 9, -1069501632);
  c = gg(c, d, a, b, block[11] ?? 0, 14, 643717713);
  b = gg(b, c, d, a, block[0] ?? 0, 20, -373897302);
  a = gg(a, b, c, d, block[5] ?? 0, 5, -701558691);
  d = gg(d, a, b, c, block[10] ?? 0, 9, 38016083);
  c = gg(c, d, a, b, block[15] ?? 0, 14, -660478335);
  b = gg(b, c, d, a, block[4] ?? 0, 20, -405537848);
  a = gg(a, b, c, d, block[9] ?? 0, 5, 568446438);
  d = gg(d, a, b, c, block[14] ?? 0, 9, -1019803690);
  c = gg(c, d, a, b, block[3] ?? 0, 14, -187363961);
  b = gg(b, c, d, a, block[8] ?? 0, 20, 1163531501);
  a = gg(a, b, c, d, block[13] ?? 0, 5, -1444681467);
  d = gg(d, a, b, c, block[2] ?? 0, 9, -51403784);
  c = gg(c, d, a, b, block[7] ?? 0, 14, 1735328473);
  b = gg(b, c, d, a, block[12] ?? 0, 20, -1926607734);

  a = hh(a, b, c, d, block[5] ?? 0, 4, -378558);
  d = hh(d, a, b, c, block[8] ?? 0, 11, -2022574463);
  c = hh(c, d, a, b, block[11] ?? 0, 16, 1839030562);
  b = hh(b, c, d, a, block[14] ?? 0, 23, -35309556);
  a = hh(a, b, c, d, block[1] ?? 0, 4, -1530992060);
  d = hh(d, a, b, c, block[4] ?? 0, 11, 1272893353);
  c = hh(c, d, a, b, block[7] ?? 0, 16, -155497632);
  b = hh(b, c, d, a, block[10] ?? 0, 23, -1094730640);
  a = hh(a, b, c, d, block[13] ?? 0, 4, 681279174);
  d = hh(d, a, b, c, block[0] ?? 0, 11, -358537222);
  c = hh(c, d, a, b, block[3] ?? 0, 16, -722521979);
  b = hh(b, c, d, a, block[6] ?? 0, 23, 76029189);
  a = hh(a, b, c, d, block[9] ?? 0, 4, -640364487);
  d = hh(d, a, b, c, block[12] ?? 0, 11, -421815835);
  c = hh(c, d, a, b, block[15] ?? 0, 16, 530742520);
  b = hh(b, c, d, a, block[2] ?? 0, 23, -995338651);

  a = ii(a, b, c, d, block[0] ?? 0, 6, -198630844);
  d = ii(d, a, b, c, block[7] ?? 0, 10, 1126891415);
  c = ii(c, d, a, b, block[14] ?? 0, 15, -1416354905);
  b = ii(b, c, d, a, block[5] ?? 0, 21, -57434055);
  a = ii(a, b, c, d, block[12] ?? 0, 6, 1700485571);
  d = ii(d, a, b, c, block[3] ?? 0, 10, -1894986606);
  c = ii(c, d, a, b, block[10] ?? 0, 15, -1051523);
  b = ii(b, c, d, a, block[1] ?? 0, 21, -2054922799);
  a = ii(a, b, c, d, block[8] ?? 0, 6, 1873313359);
  d = ii(d, a, b, c, block[15] ?? 0, 10, -30611744);
  c = ii(c, d, a, b, block[6] ?? 0, 15, -1560198380);
  b = ii(b, c, d, a, block[13] ?? 0, 21, 1309151649);
  a = ii(a, b, c, d, block[4] ?? 0, 6, -145523070);
  d = ii(d, a, b, c, block[11] ?? 0, 10, -1120210379);
  c = ii(c, d, a, b, block[2] ?? 0, 15, 718787259);
  b = ii(b, c, d, a, block[9] ?? 0, 21, -343485551);

  state[0] = add32(a, state[0]);
  state[1] = add32(b, state[1]);
  state[2] = add32(c, state[2]);
  state[3] = add32(d, state[3]);
};

const createBlock = (bytes: Uint8Array, offset: number): number[] => {
  const block = new Array<number>(16).fill(0);
  for (let index = 0; index < 16; index += 1) {
    const base = offset + index * 4;
    block[index] =
      (bytes[base] ?? 0) |
      ((bytes[base + 1] ?? 0) << 8) |
      ((bytes[base + 2] ?? 0) << 16) |
      ((bytes[base + 3] ?? 0) << 24);
  }
  return block;
};

const toHex = (value: number): string => {
  let output = '';
  for (let index = 0; index < 4; index += 1) {
    const byte = (value >> (index * 8)) & 0xff;
    output += byte.toString(16).padStart(2, '0');
  }
  return output;
};

export const computeMd5Hex = (bytes: Uint8Array): string => {
  const state: [number, number, number, number] = [
    1732584193,
    -271733879,
    -1732584194,
    271733878,
  ];

  let offset = 0;
  for (; offset + 64 <= bytes.length; offset += 64) {
    md5Cycle(state, createBlock(bytes, offset));
  }

  const tail = new Array<number>(16).fill(0);
  let tailIndex = 0;
  for (; offset < bytes.length; offset += 1) {
    const wordIndex = tailIndex >> 2;
    tail[wordIndex] = (tail[wordIndex] ?? 0) | ((bytes[offset] ?? 0) << ((tailIndex % 4) * 8));
    tailIndex += 1;
  }
  const paddingIndex = tailIndex >> 2;
  tail[paddingIndex] = (tail[paddingIndex] ?? 0) | (0x80 << ((tailIndex % 4) * 8));

  if (tailIndex > 55) {
    md5Cycle(state, tail);
    tail.fill(0);
  }

  const bitLength = bytes.length * 8;
  tail[14] = bitLength & 0xffffffff;
  tail[15] = Math.floor(bitLength / 0x100000000);
  md5Cycle(state, tail);

  return state.map(toHex).join('');
};
