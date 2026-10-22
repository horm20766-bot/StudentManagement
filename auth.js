
const AUTH_API =
    "https://misty-sun-17d3studenthub-api.horm20766.workers.dev";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");

function showAuthMessage(message, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#dc2626" : "#15803d";
}

async function authRequest(path, data) {
    const response = await fetch(`${AUTH_API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = document.getElementById("loginButton");
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        button.disabled = true;
        showAuthMessage("Signing in...");

        try {
            const result = await authRequest("/auth/login", {
                username,
                password
            });

            // Store the session only for this browser tab.
            // This is a bearer token, so never log or share it.
            sessionStorage.setItem("studenthub_token", result.token);
            sessionStorage.setItem(
                "studenthub_user",
                JSON.stringify(result.user)
            );

            window.location.replace("index.html");
        } catch (error) {
            showAuthMessage(error.message, true);
        } finally {
            button.disabled = false;
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = document.getElementById("registerButton");
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            showAuthMessage("Passwords do not match.", true);
            return;
        }

        button.disabled = true;
        showAuthMessage("Creating account...");

        try {
            await authRequest("/auth/register", {
                username,
                password
            });

            showAuthMessage(
                "Account created successfully. Redirecting to login..."
            );

            window.setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);
        } catch (error) {
            showAuthMessage(error.message, true);
        } finally {
            button.disabled = false;
        }
    });
}

