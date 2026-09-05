export interface WebUser {
  id: number;
  nickname: string | null;
  profile_image_url: string | null;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export const renderAccountPage = (user: WebUser | null, error?: string | null): string => {
  const nickname = user?.nickname ?? "";
  const profileImage = user?.profile_image_url
    ? `<img class="avatar" src="${escapeHtml(user.profile_image_url)}" alt="프로필 이미지">`
    : `<div class="avatar avatar-placeholder">K</div>`;
  const safeError = error ? escapeHtml(error) : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kakao Account</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f6f8; color: #191919; }
    main { width: min(92vw, 460px); }
    .card { background: #fff; border: 1px solid #e7e7e7; border-radius: 20px; padding: 32px; box-shadow: 0 12px 36px rgba(0,0,0,.08); }
    h1 { margin: 0 0 8px; font-size: 26px; }
    .subtitle { margin: 0 0 28px; color: #666; }
    .login { display: block; width: 100%; padding: 14px 18px; border: 0; border-radius: 12px; background: #fee500; color: #191919; text-align: center; font-weight: 700; text-decoration: none; cursor: pointer; }
    .profile { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
    .avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #f0f0f0; }
    .avatar-placeholder { display: grid; place-items: center; font-size: 22px; font-weight: 800; }
    .user-id { color: #888; font-size: 13px; margin-top: 3px; }
    label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    .row { display: flex; gap: 8px; }
    input { min-width: 0; flex: 1; padding: 13px 14px; border: 1px solid #ddd; border-radius: 10px; font-size: 15px; outline: none; }
    input:focus { border-color: #999; box-shadow: 0 0 0 3px rgba(0,0,0,.06); }
    button { padding: 13px 16px; border: 0; border-radius: 10px; background: #191919; color: #fff; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    .message { min-height: 22px; margin: 10px 0 0; font-size: 14px; }
    .message.error { color: #d93025; }
    .message.success { color: #188038; }
    .logout { width: 100%; margin-top: 24px; background: #fff; color: #555; border: 1px solid #ddd; }
    .error-box { margin-bottom: 20px; padding: 12px 14px; border-radius: 10px; background: #fff0f0; color: #b42318; font-size: 14px; }
    .hint { margin-top: 8px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
<main>
  <section class="card">
    <h1>Kakao Account</h1>
    <p class="subtitle">카카오 로그인 계정 관리</p>
    ${safeError ? `<div class="error-box">${safeError}</div>` : ""}
    ${user ? `
      <div class="profile">
        ${profileImage}
        <div>
          <strong id="currentNickname">${escapeHtml(nickname || "닉네임 미설정")}</strong>
          <div class="user-id">사용자 #${user.id}</div>
        </div>
      </div>
      <form id="nicknameForm">
        <label for="nickname">닉네임</label>
        <div class="row">
          <input id="nickname" name="nickname" maxlength="20" minlength="2" value="${escapeHtml(nickname)}" placeholder="2~20자 닉네임" autocomplete="nickname" required>
          <button id="saveButton" type="submit">저장</button>
        </div>
        <div class="hint">공백만 입력할 수 없으며, 이미 사용 중인 닉네임은 사용할 수 없습니다.</div>
        <p id="message" class="message" aria-live="polite"></p>
      </form>
      <button id="logoutButton" class="logout" type="button">로그아웃</button>
      <script>
        const form = document.getElementById("nicknameForm");
        const input = document.getElementById("nickname");
        const saveButton = document.getElementById("saveButton");
        const currentNickname = document.getElementById("currentNickname");
        const message = document.getElementById("message");
        const logoutButton = document.getElementById("logoutButton");
        const showMessage = (text, type) => { message.textContent = text; message.className = "message " + type; };
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const nickname = input.value.trim();
          if (nickname.length < 2 || nickname.length > 20) { showMessage("닉네임은 2~20자로 입력해주세요.", "error"); return; }
          saveButton.disabled = true;
          showMessage("저장 중...", "");
          try {
            const response = await fetch("/api/profile/nickname", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname }) });
            const data = await response.json().catch(() => ({}));
            if (response.status === 409) { showMessage("이미 사용 중인 닉네임입니다.", "error"); return; }
            if (!response.ok) { showMessage(data.error || "닉네임을 저장하지 못했습니다.", "error"); return; }
            input.value = data.nickname;
            currentNickname.textContent = data.nickname;
            showMessage("닉네임이 저장되었습니다.", "success");
          } catch { showMessage("네트워크 오류가 발생했습니다.", "error"); }
          finally { saveButton.disabled = false; }
        });
        logoutButton.addEventListener("click", async () => {
          logoutButton.disabled = true;
          try {
            const response = await fetch("/auth/logout", { method: "POST" });
            if (response.ok) window.location.href = "/";
            else showMessage("로그아웃하지 못했습니다.", "error");
          } catch { showMessage("네트워크 오류가 발생했습니다.", "error"); }
          finally { logoutButton.disabled = false; }
        });
      </script>
    ` : `
      <p>카카오 계정으로 로그인하면 닉네임을 설정하고 관리할 수 있습니다.</p>
      <a class="login" href="/auth/kakao">카카오로 로그인</a>
    `}
  </section>
</main>
</body>
</html>`;
};
