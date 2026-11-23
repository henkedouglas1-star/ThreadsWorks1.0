


const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function shortcodeToMediaId(shortcode: string): string | null {
  if (!shortcode) return null;
  try {
    let id = BigInt(0);
    for (let i = 0; i < shortcode.length; i++) {
      const char = shortcode[i];
      const val = alphabet.indexOf(char);
      if (val === -1) return null;
      id = id * BigInt(64) + BigInt(val);
    }
    return id.toString();
  } catch (err) {
    return null;
  }
}

function base64ToId(shortcode: string): string | null {
    try {
        // Add padding if necessary
        let base64 = shortcode.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const buf = Buffer.from(base64, 'base64');
        // Try BigInt from buffer
        let id = BigInt(0);
        for (let i = 0; i < buf.length; i++) {
            id = (id << BigInt(8)) | BigInt(buf[i]);
        }
        return id.toString();
    } catch (err) {
        return null;
    }
}

const alphabet2 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
function shortcodeToMediaId2(shortcode: string): string | null {
  if (!shortcode) return null;
  try {
    let id = BigInt(0);
    for (let i = 0; i < shortcode.length; i++) {
      const char = shortcode[i];
      const val = alphabet2.indexOf(char);
      if (val === -1) return null;
      id = id * BigInt(64) + BigInt(val);
    }
    return id.toString();
  } catch (err) {
    return null;
  }
}

const testShortcodes = [
    "DZ7eGA1G7wU",
    "C-iP5h_M-y_",
    "DeZvGAMmu4D",
    "C0a6r-3rkUa"
];

console.log("--- Comparison ---");
console.log("Expected for DZ7eGA1G7wU: 3925863854786722836");
testShortcodes.forEach(s => {
    console.log(`Shortcode: ${s}`);
    console.log(`  Custom Base64 (A-Z...): ${shortcodeToMediaId(s)}`);
    console.log(`  Custom Base64 (0-9...): ${shortcodeToMediaId2(s)}`);
});
