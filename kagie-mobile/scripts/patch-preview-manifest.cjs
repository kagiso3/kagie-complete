/* Parse compiled Android XML; patch only two approved root version attributes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const stage = path.resolve(__dirname, '../.gradle-home/native-preview-audit');
const original = fs.readFileSync(path.join(stage, 'original-AndroidManifest.xml'));
const modified = Buffer.from(original);
const ANDROID = 'http://schemas.android.com/apk/res/android';
assert.equal(original.readUInt16LE(0), 3, 'Compiled Android XML type');
assert.equal(original.readUInt32LE(4), original.length, 'Compiled XML length');
const strings = [], attributes = [];
function sizedLength8(buffer, offset) {
  const first = buffer[offset];
  return first & 0x80 ? { value: ((first & 0x7f) << 8) | buffer[offset + 1], bytes: 2 } : { value: first, bytes: 1 };
}
function sizedLength16(buffer, offset) {
  const first = buffer.readUInt16LE(offset);
  return first & 0x8000 ? { value: ((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2), bytes: 4 } : { value: first, bytes: 2 };
}
for (let chunk = original.readUInt16LE(2); chunk < original.length;) {
  const type = original.readUInt16LE(chunk), header = original.readUInt16LE(chunk + 2), size = original.readUInt32LE(chunk + 4);
  assert.ok(header >= 8 && size >= header && chunk + size <= original.length, 'Bounded XML chunk');
  if (type === 1) {
    assert.equal(strings.length, 0, 'Single string pool');
    const count = original.readUInt32LE(chunk + 8), utf8 = Boolean(original.readUInt32LE(chunk + 16) & 0x100);
    const dataStart = chunk + original.readUInt32LE(chunk + 20);
    for (let index = 0; index < count; index++) {
      let cursor = dataStart + original.readUInt32LE(chunk + header + index * 4);
      const length = utf8 ? sizedLength8(original, cursor) : sizedLength16(original, cursor); cursor += length.bytes;
      const bytesLength = utf8 ? sizedLength8(original, cursor) : { value: length.value * 2, bytes: 0 }; cursor += bytesLength.bytes;
      assert.ok(cursor + bytesLength.value <= chunk + size, 'Bounded string data');
      const encoding = utf8 ? 'utf8' : 'utf16le';
      strings.push({ value: original.toString(encoding, cursor, cursor + bytesLength.value), offset: cursor, bytes: bytesLength.value, encoding, characters: length.value });
    }
  }
  if (type === 0x102) {
    assert.ok(strings.length, 'String pool precedes elements');
    const element = strings[original.readUInt32LE(chunk + 20)].value;
    const start = chunk + 16 + original.readUInt16LE(chunk + 24), stride = original.readUInt16LE(chunk + 26), count = original.readUInt16LE(chunk + 28);
    assert.ok(stride >= 20 && start + count * stride <= chunk + size, 'Bounded attribute array');
    for (let index = 0; index < count; index++) {
      const offset = start + index * stride, namespaceIndex = original.readUInt32LE(offset), nameIndex = original.readUInt32LE(offset + 4);
      attributes.push({ element, namespace: namespaceIndex === 0xffffffff ? '' : strings[namespaceIndex].value, name: strings[nameIndex].value,
        offset, raw: original.readUInt32LE(offset + 8), type: original[offset + 15], data: original.readUInt32LE(offset + 16) });
    }
  }
  chunk += size;
}
const find = name => {
  const matches = attributes.filter(item => item.element === 'manifest' && item.namespace === ANDROID && item.name === name);
  assert.equal(matches.length, 1, 'One root Android ' + name); return matches[0];
};
const code = find('versionCode'), name = find('versionName');
assert.equal(code.type, 0x10, 'Version code is a decimal integer'); assert.equal(code.data, 7, 'Expected audited base version code');
assert.equal(name.type, 3, 'Version name is a pool string'); assert.equal(name.raw, name.data, 'Version name raw and typed values agree');
const version = strings[name.data]; assert.equal(version.value, '1.2.0', 'Expected audited base version name');
assert.equal(attributes.filter(item => item.type === 3 && item.data === name.data || item.raw === name.data).length, 1, 'Version string is not shared by another attribute');
const replacement = Buffer.from('1.2.2', version.encoding); assert.equal(replacement.length, version.bytes, 'Version name keeps compiled pool size');
assert.equal('1.2.2'.length, version.characters, 'Version name keeps compiled character count');
modified.writeUInt32LE(9, code.offset + 16); replacement.copy(modified, version.offset);
const allowed = [[code.offset + 16, code.offset + 20], [version.offset, version.offset + version.bytes]];
let changedBytes = 0;
for (let index = 0; index < original.length; index++) if (original[index] !== modified[index]) {
  assert.ok(allowed.some(([start, end]) => index >= start && index < end), 'Only approved attribute data changed'); changedBytes++;
}
assert.ok(changedBytes > 0);
fs.writeFileSync(path.join(stage, 'preview-AndroidManifest.xml'), modified);
const evidence = { parser: 'Compiled XML chunks, Android namespaces, typed attributes and string-pool lengths', originalVersionCode: 7, previewVersionCode: 9, originalVersionName: version.value, previewVersionName: '1.2.2', originalBytes: original.length, previewBytes: modified.length, changedBytes, approvedByteRegions: allowed };
fs.writeFileSync(path.resolve(__dirname, '../../reports/auth-google/preview-manifest-patch.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
