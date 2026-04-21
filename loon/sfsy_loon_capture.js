/*
Minimal SFSY capture script for Loon (TrollStore users).
No lock. No dedup. Notify every successful capture.
*/

var STORE_KEY = "sfsy_cookie";
var TARGET_HOST = "mcs-mimp-web.sf-express.com";
var NEED_KEYS = ["sessionId", "_login_mobile_", "_login_user_id_"];

function done(body) {
  if (body) {
    $done({ body: body });
  } else {
    $done({});
  }
}

function getHeader(headers, key) {
  if (!headers) return "";
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "";
}

function parseCookie(str) {
  var out = {};
  if (!str) return out;
  var arr = String(str).split(";");
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i];
    var idx = p.indexOf("=");
    if (idx < 0) continue;
    var k = p.slice(0, idx).trim();
    var v = p.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function parseSetCookie(v) {
  var out = {};
  if (!v) return out;
  var lines = Array.isArray(v) ? v : [v];
  for (var i = 0; i < lines.length; i++) {
    var first = String(lines[i]).split(";")[0];
    var idx = first.indexOf("=");
    if (idx < 0) continue;
    var k = first.slice(0, idx).trim();
    var val = first.slice(idx + 1).trim();
    if (k) out[k] = val;
  }
  return out;
}

function merge(a, b) {
  var r = {};
  var k;
  for (k in a) if (a[k]) r[k] = a[k];
  for (k in b) if (b[k]) r[k] = b[k];
  return r;
}

function hasNeed(obj) {
  for (var i = 0; i < NEED_KEYS.length; i++) {
    if (!obj[NEED_KEYS[i]]) return false;
  }
  return true;
}

function buildValue(obj) {
  return "sessionId=" + (obj.sessionId || "") + ";_login_mobile_=" + (obj._login_mobile_ || "") + ";_login_user_id_=" + (obj._login_user_id_ || "");
}

function notify(title, sub, msg) {
  if (typeof $notification !== "undefined") {
    $notification.post(title, sub, msg);
  }
}

try {
  var req = typeof $request !== "undefined" ? $request : null;
  var res = typeof $response !== "undefined" ? $response : null;

  var reqHeaders = (req && req.headers) || {};
  var resHeaders = (res && res.headers) || {};

  var reqUrl = (req && req.url) || "";
  var resUrl = (res && res.url) || "";
  var url = reqUrl || resUrl || "";

  // Match by URL or Host header, improves compatibility in request/response hooks.
  var hostFromReq = String(getHeader(reqHeaders, "Host") || getHeader(reqHeaders, ":authority") || "").toLowerCase();
  var hostFromRes = String(getHeader(resHeaders, "Host") || getHeader(resHeaders, ":authority") || "").toLowerCase();
  if (url.indexOf(TARGET_HOST) < 0 && hostFromReq !== TARGET_HOST && hostFromRes !== TARGET_HOST) {
    return done();
  }

  var saved = parseCookie($persistentStore.read(STORE_KEY) || "");
  var reqCookie = parseCookie(getHeader(reqHeaders, "Cookie"));
  var resCookie = parseCookie(getHeader(resHeaders, "Cookie"));
  var setCookie = parseSetCookie(getHeader(resHeaders, "Set-Cookie"));

  var merged = merge(saved, reqCookie);
  merged = merge(merged, resCookie);
  merged = merge(merged, setCookie);

  if (!hasNeed(merged)) {
    notify("SFSY hit", "Cookie not complete yet", "Go to SF mini app member/integral page and retry");
    return done({ sfsy_capture: false, reason: "cookie_incomplete" });
  }

  var sfsyUrl = buildValue(merged);
  $persistentStore.write(sfsyUrl, STORE_KEY);

  notify("SFSY Capture OK", "Copied to persistent store key: sfsy_cookie", sfsyUrl);
  return done({ sfsy_capture: true, sfsyUrl: sfsyUrl });
} catch (e) {
  notify("SFSY Capture Failed", "Script error", String(e));
  return done();
}
