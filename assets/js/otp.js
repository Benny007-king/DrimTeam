/* ============================================================
   DrimTeam — TOTP (Google Authenticator compatible)
   אימות בצד-לקוח (HMAC-SHA1 דרך Web Crypto).
   הערה: שכבת אבטחה נוספת מעל סיסמת Firebase; אכיפת MFA אמיתית
   בצד-שרת דורשת Identity Platform.
   ============================================================ */
(function () {
  "use strict";
  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function base32ToBytes(b32) {
    b32 = (b32 || "").toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < b32.length; i++) {
      var idx = ALPHA.indexOf(b32[i]); if (idx < 0) continue;
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return new Uint8Array(out);
  }

  function hotp(keyBytes, counter) {
    var buf = new ArrayBuffer(8), dv = new DataView(buf);
    dv.setUint32(0, Math.floor(counter / 0x100000000));
    dv.setUint32(4, counter >>> 0);
    return crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
      .then(function (key) { return crypto.subtle.sign("HMAC", key, buf); })
      .then(function (sigBuf) {
        var sig = new Uint8Array(sigBuf);
        var off = sig[19] & 0xf;
        var code = ((sig[off] & 0x7f) << 24) | ((sig[off + 1] & 0xff) << 16) | ((sig[off + 2] & 0xff) << 8) | (sig[off + 3] & 0xff);
        return ("00000" + (code % 1000000)).slice(-6);
      });
  }

  function totp(secretB32, t) {
    var counter = Math.floor((t || Date.now()) / 1000 / 30);
    return hotp(base32ToBytes(secretB32), counter);
  }

  function verify(secretB32, code) {
    code = (code || "").trim();
    var counter = Math.floor(Date.now() / 1000 / 30);
    var key = base32ToBytes(secretB32);
    // בודקים חלון של ±1 (סטיית שעון)
    return hotp(key, counter).then(function (c0) {
      if (c0 === code) return true;
      return hotp(key, counter - 1).then(function (c1) {
        if (c1 === code) return true;
        return hotp(key, counter + 1).then(function (c2) { return c2 === code; });
      });
    });
  }

  function genSecret() {
    var bytes = crypto.getRandomValues(new Uint8Array(20));
    var bits = 0, value = 0, out = "";
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
    return out;
  }

  function otpauthURL(label, secret) {
    return "otpauth://totp/DrimTeam:" + encodeURIComponent(label) +
      "?secret=" + secret + "&issuer=DrimTeam&period=30&digits=6&algorithm=SHA1";
  }
  function qrURL(otpauth) {
    return "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent(otpauth);
  }

  window.OTP = { base32ToBytes: base32ToBytes, hotp: hotp, totp: totp, verify: verify, genSecret: genSecret, otpauthURL: otpauthURL, qrURL: qrURL };
})();
