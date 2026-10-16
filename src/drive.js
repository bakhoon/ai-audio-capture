// Google Drive 저장 (브라우저에서 직접, drive.file 권한: 이 앱이 만든 파일만 건드릴 수 있음)

const SCOPE = "https://www.googleapis.com/auth/drive.file";
let gisLoading = null;
let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let pending = null;

export function loadGoogle(clientId) {
  if (!clientId) return Promise.resolve(false);
  if (!gisLoading) {
    gisLoading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (resp) => {
            const p = pending;
            pending = null;
            if (resp.error) return p?.reject(new Error(resp.error));
            accessToken = resp.access_token;
            tokenExpiresAt = Date.now() + (Number(resp.expires_in) - 60) * 1000;
            p?.resolve(accessToken);
          },
          error_callback: (err) => {
            const p = pending;
            pending = null;
            p?.reject(new Error(err?.type || "google_auth_failed"));
          },
        });
        resolve(true);
      };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < tokenExpiresAt;
}

// 버튼 클릭 안에서 불러야 팝업이 막히지 않아요 (시작 버튼에서 호출)
export function requestToken() {
  if (!tokenClient) return Promise.reject(new Error("google_not_loaded"));
  if (hasValidToken()) return Promise.resolve(accessToken);
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

// 처음엔 파일을 만들고, 그 다음부터는 같은 파일을 덮어써요. 파일 id 를 돌려줌.
export async function saveToDrive({ fileId, name, content }) {
  if (!hasValidToken()) throw new Error("drive_token_expired");
  const auth = { Authorization: `Bearer ${accessToken}` };

  if (fileId) {
    const r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: "PATCH", headers: { ...auth, "Content-Type": "text/plain; charset=UTF-8" }, body: content }
    );
    if (!r.ok) throw new Error(`drive_update_${r.status}`);
    return fileId;
  }

  const boundary = "mokjang" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: "text/plain" }) +
    `\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;
  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
  );
  if (!r.ok) throw new Error(`drive_create_${r.status}`);
  const data = await r.json();
  return data.id;
}
