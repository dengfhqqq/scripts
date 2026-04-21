/*
SF Express Loon capture script for sfsy.py.
Behavior:
1) Capture sessionId, _login_mobile_, _login_user_id_.
2) No lock and no dedup. Every valid capture can notify.
*/

const STORE_KEY = "sfsy_cookie";
const TARGET_HOST = "mcs-mimp-web.sf-express.com";
const REQUIRED_KEYS = ["sessionId", "_login_mobile_", "_login_user_id_"];

function parseCookieString(cookieStr) {
  const result = {};
  if (!cookieStr) return result;
  cookieStr.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) result[key] = value;
  });
  return result;
}

function parseSetCookie(setCookie) {
  const result = {};
  if (!setCookie) return result;
  const items = Array.isArray(setCookie) ? setCookie : [setCookie];
  items.forEach((line) => {
    const firstPart = String(line).split(";")[0];
    const i = firstPart.indexOf("=");
    if (i < 0) return;
    const key = firstPart.slice(0, i).trim();
    const value = firstPart.slice(i + 1).trim();
    if (key) result[key] = value;
  });
  return result;
}

function mergeCookies() {
  const merged = {};
  for (let idx = 0; idx < arguments.length; idx += 1) {
    const source = arguments[idx] || {};
    Object.keys(source).forEach((key) => {
      if (source[key]) merged[key] = source[key];
    });
  }
  return merged;
}

function hasRequired(cookieMap) {
  return REQUIRED_KEYS.every((k) => !!cookieMap[k]);
}

function buildSfsyUrl(cookieMap) {
  return REQUIRED_KEYS.map((k) => `${k}=${cookieMap[k] || ""}`).join(";");
}

function notifyWithOpenUrl(title, subtitle, message, openUrl) {
  if (typeof $notification !== "undefined") {
    $notification.post(title, subtitle, message, { openUrl });
  }
}

function done(body) {
  if (body) return $done({ body });
  return $done({});
}

try {
  const req = typeof $request !== "undefined" ? $request : null;
  const res = typeof $response !== "undefined" ? $response : null;
  const url = req ? req.url || "" : "";

  if (!url || url.indexOf(TARGET_HOST) < 0) return done();

  const reqHeaders = (req && req.headers) || {};
  const resHeaders = (res && res.headers) || {};
  const requestCookie =
    reqHeaders.Cookie || reqHeaders.cookie || reqHeaders.COOKIE || "";
  const responseSetCookie =
    resHeaders["Set-Cookie"] ||
    resHeaders["set-cookie"] ||
    resHeaders["SET-COOKIE"] ||
    "";

  const oldCookie = parseCookieString($persistentStore.read(STORE_KEY) || "");
  const newCookie = mergeCookies(
    oldCookie,
    parseCookieString(requestCookie),
    parseSetCookie(responseSetCookie)
  );

  if (!hasRequired(newCookie)) return done();

  const sfsyUrl = buildSfsyUrl(newCookie);
  $persistentStore.write(sfsyUrl, STORE_KEY);

  const copyText = `sfsyUrl\n\n${sfsyUrl}\n\nLong-press to copy.`;
  const copyPage = `data:text/plain;charset=utf-8,${encodeURIComponent(copyText)}`;

  notifyWithOpenUrl(
    "SFSY Capture OK",
    "Tap notification to copy sfsyUrl",
    "No lock, no dedup",
    copyPage
  );

  return done({ sfsy_capture: true, sfsyUrl, host: TARGET_HOST, path: url });
} catch (e) {
  if (typeof $notification !== "undefined") {
    $notification.post("SFSY Capture Failed", "Script error", String(e));
  }
  return done();
}
