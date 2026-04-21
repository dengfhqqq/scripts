/*
SF Express Loon capture script for sfsy.py.
Behavior:
1) Capture sessionId, _login_mobile_, _login_user_id_.
2) No lock and no dedup. Every valid capture can notify.
3) Better trigger matching for both http-request and http-response.
*/

const STORE_KEY = "sfsy_cookie";
const STORE_HINT_TS_KEY = "sfsy_cookie_hint_ts";
const TARGET_HOST = "mcs-mimp-web.sf-express.com";
const REQUIRED_KEYS = ["sessionId", "_login_mobile_", "_login_user_id_"];
const HINT_INTERVAL_SEC = 30;

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

function notify(title, subtitle, message, openUrl) {
  if (typeof $notification === "undefined") return;
  if (openUrl) {
    $notification.post(title, subtitle, message, { openUrl });
  } else {
    $notification.post(title, subtitle, message);
  }
}

function done(body) {
  if (body) return $done({ body });
  return $done({});
}

function getHeader(headers, key) {
  if (!headers) return "";
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "";
}

function getHostFromUrl(url) {
  const m = String(url || "").match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1].toLowerCase() : "";
}

try {
  const req = typeof $request !== "undefined" ? $request : null;
  const res = typeof $response !== "undefined" ? $response : null;

  const reqHeaders = (req && req.headers) || {};
  const resHeaders = (res && res.headers) || {};

  const reqUrl = (req && req.url) || "";
  const resUrl = (res && res.url) || "";
  const url = reqUrl || resUrl || "";

  const hostByUrl = getHostFromUrl(url);
  const hostByReqHeader = String(getHeader(reqHeaders, "Host") || getHeader(reqHeaders, ":authority")).toLowerCase();
  const hostByResHeader = String(getHeader(resHeaders, "Host") || getHeader(resHeaders, ":authority")).toLowerCase();
  const host = hostByUrl || hostByReqHeader || hostByResHeader;

  if (host !== TARGET_HOST && String(url).indexOf(TARGET_HOST) < 0) {
    return done();
  }

  const requestCookie = getHeader(reqHeaders, "Cookie");
  const responseSetCookie = getHeader(resHeaders, "Set-Cookie");
  const responseCookie = getHeader(resHeaders, "Cookie");

  const oldCookie = parseCookieString($persistentStore.read(STORE_KEY) || "");
  const newCookie = mergeCookies(
    oldCookie,
    parseCookieString(requestCookie),
    parseCookieString(responseCookie),
    parseSetCookie(responseSetCookie)
  );

  if (!hasRequired(newCookie)) {
    const nowTs = Math.floor(Date.now() / 1000);
    const lastHintTs = parseInt($persistentStore.read(STORE_HINT_TS_KEY) || "0", 10);
    if (nowTs - lastHintTs >= HINT_INTERVAL_SEC) {
      $persistentStore.write(String(nowTs), STORE_HINT_TS_KEY);
      notify(
        "SFSY matched",
        "Request hit but cookie not complete yet",
        "Open SF mini app pages and retry"
      );
    }
    return done({ sfsy_capture: false, reason: "cookie_incomplete", host, url });
  }

  const sfsyUrl = buildSfsyUrl(newCookie);
  $persistentStore.write(sfsyUrl, STORE_KEY);

  const copyText = `sfsyUrl\n\n${sfsyUrl}\n\nLong-press to copy.`;
  const copyPage = `data:text/plain;charset=utf-8,${encodeURIComponent(copyText)}`;

  notify(
    "SFSY Capture OK",
    "Tap notification to copy sfsyUrl",
    "No lock, no dedup",
    copyPage
  );

  return done({ sfsy_capture: true, sfsyUrl, host, url });
} catch (e) {
  notify("SFSY Capture Failed", "Script error", String(e));
  return done();
}
